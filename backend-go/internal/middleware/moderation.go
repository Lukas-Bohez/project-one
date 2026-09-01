// Package middleware screens user-submitted text before it's written to the
// database: spam heuristics, an externally-configured blocklist, per-user
// submission rate limiting, and a seam for a real content-safety API.
//
// Read this before wiring it in: the local checks in this file (spam
// heuristics, word blocklist) are fast and useful, but they cannot reliably
// detect illegal material — a keyword filter is trivially evaded and was
// never designed for that job. Anything claiming to screen for "illegal
// content" needs a real classifier behind ExternalModerationClient (a
// hosted moderation API is the usual choice); until one is configured, that
// tier of screening is effectively a no-op and CategoryPotentiallyIllegal
// will never fire. If this platform ever accepts image uploads (avatars,
// quiz cover art, etc.), those need their own hash-matching/scanning path
// (e.g. PhotoDNA or a cloud vision SafeSearch API) with mandatory reporting
// where required by law — that is a materially different problem from
// screening text and is not covered by anything in this file.
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
)

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

type ModerationCategory string

const (
	CategoryClean              ModerationCategory = "clean"
	CategorySpam               ModerationCategory = "spam"
	CategoryProfanity          ModerationCategory = "profanity"
	CategoryPotentiallyIllegal ModerationCategory = "potentially_illegal"
	CategoryRateLimited        ModerationCategory = "rate_limited"
)

type ModerationResult struct {
	Allowed             bool               `json:"allowed"`
	Category            ModerationCategory `json:"category"`
	Reason              string             `json:"reason,omitempty"`
	RequiresHumanReview bool               `json:"requires_human_review"`
}

// ContentModerator is the interface CRUD handlers and the chat hub call
// before persisting anything a user submitted.
type ContentModerator interface {
	Screen(ctx context.Context, content string, authorID uint) (ModerationResult, error)
}

// ---------------------------------------------------------------------------
// External classifier seam
// ---------------------------------------------------------------------------

// ExternalModerationClient is where real illegal-content detection plugs
// in. Implement this against whatever service you choose and pass it to
// NewDefaultModerator via WithExternalClient.
type ExternalModerationClient interface {
	Classify(ctx context.Context, content string) (flagged bool, category string, err error)
}

// noopExternalClient is the default when no real client is configured. It
// never flags anything, which is exactly why DefaultModerator must not be
// treated as catching illegal content until a real client is wired in.
type noopExternalClient struct{}

func (noopExternalClient) Classify(_ context.Context, _ string) (bool, string, error) {
	return false, "", nil
}

// ---------------------------------------------------------------------------
// Local spam heuristics
// ---------------------------------------------------------------------------

var urlPattern = regexp.MustCompile(`https?://|www\.`)

func countLinks(s string) int {
	return len(urlPattern.FindAllString(s, -1))
}

func isExcessiveCaps(s string) bool {
	letters, upper := 0, 0
	for _, r := range s {
		if unicode.IsLetter(r) {
			letters++
			if unicode.IsUpper(r) {
				upper++
			}
		}
	}
	if letters < 12 { // too short to judge fairly
		return false
	}
	return float64(upper)/float64(letters) > 0.7
}

func hasCharacterFlood(s string) bool {
	var last rune
	run := 0
	for i, r := range s {
		if i == 0 || r != last {
			run = 1
			last = r
			continue
		}
		run++
		if run >= 8 {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Per-user submission rate limiting (token bucket). This is deliberately a
// separate, smaller implementation from the per-connection limiter in
// server/chat/hub.go: that one throttles WebSocket message frequency on an
// open connection, this one throttles POST/PUT frequency across stateless
// HTTP requests. Same idea, different lifecycle, not worth sharing a type
// over. Note this map grows with the number of distinct users who have ever
// submitted content and is never pruned - fine for a single-instance,
// moderate-traffic deployment, but add a periodic sweep (or move to a
// Redis-backed limiter) if this process runs for a long time with a large,
// varied user base.
// ---------------------------------------------------------------------------

type tokenBucket struct {
	tokens     float64
	lastRefill time.Time
}

type submissionLimiter struct {
	mu         sync.Mutex
	buckets    map[uint]*tokenBucket
	maxTokens  float64
	refillRate float64 // tokens per second
}

func newSubmissionLimiter(maxTokens, refillPerMinute float64) *submissionLimiter {
	return &submissionLimiter{
		buckets:    make(map[uint]*tokenBucket),
		maxTokens:  maxTokens,
		refillRate: refillPerMinute / 60.0,
	}
}

func (l *submissionLimiter) allow(userID uint) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, ok := l.buckets[userID]
	if !ok {
		l.buckets[userID] = &tokenBucket{tokens: l.maxTokens - 1, lastRefill: now}
		return true
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = min(l.maxTokens, b.tokens+elapsed*l.refillRate)
	b.lastRefill = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// DefaultModerator
// ---------------------------------------------------------------------------

type DefaultModerator struct {
	blocklist []string
	limiter   *submissionLimiter
	external  ExternalModerationClient
	maxLength int
}

type ModeratorOption func(*DefaultModerator)

// WithBlocklist supplies the profanity/banned-term list. Load it from a
// config file, DB table, or maintained package at startup rather than
// hardcoding words into source - a word list needs to be editable without a
// redeploy far more often than this code does.
func WithBlocklist(words []string) ModeratorOption {
	return func(m *DefaultModerator) { m.blocklist = words }
}

// WithExternalClient wires in real illegal-content detection. Without this,
// that tier of screening is a no-op - see the package doc comment.
func WithExternalClient(c ExternalModerationClient) ModeratorOption {
	return func(m *DefaultModerator) { m.external = c }
}

// WithMaxLength overrides the default max submission length (10,000 runes).
func WithMaxLength(n int) ModeratorOption {
	return func(m *DefaultModerator) { m.maxLength = n }
}

// WithRateLimit overrides the default submission rate limit (20 submissions
// burst, refilling at 20/minute).
func WithRateLimit(burst, perMinute float64) ModeratorOption {
	return func(m *DefaultModerator) { m.limiter = newSubmissionLimiter(burst, perMinute) }
}

func NewDefaultModerator(opts ...ModeratorOption) *DefaultModerator {
	m := &DefaultModerator{
		limiter:   newSubmissionLimiter(20, 20),
		external:  noopExternalClient{},
		maxLength: 10000,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

func (m *DefaultModerator) Screen(ctx context.Context, content string, authorID uint) (ModerationResult, error) {
	trimmed := strings.TrimSpace(content)

	if trimmed == "" {
		return ModerationResult{Allowed: false, Category: CategorySpam, Reason: "empty content"}, nil
	}
	if len([]rune(trimmed)) > m.maxLength {
		return ModerationResult{Allowed: false, Category: CategorySpam, Reason: "content exceeds max length"}, nil
	}
	if !m.limiter.allow(authorID) {
		return ModerationResult{Allowed: false, Category: CategoryRateLimited, Reason: "submission rate limit exceeded"}, nil
	}
	if isExcessiveCaps(trimmed) || hasCharacterFlood(trimmed) || countLinks(trimmed) > 3 {
		return ModerationResult{Allowed: false, Category: CategorySpam, Reason: "matched spam heuristics"}, nil
	}

	lower := strings.ToLower(trimmed)
	for _, word := range m.blocklist {
		if word == "" {
			continue
		}
		if strings.Contains(lower, strings.ToLower(word)) {
			return ModerationResult{Allowed: false, Category: CategoryProfanity, Reason: "matched blocklist term"}, nil
		}
	}

	flagged, category, err := m.external.Classify(ctx, trimmed)
	if err != nil {
		// Fail closed for the illegal-content tier: if the external
		// checker is unreachable, route to human review instead of
		// publishing unscreened. Both a rejecting result and the error
		// are returned on purpose - callers can log/alert on err while
		// still having a safe default action to take.
		return ModerationResult{
			Allowed:             false,
			Category:            CategoryPotentiallyIllegal,
			Reason:              "moderation service unavailable",
			RequiresHumanReview: true,
		}, err
	}
	if flagged {
		return ModerationResult{
			Allowed:             false,
			Category:            CategoryPotentiallyIllegal,
			Reason:              category,
			RequiresHumanReview: true,
		}, nil
	}

	return ModerationResult{Allowed: true, Category: CategoryClean}, nil
}

// ---------------------------------------------------------------------------
// Auth context (shared with server/handlers/ugc_crud.go so both packages
// agree on where the authenticated user ID lives). Neither this package nor
// the handlers package performs authentication itself - call WithUserID
// from your existing session/JWT middleware, upstream of everything below.
// ---------------------------------------------------------------------------

type contextKey int

const userIDContextKey contextKey = iota

func WithUserID(ctx context.Context, userID uint) context.Context {
	return context.WithValue(ctx, userIDContextKey, userID)
}

func UserIDFromContext(ctx context.Context) (uint, bool) {
	id, ok := ctx.Value(userIDContextKey).(uint)
	return id, ok
}

// ---------------------------------------------------------------------------
// HTTP middleware for single-field submissions
// ---------------------------------------------------------------------------

type cleanContentPayload struct {
	Content string `json:"content"`
}

// RequireCleanContent is HTTP middleware for endpoints whose JSON body has
// a single top-level "content" string field - a chat message, a report's
// free-text details, a single story node edit. It screens that field and
// rejects the request with 422 before the handler ever sees it, then
// restores the body so the handler can decode it normally.
//
// Multi-field submissions (a quiz with several questions and answers, a
// story with many nodes) can't be validated generically this way in a
// strongly typed API - call moderator.Screen per field directly in those
// handlers instead (see server/handlers/ugc_crud.go).
func RequireCleanContent(moderator ContentModerator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB cap
			if err != nil {
				http.Error(w, "unable to read request body", http.StatusBadRequest)
				return
			}
			r.Body.Close()

			var payload cleanContentPayload
			if err := json.Unmarshal(body, &payload); err != nil {
				http.Error(w, "invalid JSON body", http.StatusBadRequest)
				return
			}

			userID, _ := UserIDFromContext(r.Context())
			result, err := moderator.Screen(r.Context(), payload.Content, userID)
			if err != nil && !result.RequiresHumanReview {
				http.Error(w, "moderation check failed", http.StatusInternalServerError)
				return
			}
			if !result.Allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnprocessableEntity)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":    "content rejected by moderation",
					"category": string(result.Category),
				})
				return
			}

			r.Body = io.NopCloser(bytes.NewReader(body))
			next.ServeHTTP(w, r)
		})
	}
}
