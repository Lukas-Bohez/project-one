// Package handlers implements the HTTP API for Sentle, Quiz The Spire's
// sequential sentence-guessing word game.
//
// SENTLE REDESIGN — see masterprompt.md for
// the full design rationale, research findings, and API contract this
// file implements. Keep this file and that document in lockstep.
//
// GAMEPLAY MODEL
// Solving word N unlocks word N+1. Every solved (or auto-revealed) word
// stays permanently locked into the sentence, in order. Each word gets
// its own attempt budget (default 4) instead of one pool shared across
// the whole sentence.
//
// CONTENT MODEL
//   - Daily Sentle sentences stay hand-curated via the existing
//     /pages/sentle-admin/ panel, for voice and quality — see
//     curatedSentenceForDate below, which is the integration point.
//   - Infinite Mode sentences are generated procedurally from the
//     grammar templates + word bank below, for unrated endless play
//     where hand-curation doesn't scale.
//
// SECURITY MODEL
//   - Plaintext answers are never sent to the client. Daily/Random
//     responses carry only word length + POS/hint metadata, plus one
//     sentence-level salted hash (IntegrityHash) for optional "is this
//     the same puzzle" checks on shared links. It is deliberately too
//     coarse (whole sentence, not per word) to be a useful target for
//     brute-forcing a single answer, and it is never used to check a
//     guess.
//   - The authoritative check happens entirely in ValidateHandler,
//     against an in-memory per-session puzzleRecord the client never
//     sees directly. A client can't derive an answer from the wire
//     payload, and can't out-guess the attempt cap since the cap is
//     enforced against server-held state, not a client-supplied
//     counter.
//
// DEPLOYMENT NOTE
// The rest of quizthespire.com is still served by the existing
// Python/FastAPI backend behind Apache on the site's Raspberry Pi 5,
// while that backend is migrated to Go feature by feature. This
// package is written to be mounted standalone: point Apache's reverse
// proxy at /api/v1/sentle/* -> this Go service's port, leaving every
// other /api/* route on the Python service untouched until its turn
// comes. Requires Go 1.22+ (uses method-prefixed ServeMux patterns).
package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math/big"
	mrand "math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------
// Word bank & grammar templates
//
// This is a small starter set so the engine runs end to end. Expand
// each POS list substantially before Infinite Mode ships widely --
// Wordle-style games live or die on the word list feeling fair and
// varied, not obscure or repetitive. See masterprompt §7.
// ---------------------------------------------------------------------

// wordEntry is one candidate word for a given part of speech, with an
// optional semantic-category hint shown above the active slot (e.g.
// "creature", "location"). Leave Hint empty to show just the POS tag.
type wordEntry struct {
	Word string
	Hint string
}

var wordBank = map[string][]wordEntry{
	"article": {
		{Word: "the"}, {Word: "a"}, {Word: "an"}, {Word: "our"}, {Word: "his"}, {Word: "her"},
	},
	"adjective": {
		{Word: "quiet", Hint: "mood"}, {Word: "clever", Hint: "mood"}, {Word: "rusty", Hint: "texture"},
		{Word: "golden", Hint: "color"}, {Word: "frozen", Hint: "texture"}, {Word: "ancient", Hint: "age"},
		{Word: "tiny", Hint: "size"}, {Word: "stormy", Hint: "weather"}, {Word: "hollow", Hint: "texture"},
		{Word: "eager", Hint: "mood"}, {Word: "silent", Hint: "mood"}, {Word: "bright", Hint: "color"},
	},
	"noun": {
		{Word: "otter", Hint: "creature"}, {Word: "engine", Hint: "object"}, {Word: "harbor", Hint: "location"},
		{Word: "lantern", Hint: "object"}, {Word: "glacier", Hint: "location"}, {Word: "falcon", Hint: "creature"},
		{Word: "market", Hint: "location"}, {Word: "compass", Hint: "object"}, {Word: "tunnel", Hint: "location"},
		{Word: "spider", Hint: "creature"}, {Word: "castle", Hint: "location"}, {Word: "rocket", Hint: "object"},
	},
	"verb": {
		{Word: "wanders", Hint: "movement"}, {Word: "builds", Hint: "creation"}, {Word: "whispers", Hint: "speech"},
		{Word: "climbs", Hint: "movement"}, {Word: "gathers", Hint: "creation"}, {Word: "guards", Hint: "protection"},
		{Word: "drifts", Hint: "movement"}, {Word: "repairs", Hint: "creation"}, {Word: "escapes", Hint: "movement"},
	},
	"adverb": {
		{Word: "quietly"}, {Word: "slowly"}, {Word: "bravely"}, {Word: "nightly"},
		{Word: "closely"}, {Word: "rarely"}, {Word: "gladly"}, {Word: "boldly"},
	},
}

// template is an ordered list of POS tags a generated sentence must
// fill, e.g. ["article","adjective","noun","verb","adverb"].
type template struct {
	Pattern []string
}

var templates = []template{
	{Pattern: []string{"article", "adjective", "noun", "verb", "adverb"}},
	{Pattern: []string{"article", "noun", "verb", "article", "adjective", "noun"}},
	{Pattern: []string{"article", "adjective", "noun", "verb"}},
}

// ---------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------

// wordAnswer is the server-only record for one slot: the real word
// plus its POS tag and hint. Never serialized as a whole to the client.
type wordAnswer struct {
	Word string
	POS  string
	Hint string
}

// generateSentence deterministically builds a sentence from the word
// bank + templates using seed. The same seed always yields the same
// sentence -- that's what makes a date-derived seed "the daily" and a
// shared seed a replayable Infinite Mode puzzle.
func generateSentence(seed int64) ([]wordAnswer, error) {
	r := mrand.New(mrand.NewSource(seed))
	tmpl := templates[r.Intn(len(templates))]

	out := make([]wordAnswer, 0, len(tmpl.Pattern))
	for _, pos := range tmpl.Pattern {
		options, ok := wordBank[pos]
		if !ok || len(options) == 0 {
			return nil, fmt.Errorf("sentle: no word bank entries for pos %q", pos)
		}
		pick := options[r.Intn(len(options))]
		out = append(out, wordAnswer{Word: pick.Word, POS: pos, Hint: pick.Hint})
	}
	return out, nil
}

// curatedSentenceForDate should look up whatever /pages/sentle-admin/
// has stored for dateEpoch and return it with ok=true if present. This
// is the integration point described in masterprompt §4.1 -- wire it
// to the real curated-sentence storage once that panel is tagging POS
// + Hint per word. Until then, DailyHandler falls back to the
// procedural generator below.
func curatedSentenceForDate(dateEpoch string) ([]wordAnswer, bool) {
	// TODO: replace with a real lookup against the admin-curated store.
	return nil, false
}

// dailySeed turns a YYYY-MM-DD epoch string into a deterministic int64
// seed, so every player on the same calendar day gets the same
// procedurally-generated fallback sentence without the server needing
// to persist anything extra.
func dailySeed(dateEpoch string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte("sentle-daily:" + dateEpoch))
	return int64(h.Sum64())
}

// randomSeed mints a fresh, unpredictable seed for a new Infinite Mode
// puzzle using crypto/rand, then hands back both the int64 (for
// generation) and its base36 text form (for the puzzle_id / share URL).
func randomSeed() (int64, string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		return 0, "", err
	}
	seed := n.Int64()
	return seed, strconv.FormatInt(seed, 36), nil
}

// seedFromText reverses randomSeed's base36 encoding, for replaying a
// shared Infinite Mode link.
func seedFromText(text string) (int64, error) {
	return strconv.ParseInt(text, 36, 64)
}

// ---------------------------------------------------------------------
// Session-tracked puzzle state
// ---------------------------------------------------------------------

const defaultMaxAttempts = 4

// maxAttemptsForWord centralizes the attempt cap so scaling it by word
// length later (shorter words get fewer tries) is a one-line change
// here instead of a refactor everywhere it's used.
func maxAttemptsForWord(length int) int {
	return defaultMaxAttempts
}

type slotState struct {
	Answer       wordAnswer
	AttemptsUsed int
	Locked       bool // solved OR auto-revealed -- either way, done
	Revealed     bool // true only for the auto-reveal-on-exhaustion case
}

type puzzleRecord struct {
	PuzzleID  string
	Mode      string // "daily" | "infinite"
	Slots     []slotState
	CreatedAt time.Time
}

func (p *puzzleRecord) allLocked() bool {
	for _, s := range p.Slots {
		if !s.Locked {
			return false
		}
	}
	return true
}

func (p *puzzleRecord) firstUnlockedIndex() int {
	for i, s := range p.Slots {
		if !s.Locked {
			return i
		}
	}
	return -1
}

// sessionStore holds one puzzleRecord per (session, puzzle) pair.
// In-memory and mutex-guarded: appropriate for a single self-hosted
// instance -- this is designed to run on the site's existing
// Raspberry Pi 5, not a multi-node cluster (see masterprompt §4.4).
// If Sentle ever needs to scale horizontally, swap this for a small
// Redis-backed store behind the same three methods; nothing above
// this type needs to change.
type sessionStore struct {
	mu      sync.Mutex
	records map[string]*puzzleRecord // key: sessionID + "|" + puzzleID
}

func newSessionStore() *sessionStore {
	return &sessionStore{records: make(map[string]*puzzleRecord)}
}

func recordKey(sessionID, puzzleID string) string {
	return sessionID + "|" + puzzleID
}

func (s *sessionStore) getOrCreate(sessionID, puzzleID, mode string, words []wordAnswer) *puzzleRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := recordKey(sessionID, puzzleID)
	if rec, ok := s.records[key]; ok {
		return rec
	}
	slots := make([]slotState, len(words))
	for i, w := range words {
		slots[i] = slotState{Answer: w}
	}
	rec := &puzzleRecord{PuzzleID: puzzleID, Mode: mode, Slots: slots, CreatedAt: time.Now()}
	s.records[key] = rec
	return rec
}

func (s *sessionStore) get(sessionID, puzzleID string) (*puzzleRecord, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.records[recordKey(sessionID, puzzleID)]
	return rec, ok
}

// sweepExpired drops records older than maxAge. Call this from a
// ticker in main.go (e.g. once an hour) so a long-running process
// doesn't accumulate old sessions forever.
func (s *sessionStore) sweepExpired(maxAge time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := time.Now().Add(-maxAge)
	for key, rec := range s.records {
		if rec.CreatedAt.Before(cutoff) {
			delete(s.records, key)
		}
	}
}

var store = newSessionStore()

// ---------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------

// Deliberately a separate cookie from whatever the sitewide accounts
// system uses -- this one tracks attempt state for anonymous and
// logged-in players alike. See masterprompt §8, open question 3, on
// confirming it can coexist cleanly with the real auth cookie.
const sessionCookieName = "sentle_session"

func ensureSessionID(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(sessionCookieName); err == nil && c.Value != "" {
		return c.Value
	}
	id := newOpaqueID()
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})
	return id
}

func newOpaqueID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ---------------------------------------------------------------------
// Wire types -- keep these in lockstep with masterprompt §6 (API
// Reference) and public/sentle/game.js's fetch calls.
// ---------------------------------------------------------------------

type slotDTO struct {
	Index       int    `json:"index"`
	Length      int    `json:"length"`
	POS         string `json:"pos"`
	Hint        string `json:"hint,omitempty"`
	MaxAttempts int    `json:"max_attempts"`
}

type puzzleResponse struct {
	PuzzleID      string    `json:"puzzle_id"`
	Mode          string    `json:"mode"`
	WordCount     int       `json:"word_count"`
	Slots         []slotDTO `json:"slots"`
	IntegrityHash string    `json:"integrity_hash"`
}

type validateRequest struct {
	PuzzleID  string `json:"puzzle_id"`
	WordIndex int    `json:"word_index"`
	Guess     string `json:"guess"`
}

type validateResponse struct {
	Correct           bool     `json:"correct"`
	Letters           []string `json:"letters"` // "correct" | "present" | "absent", one per guess letter
	AttemptsUsed      int      `json:"attempts_used"`
	AttemptsRemaining int      `json:"attempts_remaining"`
	WordLocked        bool     `json:"word_locked"`
	WordRevealed      bool     `json:"word_revealed"`
	Answer            string   `json:"answer,omitempty"` // present only once word_locked is true
	NextIndex         int      `json:"next_index,omitempty"`
	GameComplete      bool     `json:"game_complete"`
}

// integrityHash produces the sentence-level hash shipped in
// puzzleResponse. It is intentionally over the whole sentence (not per
// word) and salted with a server-side pepper, so it's fit only for
// "is this the same puzzle" comparisons -- see the Security Model note
// at the top of this file.
func integrityHash(words []wordAnswer, pepper string) string {
	full := make([]string, len(words))
	for i, w := range words {
		full[i] = w.Word
	}
	sum := sha256.Sum256([]byte(pepper + "|" + strings.Join(full, " ")))
	return hex.EncodeToString(sum[:])
}

// TODO: move to server config/env before shipping.
const integrityPepper = "sentle-v1-change-me"

// ---------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------

// DailyHandler serves GET /api/v1/sentle/daily.
func DailyHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := ensureSessionID(w, r)
	dateEpoch := time.Now().UTC().Format("2006-01-02")

	words, ok := curatedSentenceForDate(dateEpoch)
	if !ok {
		var err error
		words, err = generateSentence(dailySeed(dateEpoch))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "sentence generation failed")
			return
		}
	}

	rec := store.getOrCreate(sessionID, dateEpoch, "daily", words)
	writeJSON(w, http.StatusOK, puzzleResponseFromRecord(rec))
}

// RandomHandler serves GET /api/v1/sentle/random for Infinite Mode.
// With no ?seed= it mints a fresh puzzle and returns its id so the
// client can push it into the URL for replay/sharing. With ?seed= it
// deterministically reproduces that exact puzzle.
func RandomHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := ensureSessionID(w, r)

	seedParam := r.URL.Query().Get("seed")
	var seed int64
	var puzzleID string
	var err error
	if seedParam == "" {
		seed, puzzleID, err = randomSeed()
	} else {
		seed, err = seedFromText(seedParam)
		puzzleID = seedParam
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid seed")
		return
	}

	words, err := generateSentence(seed)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "sentence generation failed")
		return
	}

	rec := store.getOrCreate(sessionID, puzzleID, "infinite", words)
	writeJSON(w, http.StatusOK, puzzleResponseFromRecord(rec))
}

// ValidateHandler serves POST /api/v1/sentle/validate. This is the
// only place a guess is ever checked -- see the Security Model note
// at the top of the file for why.
func ValidateHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := ensureSessionID(w, r)

	var req validateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "malformed request body")
		return
	}

	rec, ok := store.get(sessionID, req.PuzzleID)
	if !ok {
		writeError(w, http.StatusNotFound, "unknown puzzle_id for this session")
		return
	}
	if req.WordIndex < 0 || req.WordIndex >= len(rec.Slots) {
		writeError(w, http.StatusBadRequest, "word_index out of range")
		return
	}
	slot := &rec.Slots[req.WordIndex]
	if slot.Locked {
		writeError(w, http.StatusConflict, "word already locked")
		return
	}
	if req.WordIndex != rec.firstUnlockedIndex() {
		writeError(w, http.StatusConflict, "words must be solved in order")
		return
	}

	guess := normalizeGuess(req.Guess)
	answer := strings.ToLower(slot.Answer.Word)
	if len(guess) != len(answer) {
		writeError(w, http.StatusBadRequest, "guess length must match word length")
		return
	}

	attemptCap := maxAttemptsForWord(len(answer))
	slot.AttemptsUsed++
	letters := scoreLetters(guess, answer)
	correct := guess == answer
	exhausted := !correct && slot.AttemptsUsed >= attemptCap

	if correct || exhausted {
		slot.Locked = true
		slot.Revealed = exhausted
	}

	resp := validateResponse{
		Correct:           correct,
		Letters:           letters,
		AttemptsUsed:      slot.AttemptsUsed,
		AttemptsRemaining: attemptCap - slot.AttemptsUsed,
		WordLocked:        slot.Locked,
		WordRevealed:      slot.Revealed,
		GameComplete:      rec.allLocked(),
	}
	if slot.Locked {
		resp.Answer = answer
		if next := rec.firstUnlockedIndex(); next != -1 {
			resp.NextIndex = next
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func puzzleResponseFromRecord(rec *puzzleRecord) puzzleResponse {
	slots := make([]slotDTO, len(rec.Slots))
	words := make([]wordAnswer, len(rec.Slots))
	for i, s := range rec.Slots {
		slots[i] = slotDTO{
			Index:       i,
			Length:      len(s.Answer.Word),
			POS:         s.Answer.POS,
			Hint:        s.Answer.Hint,
			MaxAttempts: maxAttemptsForWord(len(s.Answer.Word)),
		}
		words[i] = s.Answer
	}
	return puzzleResponse{
		PuzzleID:      rec.PuzzleID,
		Mode:          rec.Mode,
		WordCount:     len(slots),
		Slots:         slots,
		IntegrityHash: integrityHash(words, integrityPepper),
	}
}

// ---------------------------------------------------------------------
// Feedback algorithm
// ---------------------------------------------------------------------

// scoreLetters returns one of "correct" | "present" | "absent" per
// letter of guess, handling repeated letters the way Wordle does: a
// repeated guessed letter only lights up "present" as many times as
// it actually remains unaccounted-for in the answer, so e.g. guessing
// a double letter against a single-occurrence answer doesn't light up
// both.
func scoreLetters(guess, answer string) []string {
	g, a := []rune(guess), []rune(answer)
	result := make([]string, len(g))
	remaining := make(map[rune]int)

	for i := range g {
		if i < len(a) && g[i] == a[i] {
			result[i] = "correct"
		} else {
			result[i] = "absent"
			if i < len(a) {
				remaining[a[i]]++
			}
		}
	}
	for i := range g {
		if result[i] == "correct" {
			continue
		}
		if remaining[g[i]] > 0 {
			result[i] = "present"
			remaining[g[i]]--
		}
	}
	return result
}

func normalizeGuess(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ---------------------------------------------------------------------
// JSON helpers & routing
// ---------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// RegisterRoutes wires the three Sentle endpoints onto mux. Call this
// from main.go's server setup, e.g.:
//
//	mux := http.NewServeMux()
//	handlers.RegisterRoutes(mux)
//
// Point Apache's reverse proxy at /api/v1/sentle/ -> this service so
// it can be deployed independently of the still-Python-backed rest of
// the site (see the Deployment Note at the top of this file).
func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/sentle/daily", DailyHandler)
	mux.HandleFunc("GET /api/v1/sentle/random", RandomHandler)
	mux.HandleFunc("POST /api/v1/sentle/validate", ValidateHandler)
}
