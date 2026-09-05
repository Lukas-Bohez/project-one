// Package models defines the database schema for Quiz The Spire's
// user-generated content: accounts, community-submitted quizzes and
// branching stories, live chat, and the report/moderation/DMCA/consent
// records that back the legal-safety layer in server/middleware and
// server/handlers.
//
// Table naming: everything new in this file is prefixed ugc_ (ugc_quizzes,
// ugc_stories, ...) specifically to avoid colliding with any existing
// `quizzes`/`questions`/`answers` tables from the Study Quiz Python backend —
// that content is curated by you, not user-submitted, and is a different
// domain even if the words overlap. Two exceptions: `users`, because it's
// meant to be the one account table for the whole site, and
// `user_tos_acceptances`, whose name was specified directly. If a `users`
// table already exists elsewhere in the backend, treat this struct as the
// shape the rest of this file expects via foreign key (author_id, user_id,
// ...) rather than as a mandate to create a duplicate — rename or drop it
// and point the foreign keys at what already exists.
//
// Matching SQL migration: server/migrations/0001_ugc_schema.up.sql.
package models

import (
	"time"

	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Enums (plain strings + constants rather than DB-native enum types, so new
// values don't require an ALTER TYPE later — validity is still enforced at
// the DB layer via CHECK constraints in the migration).
// ---------------------------------------------------------------------------

// ContentStatus is the publication lifecycle for a Quiz or Story.
type ContentStatus string

const (
	StatusDraft       ContentStatus = "draft"
	StatusPublished   ContentStatus = "published"
	StatusUnderReview ContentStatus = "under_review" // auto soft-hidden pending admin review
	StatusRemoved     ContentStatus = "removed"      // DMCA takedown or manual removal; audit trail preserved
)

// TargetType identifies what kind of content a Report, ModerationAction, or
// DMCANotice is about.
type TargetType string

const (
	TargetQuiz        TargetType = "quiz"
	TargetStory       TargetType = "story"
	TargetStoryNode   TargetType = "story_node"
	TargetChatMessage TargetType = "chat_message"
)

// QuestionType is the answer format for a quiz Question.
type QuestionType string

const (
	QuestionSingleChoice QuestionType = "single_choice"
	QuestionMultiChoice  QuestionType = "multi_choice"
	QuestionTrueFalse    QuestionType = "true_false"
)

// ReportReason is the reporter's stated reason for flagging content.
type ReportReason string

const (
	ReportSpam           ReportReason = "spam"
	ReportHarassment     ReportReason = "harassment"
	ReportIllegalContent ReportReason = "illegal_content"
	ReportCopyright      ReportReason = "copyright"
	ReportOther          ReportReason = "other"
)

// ReportStatus tracks a Report through admin review.
type ReportStatus string

const (
	ReportStatusPending   ReportStatus = "pending"
	ReportStatusReviewed  ReportStatus = "reviewed"
	ReportStatusActioned  ReportStatus = "actioned"
	ReportStatusDismissed ReportStatus = "dismissed"
)

// ModerationActionType is what happened to a piece of content, for the
// audit log. Rows here are never deleted, and taking an action never
// deletes the underlying content row either — it only changes its Status.
type ModerationActionType string

const (
	ActionAutoSoftHide     ModerationActionType = "auto_soft_hide" // report-threshold triggered
	ActionManualHide       ModerationActionType = "manual_hide"
	ActionRestore          ModerationActionType = "restore"
	ActionDMCATakedown     ModerationActionType = "dmca_takedown"
	ActionPermanentRemoval ModerationActionType = "permanent_removal"
)

// DMCAStatus tracks a takedown notice through the notice-and-counter-notice
// process.
type DMCAStatus string

const (
	DMCAReceived              DMCAStatus = "received"
	DMCAUnderReview           DMCAStatus = "under_review"
	DMCAContentRemoved        DMCAStatus = "content_removed"
	DMCACounterNoticeReceived DMCAStatus = "counter_notice_received"
	DMCAReinstated            DMCAStatus = "reinstated"
	DMCARejected              DMCAStatus = "rejected"
)

// TOSContext records which mandatory-agreement moment produced a
// TOSAcceptance row.
type TOSContext string

const (
	TOSContextAccountCreation TOSContext = "account_creation"
	TOSContextContentPublish  TOSContext = "content_publish"
)

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// UGCUser is the minimal account shape the rest of this file's foreign keys
// depend on. PasswordHash is exactly that — a bcrypt/argon2 hash computed
// upstream of this model; no hashing happens here, and this file has no
// opinion on session vs JWT auth (see the Authenticator seam in
// server/chat/hub.go and UserIDFromContext in server/handlers/ugc_crud.go).
type UGCUser struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Username     string `gorm:"size:32;uniqueIndex;not null" json:"username"`
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"-"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	DisplayName  string `gorm:"size:64" json:"display_name"`
	IsAdmin      bool   `gorm:"default:false" json:"-"`
	IsBanned     bool   `gorm:"default:false;index" json:"-"`
	BannedReason string `gorm:"size:255" json:"-"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"-"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ---------------------------------------------------------------------------
// Taxonomy: Category is a small controlled vocabulary used for browsing AND
// ad-exchange content targeting. Tag is free-er-form, user-driven, used for
// filtering. Keeping them separate means ad targeting doesn't get noisy junk
// tags, and tag filtering doesn't get stuck with a fixed category list.
// ---------------------------------------------------------------------------

type Category struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:64;uniqueIndex;not null" json:"name"`
	Slug string `gorm:"size:64;uniqueIndex;not null" json:"slug"`
}

func (Category) TableName() string { return "ugc_categories" }

type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:48;uniqueIndex;not null" json:"name"`
}

func (Tag) TableName() string { return "ugc_tags" }

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

type Quiz struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	AuthorID    uint          `gorm:"index;not null" json:"author_id"`
	Author      UGCUser        `gorm:"foreignKey:AuthorID" json:"-"`
	CategoryID  *uint         `gorm:"index" json:"category_id,omitempty"`
	Category    *Category     `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Title       string        `gorm:"size:150;not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	Status      ContentStatus `gorm:"size:20;index;default:draft;not null" json:"status"`
	ViewCount   int64         `gorm:"default:0;not null" json:"view_count"`

	Tags      []Tag      `gorm:"many2many:ugc_quiz_tags;" json:"tags,omitempty"`
	Questions []UGCQuestion `gorm:"constraint:OnDelete:CASCADE;" json:"questions,omitempty"`

	PublishedAt *time.Time     `json:"published_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Quiz) TableName() string { return "ugc_quizzes" }

type UGCQuestion struct {
	ID         uint         `gorm:"primaryKey" json:"id"`
	QuizID     uint         `gorm:"index;not null" json:"quiz_id"`
	Prompt     string       `gorm:"type:text;not null" json:"prompt"`
	Type       QuestionType `gorm:"size:20;not null;default:single_choice" json:"type"`
	OrderIndex int          `gorm:"not null;default:0" json:"order_index"`
	Answers    []UGCAnswer  `gorm:"constraint:OnDelete:CASCADE;" json:"answers,omitempty"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

func (UGCQuestion) TableName() string { return "ugc_questions" }

type UGCAnswer struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	QuestionID uint   `gorm:"index;not null" json:"question_id"`
	Text       string `gorm:"type:text;not null" json:"text"`
	IsCorrect  bool   `gorm:"not null;default:false" json:"is_correct"`
	OrderIndex int    `gorm:"not null;default:0" json:"order_index"`
}

func (UGCAnswer) TableName() string { return "ugc_answers" }

// ---------------------------------------------------------------------------
// Branching stories: a Story is a graph of StoryNodes connected by
// StoryChoices. StartNodeID is the entry point; a node with no outgoing
// choices (IsEnding) is a leaf. This supports arbitrary branching and
// reconverging paths, not just a linear chapter list.
// ---------------------------------------------------------------------------

type Story struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	AuthorID    uint          `gorm:"index;not null" json:"author_id"`
	Author      UGCUser        `gorm:"foreignKey:AuthorID" json:"-"`
	CategoryID  *uint         `gorm:"index" json:"category_id,omitempty"`
	Category    *Category     `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Title       string        `gorm:"size:150;not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	Status      ContentStatus `gorm:"size:20;index;default:draft;not null" json:"status"`
	ViewCount   int64         `gorm:"default:0;not null" json:"view_count"`
	StartNodeID *uint         `gorm:"index" json:"start_node_id,omitempty"`

	Tags  []Tag       `gorm:"many2many:ugc_story_tags;" json:"tags,omitempty"`
	Nodes []StoryNode `gorm:"constraint:OnDelete:CASCADE;" json:"nodes,omitempty"`

	PublishedAt *time.Time     `json:"published_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Story) TableName() string { return "ugc_stories" }

type StoryNode struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	StoryID   uint          `gorm:"index;not null" json:"story_id"`
	Title     string        `gorm:"size:150" json:"title"`
	Content   string        `gorm:"type:text;not null" json:"content"`
	IsEnding  bool          `gorm:"not null;default:false" json:"is_ending"`
	Choices   []StoryChoice `gorm:"foreignKey:FromNodeID;constraint:OnDelete:CASCADE;" json:"choices,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

func (StoryNode) TableName() string { return "ugc_story_nodes" }

type StoryChoice struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	FromNodeID uint   `gorm:"index;not null" json:"from_node_id"`
	ToNodeID   uint   `gorm:"index;not null" json:"to_node_id"`
	Label      string `gorm:"size:200;not null" json:"label"`
	OrderIndex int    `gorm:"not null;default:0" json:"order_index"`
}

func (StoryChoice) TableName() string { return "ugc_story_choices" }

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

type ChatRoom struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	TargetType TargetType `gorm:"size:20;index;not null" json:"target_type"`
	TargetID   uint       `gorm:"index;not null" json:"target_id"`
	Topic      string     `gorm:"size:150" json:"topic"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (ChatRoom) TableName() string { return "ugc_chat_rooms" }

// ChatMessage uses a Hidden flag rather than GORM's soft-delete for
// moderation: a moderator hiding a message should keep it queryable for
// admin review and the audit log, not vanish from every query the way
// gorm.DeletedAt would make it.
type ChatMessage struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	RoomID       uint      `gorm:"index;not null" json:"room_id"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	Content      string    `gorm:"type:text;not null" json:"content"`
	Hidden       bool      `gorm:"not null;default:false;index" json:"hidden"`
	HiddenReason string    `gorm:"size:255" json:"hidden_reason,omitempty"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

func (ChatMessage) TableName() string { return "ugc_chat_messages" }

// ---------------------------------------------------------------------------
// Reports, moderation audit log, DMCA notices, ToS consent
// ---------------------------------------------------------------------------

type Report struct {
	ID         uint         `gorm:"primaryKey" json:"id"`
	ReporterID uint         `gorm:"index;not null" json:"reporter_id"`
	TargetType TargetType   `gorm:"size:20;index;not null" json:"target_type"`
	TargetID   uint         `gorm:"index;not null" json:"target_id"`
	Reason     ReportReason `gorm:"size:30;not null" json:"reason"`
	Details    string       `gorm:"type:text" json:"details,omitempty"`
	Status     ReportStatus `gorm:"size:20;index;default:pending;not null" json:"status"`
	ReviewedBy *uint        `json:"reviewed_by,omitempty"`
	ReviewedAt *time.Time   `json:"reviewed_at,omitempty"`
	CreatedAt  time.Time    `gorm:"index" json:"created_at"`
}

func (Report) TableName() string { return "ugc_reports" }

// ModerationAction is the append-only audit trail. Nothing in this codebase
// should ever delete a row here, and a row here should never correspond to
// a deleted content row — only a Status change (see ContentStatus).
type ModerationAction struct {
	ID                  uint                 `gorm:"primaryKey" json:"id"`
	TargetType          TargetType           `gorm:"size:20;index;not null" json:"target_type"`
	TargetID            uint                 `gorm:"index;not null" json:"target_id"`
	Action              ModerationActionType `gorm:"size:30;not null" json:"action"`
	Reason              string               `gorm:"type:text" json:"reason,omitempty"`
	TriggeredByUserID   *uint                `json:"triggered_by_user_id,omitempty"` // nil = automated/system action
	RelatedReportID     *uint                `json:"related_report_id,omitempty"`
	RelatedDMCANoticeID *uint                `json:"related_dmca_notice_id,omitempty"`
	CreatedAt           time.Time            `gorm:"index" json:"created_at"`
}

func (ModerationAction) TableName() string { return "ugc_moderation_actions" }

// DMCANotice's required fields mirror the statutory elements of a valid
// takedown notice under 17 U.S.C. Section 512(c)(3)(A): identification of
// the copyrighted work, identification/location of the allegedly infringing
// material, a good-faith statement, and a statement of accuracy made under
// penalty of perjury with a signature. Collecting these fields is not the
// same as having DMCA safe harbor — that also requires registering a
// designated agent with the US Copyright Office and following the
// counter-notice procedure; this table just gives you a correctly-shaped,
// audit-preserving record to act on.
type DMCANotice struct {
	ID                         uint       `gorm:"primaryKey" json:"id"`
	TargetType                 TargetType `gorm:"size:20;index;not null" json:"target_type"`
	TargetID                   uint       `gorm:"index;not null" json:"target_id"`
	ClaimantName               string     `gorm:"size:150;not null" json:"claimant_name"`
	ClaimantEmail              string     `gorm:"size:255;not null" json:"claimant_email"`
	ClaimantAddress            string     `gorm:"type:text" json:"claimant_address,omitempty"`
	CopyrightedWorkDescription string     `gorm:"type:text;not null" json:"copyrighted_work_description"`
	InfringingMaterialLocation string     `gorm:"type:text;not null" json:"infringing_material_location"`
	GoodFaithStatement         bool       `gorm:"not null" json:"good_faith_statement"`
	AccuracyPerjuryStatement   bool       `gorm:"not null" json:"accuracy_perjury_statement"`
	ElectronicSignature        string     `gorm:"size:255;not null" json:"electronic_signature"`
	Status                     DMCAStatus `gorm:"size:30;index;default:received;not null" json:"status"`
	ReviewedBy                 *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt                 *time.Time `json:"reviewed_at,omitempty"`
	AuditNotes                 string     `gorm:"type:text" json:"audit_notes,omitempty"`
	CreatedAt                  time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt                  time.Time  `json:"updated_at"`
}

func (DMCANotice) TableName() string { return "ugc_dmca_notices" }

// TOSAcceptance records mandatory ToS/UGC-policy agreement at both account
// creation and content publication, per the spec. IPHash is a SHA-256 hash
// of the client IP plus a server-side pepper (see
// handlers.HashClientIP) — never store the raw IP.
type TOSAcceptance struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"index;not null" json:"user_id"`
	TOSVersion string     `gorm:"size:20;not null" json:"tos_version"`
	Context    TOSContext `gorm:"size:30;not null" json:"context"`
	IPHash     string     `gorm:"size:64;not null" json:"-"`
	AcceptedAt time.Time  `gorm:"not null;index" json:"accepted_at"`
}

func (TOSAcceptance) TableName() string { return "user_tos_acceptances" }

// AllModels is every struct in this file, for a one-line
// db.AutoMigrate(models.AllModels...) during local development. In
// production, prefer the versioned SQL in server/migrations/ — AutoMigrate
// can add columns and indexes but won't safely handle destructive changes,
// so it's a convenience for dev/test databases, not a migration strategy.
var AllModels = []interface{}{
	&UGCUser{}, &Category{}, &Tag{},
	&Quiz{}, &UGCQuestion{}, &UGCAnswer{},
	&Story{}, &StoryNode{}, &StoryChoice{},
	&ChatRoom{}, &ChatMessage{},
	&Report{}, &ModerationAction{}, &DMCANotice{}, &TOSAcceptance{},
}
