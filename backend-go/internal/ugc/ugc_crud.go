// Package handlers implements the HTTP surface for Quiz The Spire's UGC
// engine: quiz and branching-story CRUD, publish-time ToS consent, the
// report/soft-hide pipeline, and DMCA notice intake/review.
//
// This package does not implement authentication. Every handler that needs
// the caller's identity reads it via middleware.UserIDFromContext, which
// your own session/JWT auth middleware must populate (middleware.WithUserID)
// upstream of these routes - see RegisterRoutes. It also doesn't implement
// authorization roles (admin/moderator) beyond simple content-ownership
// checks; gate admin-only routes like ReviewDMCANotice with your own
// role-check middleware.
package ugc

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/chat"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/middleware"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// CurrentTOSVersion is the ToS/UGC-policy version publish actions are
// checked against. Bump it whenever the policy changes; existing
// TOSAcceptance rows remain a historical record of what was agreed to, and
// when - don't rewrite them retroactively.
const CurrentTOSVersion = "1.0"

// ClientIPPepper is mixed into the IP hash stored in user_tos_acceptances so
// it isn't trivially reversible by hashing every possible IP address. This
// MUST be loaded from a real secret/env var in production; the placeholder
// below is not safe to ship.
var ClientIPPepper = "REPLACE_ME_WITH_A_LOADED_SECRET"

type ReportThresholdConfig struct {
	MaxReports int
	Window     time.Duration
}

// DefaultReportThreshold implements "X reports within Y minutes" from the
// spec: 5 reports inside a 15-minute rolling window auto soft-hides content
// pending admin review.
var DefaultReportThreshold = ReportThresholdConfig{MaxReports: 5, Window: 15 * time.Minute}

type Handler struct {
	DB              *gorm.DB
	Moderator       middleware.ContentModerator
	ReportThreshold ReportThresholdConfig
}

func NewHandler(db *gorm.DB, moderator middleware.ContentModerator) *Handler {
	return &Handler{DB: db, Moderator: moderator, ReportThreshold: DefaultReportThreshold}
}

// ---------------------------------------------------------------------------
// Disclaimer + ad targeting metadata, attached to every dynamic UGC detail
// response.
// ---------------------------------------------------------------------------

type Disclaimer struct {
	Text      string `json:"text"`
	ReportURL string `json:"report_url"`
}

var ugcDisclaimer = Disclaimer{
	Text:      "Content on this page is user-generated and does not reflect the views of quizthespire.com. To report abuse or copyright infringement, click Report.",
	ReportURL: "/api/v1/reports",
}

// AdContext carries ad-slot placement markers and content-targeting
// metadata for the client to hand to its ad script. This package only
// returns identifiers; it has no opinion on rendering. To avoid CLS on
// mobile, reserve each slot's box size in the layout before the ad script
// loads rather than letting the container grow once an ad fills it.
type AdContext struct {
	CategorySlug string   `json:"category_slug,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	Slots        []string `json:"ad_slots"`
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

type PaginatedResponse[T any] struct {
	Data       []T   `json:"data"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalCount int64 `json:"total_count"`
	TotalPages int   `json:"total_pages"`
}

func parsePagination(r *http.Request) (page, pageSize int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ = strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	return page, pageSize
}

func totalPages(total int64, pageSize int) int {
	return int(math.Ceil(float64(total) / float64(pageSize)))
}

// ---------------------------------------------------------------------------
// JSON helpers + auth context
// ---------------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func requireUserID(w http.ResponseWriter, r *http.Request) (uint, bool) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return 0, false
	}
	return userID, true
}

// HashClientIP returns a SHA-256 hash (hex-encoded) of the request's client
// IP plus ClientIPPepper, for TOSAcceptance.IPHash - never store the raw
// IP. It reads r.RemoteAddr directly; if this backend sits behind a reverse
// proxy or CDN, RemoteAddr will be the proxy's address, not the real
// client's, so adjust this to read the correct forwarded-for header for
// your actual deployment before relying on it.
func HashClientIP(r *http.Request) string {
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	sum := sha256.Sum256([]byte(host + ClientIPPepper))
	return hex.EncodeToString(sum[:])
}

// ---------------------------------------------------------------------------
// Moderation helpers shared by quiz and story handlers
// ---------------------------------------------------------------------------

type moderationRejectedError struct {
	result middleware.ModerationResult
}

func (e *moderationRejectedError) Error() string {
	return "content rejected: " + e.result.Reason
}

func (h *Handler) screenFields(ctx context.Context, authorID uint, fields ...string) error {
	for _, f := range fields {
		if strings.TrimSpace(f) == "" {
			continue
		}
		result, err := h.Moderator.Screen(ctx, f, authorID)
		if err != nil && !result.RequiresHumanReview {
			return fmt.Errorf("moderation check failed: %w", err)
		}
		if !result.Allowed {
			return &moderationRejectedError{result: result}
		}
	}
	return nil
}

func (h *Handler) respondModerationError(w http.ResponseWriter, err error) {
	var modErr *moderationRejectedError
	if errors.As(err, &modErr) {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
			"error":    "content rejected by moderation",
			"category": string(modErr.result.Category),
		})
		return
	}
	writeError(w, http.StatusInternalServerError, "moderation check failed")
}

func resolveTags(tx *gorm.DB, names []string) ([]models.Tag, error) {
	tags := make([]models.Tag, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(strings.ToLower(name))
		if name == "" {
			continue
		}
		var tag models.Tag
		if err := tx.Where("name = ?", name).FirstOrCreate(&tag, models.Tag{Name: name}).Error; err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

type answerInput struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

type questionInput struct {
	Prompt  string              `json:"prompt"`
	Type    models.QuestionType `json:"type"`
	Answers []answerInput       `json:"answers"`
}

type quizInput struct {
	Title       string          `json:"title"`
	Description string          `json:"description"`
	CategoryID  *uint           `json:"category_id"`
	Tags        []string        `json:"tags"`
	Questions   []questionInput `json:"questions"`
}

func (h *Handler) screenQuizInput(ctx context.Context, authorID uint, in quizInput) error {
	fields := []string{in.Title, in.Description}
	for _, q := range in.Questions {
		fields = append(fields, q.Prompt)
		for _, a := range q.Answers {
			fields = append(fields, a.Text)
		}
	}
	return h.screenFields(ctx, authorID, fields...)
}

type QuizSummary struct {
	ID          uint       `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	AuthorID    uint       `json:"author_id"`
	ViewCount   int64      `json:"view_count"`
	Tags        []string   `json:"tags"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

func toQuizSummary(q models.Quiz) QuizSummary {
	tags := make([]string, 0, len(q.Tags))
	for _, t := range q.Tags {
		tags = append(tags, t.Name)
	}
	return QuizSummary{
		ID: q.ID, Title: q.Title, Description: q.Description, AuthorID: q.AuthorID,
		ViewCount: q.ViewCount, Tags: tags, PublishedAt: q.PublishedAt,
	}
}

type QuizDetail struct {
	models.Quiz
	Disclaimer  Disclaimer `json:"disclaimer"`
	Ad          AdContext  `json:"ad_context"`
	ChatRoomKey string     `json:"chat_room_key"`
}

// CreateQuiz creates a draft quiz. It is not visible to anyone but its
// author until PublishQuiz is called.
func (h *Handler) CreateQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var in quizInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(in.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if err := h.screenQuizInput(r.Context(), userID, in); err != nil {
		h.respondModerationError(w, err)
		return
	}

	quiz := models.Quiz{
		AuthorID: userID, Title: in.Title, Description: in.Description,
		CategoryID: in.CategoryID, Status: models.StatusDraft,
	}
	for _, qi := range in.Questions {
		q := models.UGCQuestion{Prompt: qi.Prompt, Type: qi.Type}
		for _, ai := range qi.Answers {
			q.Answers = append(q.Answers, models.UGCAnswer{Text: ai.Text, IsCorrect: ai.IsCorrect})
		}
		quiz.Questions = append(quiz.Questions, q)
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if len(in.Tags) > 0 {
			tags, err := resolveTags(tx, in.Tags)
			if err != nil {
				return err
			}
			quiz.Tags = tags
		}
		return tx.Create(&quiz).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create quiz")
		return
	}

	writeJSON(w, http.StatusCreated, quiz)
}

// ListQuizzes returns published quizzes only - drafts and soft-hidden
// content never appear here regardless of who's asking; build a separate
// "my content" endpoint if authors need to see their own drafts.
func (h *Handler) ListQuizzes(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePagination(r)
	q := r.URL.Query()

	query := h.DB.Model(&models.Quiz{}).Where("status = ?", models.StatusPublished)
	if tag := q.Get("tag"); tag != "" {
		query = query.Joins("JOIN ugc_quiz_tags qt ON qt.quiz_id = ugc_quizzes.id").
			Joins("JOIN ugc_tags t ON t.id = qt.tag_id AND t.name = ?", strings.ToLower(tag))
	}
	if categorySlug := q.Get("category"); categorySlug != "" {
		query = query.Joins("JOIN ugc_categories c ON c.id = ugc_quizzes.category_id AND c.slug = ?", categorySlug)
	}
	if search := strings.TrimSpace(q.Get("q")); search != "" {
		// Depends on the generated search_vector column in
		// server/migrations/0001_ugc_schema.up.sql. Without that
		// migration applied, swap this for: query.Where("title ILIKE ?
		// OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
		query = query.Where("search_vector @@ plainto_tsquery('english', ?)", search)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count quizzes")
		return
	}

	var quizzes []models.Quiz
	err := query.Preload("Tags").Order("published_at DESC").
		Limit(pageSize).Offset((page - 1) * pageSize).Find(&quizzes).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list quizzes")
		return
	}

	summaries := make([]QuizSummary, 0, len(quizzes))
	for _, quiz := range quizzes {
		summaries = append(summaries, toQuizSummary(quiz))
	}

	writeJSON(w, http.StatusOK, PaginatedResponse[QuizSummary]{
		Data: summaries, Page: page, PageSize: pageSize,
		TotalCount: total, TotalPages: totalPages(total, pageSize),
	})
}

func (h *Handler) GetQuiz(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var quiz models.Quiz
	if err := h.DB.Preload("Questions.Answers").Preload("Tags").Preload("Category").
		First(&quiz, uint(id)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "quiz not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load quiz")
		return
	}

	// Best-effort atomic increment. A lost count under a race isn't worth
	// failing the request over; the increment itself is safe from
	// read-modify-write races because it's done in SQL, not in Go.
	h.DB.Model(&models.Quiz{}).Where("id = ?", quiz.ID).
		UpdateColumn("view_count", gorm.Expr("view_count + 1"))

	tags := make([]string, 0, len(quiz.Tags))
	for _, t := range quiz.Tags {
		tags = append(tags, t.Name)
	}
	var categorySlug string
	if quiz.Category != nil {
		categorySlug = quiz.Category.Slug
	}

	writeJSON(w, http.StatusOK, QuizDetail{
		Quiz:        quiz,
		Disclaimer:  ugcDisclaimer,
		ChatRoomKey: chat.RoomKeyForQuiz(quiz.ID),
		Ad: AdContext{
			CategorySlug: categorySlug, Tags: tags,
			Slots: []string{"ad_slot_above_comments", "ad_slot_post_quiz_results"},
		},
	})
}

// UpdateQuiz updates top-level fields and tags only. Editing individual
// questions/answers safely means diffing which to keep, add, or delete
// rather than blindly replacing the slice - left as a follow-up rather than
// building that speculatively here; add a dedicated endpoint for it if the
// editor UI needs in-place question editing.
func (h *Handler) UpdateQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var quiz models.Quiz
	if err := h.DB.First(&quiz, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}
	if quiz.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this quiz")
		return
	}

	var in quizInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := h.screenFields(r.Context(), userID, in.Title, in.Description); err != nil {
		h.respondModerationError(w, err)
		return
	}

	quiz.Title = in.Title
	quiz.Description = in.Description
	quiz.CategoryID = in.CategoryID

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if len(in.Tags) > 0 {
			tags, err := resolveTags(tx, in.Tags)
			if err != nil {
				return err
			}
			if err := tx.Model(&quiz).Association("Tags").Replace(tags); err != nil {
				return err
			}
		}
		return tx.Save(&quiz).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update quiz")
		return
	}

	writeJSON(w, http.StatusOK, quiz)
}

func (h *Handler) DeleteQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var quiz models.Quiz
	if err := h.DB.First(&quiz, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}
	if quiz.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this quiz")
		return
	}
	if err := h.DB.Delete(&quiz).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete quiz")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type publishInput struct {
	AcceptTOS  bool   `json:"accept_tos"`
	TOSVersion string `json:"tos_version"`
}

// PublishQuiz is the "TOS/UGC policy agreement flag at content publication"
// requirement: publishing fails unless the caller explicitly affirms the
// current ToS version in this exact request, and that affirmation is
// logged as its own TOSAcceptance row alongside the status change.
func (h *Handler) PublishQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid quiz id")
		return
	}

	var quiz models.Quiz
	if err := h.DB.First(&quiz, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}
	if quiz.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this quiz")
		return
	}

	var in publishInput
	_ = json.NewDecoder(r.Body).Decode(&in) // missing/invalid body just leaves accept_tos false
	if !in.AcceptTOS || in.TOSVersion != CurrentTOSVersion {
		writeError(w, http.StatusPreconditionRequired, "must accept the current ToS/UGC policy version to publish")
		return
	}

	now := time.Now()
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&models.TOSAcceptance{
			UserID: userID, TOSVersion: in.TOSVersion, Context: models.TOSContextContentPublish,
			IPHash: HashClientIP(r), AcceptedAt: now,
		}).Error; err != nil {
			return err
		}

		quiz.Status = models.StatusPublished
		quiz.PublishedAt = &now
		if err := tx.Save(&quiz).Error; err != nil {
			return err
		}

		newRoom := models.ChatRoom{TargetType: models.TargetQuiz, TargetID: quiz.ID, Topic: quiz.Title}
		return tx.Where(models.ChatRoom{TargetType: models.TargetQuiz, TargetID: quiz.ID}).
			FirstOrCreate(&newRoom).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to publish quiz")
		return
	}

	writeJSON(w, http.StatusOK, quiz)
}

// ---------------------------------------------------------------------------
// Branching stories
//
// CreateStory only takes a title/description and a single starting node -
// a full nested node+choice graph in one request is an awkward payload
// shape for what is, in practice, an incrementally-built editor UI. Build
// out the graph with AddStoryNode / AddStoryChoice after creation.
// ---------------------------------------------------------------------------

type storyNodeInput struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	IsEnding bool   `json:"is_ending"`
}

type createStoryInput struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	CategoryID  *uint          `json:"category_id"`
	Tags        []string       `json:"tags"`
	StartNode   storyNodeInput `json:"start_node"`
}

type StorySummary struct {
	ID          uint       `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	AuthorID    uint       `json:"author_id"`
	ViewCount   int64      `json:"view_count"`
	Tags        []string   `json:"tags"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

func toStorySummary(s models.Story) StorySummary {
	tags := make([]string, 0, len(s.Tags))
	for _, t := range s.Tags {
		tags = append(tags, t.Name)
	}
	return StorySummary{
		ID: s.ID, Title: s.Title, Description: s.Description, AuthorID: s.AuthorID,
		ViewCount: s.ViewCount, Tags: tags, PublishedAt: s.PublishedAt,
	}
}

type StoryDetail struct {
	models.Story
	Disclaimer  Disclaimer `json:"disclaimer"`
	Ad          AdContext  `json:"ad_context"`
	ChatRoomKey string     `json:"chat_room_key"`
}

func (h *Handler) CreateStory(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	var in createStoryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.StartNode.Content) == "" {
		writeError(w, http.StatusBadRequest, "title and start_node.content are required")
		return
	}
	if err := h.screenFields(r.Context(), userID, in.Title, in.Description, in.StartNode.Content); err != nil {
		h.respondModerationError(w, err)
		return
	}

	story := models.Story{
		AuthorID: userID, Title: in.Title, Description: in.Description, CategoryID: in.CategoryID,
		Status: models.StatusDraft,
		Nodes: []models.StoryNode{{
			Title: in.StartNode.Title, Content: in.StartNode.Content, IsEnding: in.StartNode.IsEnding,
		}},
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if len(in.Tags) > 0 {
			tags, err := resolveTags(tx, in.Tags)
			if err != nil {
				return err
			}
			story.Tags = tags
		}
		if err := tx.Create(&story).Error; err != nil {
			return err
		}
		story.StartNodeID = &story.Nodes[0].ID
		return tx.Model(&story).Update("start_node_id", story.StartNodeID).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create story")
		return
	}

	writeJSON(w, http.StatusCreated, story)
}

func (h *Handler) AddStoryNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	storyID, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	var story models.Story
	if err := h.DB.First(&story, uint(storyID)).Error; err != nil {
		writeError(w, http.StatusNotFound, "story not found")
		return
	}
	if story.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this story")
		return
	}

	var in storyNodeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || strings.TrimSpace(in.Content) == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if err := h.screenFields(r.Context(), userID, in.Title, in.Content); err != nil {
		h.respondModerationError(w, err)
		return
	}

	node := models.StoryNode{StoryID: story.ID, Title: in.Title, Content: in.Content, IsEnding: in.IsEnding}
	if err := h.DB.Create(&node).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add story node")
		return
	}
	writeJSON(w, http.StatusCreated, node)
}

type addChoiceInput struct {
	ToNodeID   uint   `json:"to_node_id"`
	Label      string `json:"label"`
	OrderIndex int    `json:"order_index"`
}

func (h *Handler) AddStoryChoice(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	storyID, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	fromNodeID, err := strconv.ParseUint(r.PathValue("nodeId"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid node id")
		return
	}

	var story models.Story
	if err := h.DB.First(&story, uint(storyID)).Error; err != nil {
		writeError(w, http.StatusNotFound, "story not found")
		return
	}
	if story.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this story")
		return
	}

	var in addChoiceInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.ToNodeID == 0 || strings.TrimSpace(in.Label) == "" {
		writeError(w, http.StatusBadRequest, "to_node_id and label are required")
		return
	}
	if err := h.screenFields(r.Context(), userID, in.Label); err != nil {
		h.respondModerationError(w, err)
		return
	}

	// Both nodes must belong to this story - otherwise a choice could
	// silently link into someone else's branching graph.
	var nodeCount int64
	h.DB.Model(&models.StoryNode{}).
		Where("story_id = ? AND id IN ?", story.ID, []uint{uint(fromNodeID), in.ToNodeID}).
		Count(&nodeCount)
	if nodeCount != 2 {
		writeError(w, http.StatusBadRequest, "from and to nodes must both belong to this story")
		return
	}

	choice := models.StoryChoice{FromNodeID: uint(fromNodeID), ToNodeID: in.ToNodeID, Label: in.Label, OrderIndex: in.OrderIndex}
	if err := h.DB.Create(&choice).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add choice")
		return
	}
	writeJSON(w, http.StatusCreated, choice)
}

func (h *Handler) ListStories(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePagination(r)
	q := r.URL.Query()

	query := h.DB.Model(&models.Story{}).Where("status = ?", models.StatusPublished)
	if tag := q.Get("tag"); tag != "" {
		query = query.Joins("JOIN ugc_story_tags st ON st.story_id = ugc_stories.id").
			Joins("JOIN ugc_tags t ON t.id = st.tag_id AND t.name = ?", strings.ToLower(tag))
	}
	if categorySlug := q.Get("category"); categorySlug != "" {
		query = query.Joins("JOIN ugc_categories c ON c.id = ugc_stories.category_id AND c.slug = ?", categorySlug)
	}
	if search := strings.TrimSpace(q.Get("q")); search != "" {
		query = query.Where("search_vector @@ plainto_tsquery('english', ?)", search)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count stories")
		return
	}

	var stories []models.Story
	err := query.Preload("Tags").Order("published_at DESC").
		Limit(pageSize).Offset((page - 1) * pageSize).Find(&stories).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list stories")
		return
	}

	summaries := make([]StorySummary, 0, len(stories))
	for _, s := range stories {
		summaries = append(summaries, toStorySummary(s))
	}

	writeJSON(w, http.StatusOK, PaginatedResponse[StorySummary]{
		Data: summaries, Page: page, PageSize: pageSize,
		TotalCount: total, TotalPages: totalPages(total, pageSize),
	})
}

func (h *Handler) GetStory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid story id")
		return
	}

	var story models.Story
	if err := h.DB.Preload("Nodes.Choices").Preload("Tags").Preload("Category").
		First(&story, uint(id)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "story not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load story")
		return
	}

	h.DB.Model(&models.Story{}).Where("id = ?", story.ID).
		UpdateColumn("view_count", gorm.Expr("view_count + 1"))

	tags := make([]string, 0, len(story.Tags))
	for _, t := range story.Tags {
		tags = append(tags, t.Name)
	}
	var categorySlug string
	if story.Category != nil {
		categorySlug = story.Category.Slug
	}

	slots := []string{"ad_slot_above_comments"}
	if len(story.Nodes) > 1 {
		slots = append(slots, "ad_slot_between_story_chapters")
	}

	writeJSON(w, http.StatusOK, StoryDetail{
		Story:       story,
		Disclaimer:  ugcDisclaimer,
		ChatRoomKey: chat.RoomKeyForStory(story.ID),
		Ad:          AdContext{CategorySlug: categorySlug, Tags: tags, Slots: slots},
	})
}

func (h *Handler) DeleteStory(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid story id")
		return
	}
	var story models.Story
	if err := h.DB.First(&story, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "story not found")
		return
	}
	if story.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this story")
		return
	}
	if err := h.DB.Delete(&story).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete story")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PublishStory mirrors PublishQuiz's mandatory ToS-acceptance flow.
func (h *Handler) PublishStory(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid story id")
		return
	}

	var story models.Story
	if err := h.DB.First(&story, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "story not found")
		return
	}
	if story.AuthorID != userID {
		writeError(w, http.StatusForbidden, "not the author of this story")
		return
	}
	if story.StartNodeID == nil {
		writeError(w, http.StatusBadRequest, "story needs a starting node before it can be published")
		return
	}

	var in publishInput
	_ = json.NewDecoder(r.Body).Decode(&in)
	if !in.AcceptTOS || in.TOSVersion != CurrentTOSVersion {
		writeError(w, http.StatusPreconditionRequired, "must accept the current ToS/UGC policy version to publish")
		return
	}

	now := time.Now()
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&models.TOSAcceptance{
			UserID: userID, TOSVersion: in.TOSVersion, Context: models.TOSContextContentPublish,
			IPHash: HashClientIP(r), AcceptedAt: now,
		}).Error; err != nil {
			return err
		}

		story.Status = models.StatusPublished
		story.PublishedAt = &now
		if err := tx.Save(&story).Error; err != nil {
			return err
		}

		newRoom := models.ChatRoom{TargetType: models.TargetStory, TargetID: story.ID, Topic: story.Title}
		return tx.Where(models.ChatRoom{TargetType: models.TargetStory, TargetID: story.ID}).
			FirstOrCreate(&newRoom).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to publish story")
		return
	}

	writeJSON(w, http.StatusOK, story)
}

// ---------------------------------------------------------------------------
// Reports + auto soft-hide threshold
// ---------------------------------------------------------------------------

type reportInput struct {
	TargetType models.TargetType   `json:"target_type"`
	TargetID   uint                `json:"target_id"`
	Reason     models.ReportReason `json:"reason"`
	Details    string              `json:"details"`
}

func (h *Handler) CreateReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	var in reportInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if in.TargetID == 0 || in.TargetType == "" || in.Reason == "" {
		writeError(w, http.StatusBadRequest, "target_type, target_id, and reason are required")
		return
	}

	report := models.Report{
		ReporterID: userID, TargetType: in.TargetType, TargetID: in.TargetID,
		Reason: in.Reason, Details: in.Details, Status: models.ReportStatusPending,
		CreatedAt: time.Now(),
	}
	if err := h.DB.Create(&report).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to file report")
		return
	}

	// The report was recorded either way; a failure here just means the
	// auto-soft-hide check didn't run this time, so it isn't worth
	// failing the user-facing request over.
	if err := h.checkReportThreshold(in.TargetType, in.TargetID); err != nil {
		log.Printf("handlers: report threshold check failed for %s:%d: %v", in.TargetType, in.TargetID, err)
	}

	writeJSON(w, http.StatusCreated, report)
}

// checkReportThreshold implements "if a post receives X reports within Y
// minutes, dynamically unpublish it pending admin review": it counts
// reports for the target within the configured rolling window and, if the
// threshold is met, flips the target's status (or, for chat messages, its
// Hidden flag) and writes an audit-trail ModerationAction. It never deletes
// the underlying content.
func (h *Handler) checkReportThreshold(targetType models.TargetType, targetID uint) error {
	var count int64
	since := time.Now().Add(-h.ReportThreshold.Window)
	if err := h.DB.Model(&models.Report{}).
		Where("target_type = ? AND target_id = ? AND created_at >= ?", targetType, targetID, since).
		Count(&count).Error; err != nil {
		return err
	}
	if count < int64(h.ReportThreshold.MaxReports) {
		return nil
	}

	return h.DB.Transaction(func(tx *gorm.DB) error {
		switch targetType {
		case models.TargetQuiz:
			res := tx.Model(&models.Quiz{}).
				Where("id = ? AND status = ?", targetID, models.StatusPublished).
				Update("status", models.StatusUnderReview)
			if res.Error != nil || res.RowsAffected == 0 {
				return res.Error
			}
		case models.TargetStory:
			res := tx.Model(&models.Story{}).
				Where("id = ? AND status = ?", targetID, models.StatusPublished).
				Update("status", models.StatusUnderReview)
			if res.Error != nil || res.RowsAffected == 0 {
				return res.Error
			}
		case models.TargetChatMessage:
			res := tx.Model(&models.ChatMessage{}).
				Where("id = ? AND hidden = ?", targetID, false).
				Updates(map[string]interface{}{"hidden": true, "hidden_reason": "auto-hidden: report threshold reached"})
			if res.Error != nil || res.RowsAffected == 0 {
				return res.Error
			}
		default:
			return nil
		}

		return tx.Create(&models.ModerationAction{
			TargetType: targetType, TargetID: targetID, Action: models.ActionAutoSoftHide,
			Reason:    fmt.Sprintf("received %d+ reports within %s", h.ReportThreshold.MaxReports, h.ReportThreshold.Window),
			CreatedAt: time.Now(),
		}).Error
	})
}

// ---------------------------------------------------------------------------
// DMCA
// ---------------------------------------------------------------------------

type dmcaInput struct {
	TargetType                 models.TargetType `json:"target_type"`
	TargetID                   uint              `json:"target_id"`
	ClaimantName               string            `json:"claimant_name"`
	ClaimantEmail              string            `json:"claimant_email"`
	ClaimantAddress            string            `json:"claimant_address"`
	CopyrightedWorkDescription string            `json:"copyrighted_work_description"`
	InfringingMaterialLocation string            `json:"infringing_material_location"`
	GoodFaithStatement         bool              `json:"good_faith_statement"`
	AccuracyPerjuryStatement   bool              `json:"accuracy_perjury_statement"`
	ElectronicSignature        string            `json:"electronic_signature"`
}

// SubmitDMCANotice accepts a takedown notice and, if it is facially
// complete (every statutory field present, both required statements
// affirmed), immediately moves the target content to StatusRemoved and
// logs a ModerationAction - standard "act expeditiously, review after"
// practice. Nothing is deleted; ReviewDMCANotice can reinstate the content
// later. This endpoint intentionally allows unauthenticated requests, since
// most real-world claimants aren't platform account holders. Collecting
// these fields is not the same as having DMCA safe harbor - that also
// requires a designated agent registered with the US Copyright Office; see
// the DMCANotice doc comment in server/models/ugc.go.
func (h *Handler) SubmitDMCANotice(w http.ResponseWriter, r *http.Request) {
	var in dmcaInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	var missing []string
	if strings.TrimSpace(in.ClaimantName) == "" {
		missing = append(missing, "claimant_name")
	}
	if strings.TrimSpace(in.ClaimantEmail) == "" {
		missing = append(missing, "claimant_email")
	}
	if strings.TrimSpace(in.CopyrightedWorkDescription) == "" {
		missing = append(missing, "copyrighted_work_description")
	}
	if strings.TrimSpace(in.InfringingMaterialLocation) == "" {
		missing = append(missing, "infringing_material_location")
	}
	if strings.TrimSpace(in.ElectronicSignature) == "" {
		missing = append(missing, "electronic_signature")
	}
	if !in.GoodFaithStatement {
		missing = append(missing, "good_faith_statement")
	}
	if !in.AccuracyPerjuryStatement {
		missing = append(missing, "accuracy_perjury_statement")
	}
	if in.TargetID == 0 || in.TargetType == "" {
		missing = append(missing, "target_type/target_id")
	}
	if len(missing) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "notice is missing required statutory fields", "missing": missing,
		})
		return
	}

	notice := models.DMCANotice{
		TargetType: in.TargetType, TargetID: in.TargetID,
		ClaimantName: in.ClaimantName, ClaimantEmail: in.ClaimantEmail, ClaimantAddress: in.ClaimantAddress,
		CopyrightedWorkDescription: in.CopyrightedWorkDescription,
		InfringingMaterialLocation: in.InfringingMaterialLocation,
		GoodFaithStatement:         in.GoodFaithStatement,
		AccuracyPerjuryStatement:   in.AccuracyPerjuryStatement,
		ElectronicSignature:        in.ElectronicSignature,
		Status:                     models.DMCAReceived,
		CreatedAt:                  time.Now(),
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&notice).Error; err != nil {
			return err
		}

		var statusErr error
		switch in.TargetType {
		case models.TargetQuiz:
			statusErr = tx.Model(&models.Quiz{}).Where("id = ?", in.TargetID).Update("status", models.StatusRemoved).Error
		case models.TargetStory:
			statusErr = tx.Model(&models.Story{}).Where("id = ?", in.TargetID).Update("status", models.StatusRemoved).Error
		case models.TargetStoryNode, models.TargetChatMessage:
			// No independent publish state to flip for these target
			// types (a node inherits its story's status; a chat message
			// uses Hidden, not Status). The notice and moderation action
			// are still recorded; suppress these manually via the admin
			// review flow.
		}
		if statusErr != nil {
			return statusErr
		}

		notice.Status = models.DMCAContentRemoved
		if err := tx.Save(&notice).Error; err != nil {
			return err
		}

		return tx.Create(&models.ModerationAction{
			TargetType: in.TargetType, TargetID: in.TargetID, Action: models.ActionDMCATakedown,
			Reason:              "DMCA takedown notice received",
			RelatedDMCANoticeID: &notice.ID,
			CreatedAt:           time.Now(),
		}).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to process DMCA notice")
		return
	}

	writeJSON(w, http.StatusAccepted, notice)
}

type dmcaReviewInput struct {
	Status     models.DMCAStatus `json:"status"` // "reinstated" or "rejected" restores content; other values just update status
	AuditNotes string            `json:"audit_notes"`
}

// ReviewDMCANotice lets an admin resolve a notice, reinstating content if
// it's rejected or successfully counter-noticed. This handler does not
// check for admin/moderator privileges itself - gate its route with your
// own role-check middleware before wiring it in.
func (h *Handler) ReviewDMCANotice(w http.ResponseWriter, r *http.Request) {
	reviewerID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid notice id")
		return
	}
	var in dmcaReviewInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	var notice models.DMCANotice
	if err := h.DB.First(&notice, uint(id)).Error; err != nil {
		writeError(w, http.StatusNotFound, "notice not found")
		return
	}

	now := time.Now()
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		notice.Status = in.Status
		notice.AuditNotes = in.AuditNotes
		notice.ReviewedBy = &reviewerID
		notice.ReviewedAt = &now
		if err := tx.Save(&notice).Error; err != nil {
			return err
		}

		if in.Status != models.DMCAReinstated && in.Status != models.DMCARejected {
			return nil
		}

		var restoreErr error
		switch notice.TargetType {
		case models.TargetQuiz:
			restoreErr = tx.Model(&models.Quiz{}).Where("id = ?", notice.TargetID).Update("status", models.StatusPublished).Error
		case models.TargetStory:
			restoreErr = tx.Model(&models.Story{}).Where("id = ?", notice.TargetID).Update("status", models.StatusPublished).Error
		}
		if restoreErr != nil {
			return restoreErr
		}

		return tx.Create(&models.ModerationAction{
			TargetType: notice.TargetType, TargetID: notice.TargetID, Action: models.ActionRestore,
			Reason:              "DMCA notice " + string(in.Status),
			TriggeredByUserID:   &reviewerID,
			RelatedDMCANoticeID: &notice.ID,
			CreatedAt:           now,
		}).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update notice")
		return
	}

	writeJSON(w, http.StatusOK, notice)
}

// ---------------------------------------------------------------------------
// ToS acceptance at account creation
// ---------------------------------------------------------------------------

type acceptTOSInput struct {
	TOSVersion string `json:"tos_version"`
}

func (h *Handler) AcceptTOS(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	var in acceptTOSInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || strings.TrimSpace(in.TOSVersion) == "" {
		writeError(w, http.StatusBadRequest, "tos_version is required")
		return
	}

	acceptance := models.TOSAcceptance{
		UserID: userID, TOSVersion: in.TOSVersion, Context: models.TOSContextAccountCreation,
		IPHash: HashClientIP(r), AcceptedAt: time.Now(),
	}
	if err := h.DB.Create(&acceptance).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record ToS acceptance")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "accepted"})
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

// RegisterRoutes wires every handler in this file onto mux using Go 1.22's
// method-aware ServeMux patterns. This function only does routing - layer
// your own auth middleware (setting middleware.WithUserID on the request
// context), middleware.RequireCleanContent where it fits, and a role check
// in front of ReviewDMCANotice before exposing this mux publicly.
func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("POST /api/v1/quizzes", h.CreateQuiz)
	mux.HandleFunc("GET /api/v1/quizzes", h.ListQuizzes)
	mux.HandleFunc("GET /api/v1/quizzes/{id}", h.GetQuiz)
	mux.HandleFunc("PUT /api/v1/quizzes/{id}", h.UpdateQuiz)
	mux.HandleFunc("DELETE /api/v1/quizzes/{id}", h.DeleteQuiz)
	mux.HandleFunc("POST /api/v1/quizzes/{id}/publish", h.PublishQuiz)

	mux.HandleFunc("POST /api/v1/stories", h.CreateStory)
	mux.HandleFunc("GET /api/v1/stories", h.ListStories)
	mux.HandleFunc("GET /api/v1/stories/{id}", h.GetStory)
	mux.HandleFunc("DELETE /api/v1/stories/{id}", h.DeleteStory)
	mux.HandleFunc("POST /api/v1/stories/{id}/publish", h.PublishStory)
	mux.HandleFunc("POST /api/v1/stories/{id}/nodes", h.AddStoryNode)
	mux.HandleFunc("POST /api/v1/stories/{id}/nodes/{nodeId}/choices", h.AddStoryChoice)

	mux.HandleFunc("POST /api/v1/reports", h.CreateReport)
	mux.HandleFunc("POST /api/v1/dmca", h.SubmitDMCANotice)
	mux.HandleFunc("POST /api/v1/dmca/{id}/review", h.ReviewDMCANotice)
	mux.HandleFunc("POST /api/v1/tos/accept", h.AcceptTOS)
}
