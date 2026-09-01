-- 0001_ugc_schema.up.sql
-- Requires PostgreSQL 12+ (generated STORED columns, used for full-text
-- search on quizzes and stories).
--
-- Table names are prefixed ugc_ throughout (except `users` and
-- `user_tos_acceptances`) specifically to avoid colliding with any existing
-- Study Quiz tables from the Python backend - see the naming note at the
-- top of server/models/ugc.go. If `users` already exists, drop the CREATE
-- TABLE below and point the foreign keys in this file at what's there.

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(64),
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
    banned_reason VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);

CREATE TABLE IF NOT EXISTS ugc_categories (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    slug VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ugc_tags (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(48) NOT NULL UNIQUE
);

-- Quizzes -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ugc_quizzes (
    id            BIGSERIAL PRIMARY KEY,
    author_id     BIGINT NOT NULL REFERENCES users(id),
    category_id   BIGINT REFERENCES ugc_categories(id),
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'under_review', 'removed')),
    view_count    BIGINT NOT NULL DEFAULT 0,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED
);
CREATE INDEX IF NOT EXISTS idx_ugc_quizzes_author     ON ugc_quizzes (author_id);
CREATE INDEX IF NOT EXISTS idx_ugc_quizzes_status      ON ugc_quizzes (status);
CREATE INDEX IF NOT EXISTS idx_ugc_quizzes_deleted_at  ON ugc_quizzes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_ugc_quizzes_search      ON ugc_quizzes USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS ugc_quiz_tags (
    quiz_id BIGINT NOT NULL REFERENCES ugc_quizzes(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES ugc_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (quiz_id, tag_id)
);

CREATE TABLE IF NOT EXISTS ugc_questions (
    id          BIGSERIAL PRIMARY KEY,
    quiz_id     BIGINT NOT NULL REFERENCES ugc_quizzes(id) ON DELETE CASCADE,
    prompt      TEXT NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'single_choice'
                CHECK (type IN ('single_choice', 'multi_choice', 'true_false')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_questions_quiz ON ugc_questions (quiz_id);

CREATE TABLE IF NOT EXISTS ugc_answers (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES ugc_questions(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ugc_answers_question ON ugc_answers (question_id);

-- Branching stories -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ugc_stories (
    id            BIGSERIAL PRIMARY KEY,
    author_id     BIGINT NOT NULL REFERENCES users(id),
    category_id   BIGINT REFERENCES ugc_categories(id),
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'under_review', 'removed')),
    view_count    BIGINT NOT NULL DEFAULT 0,
    start_node_id BIGINT,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED
);
CREATE INDEX IF NOT EXISTS idx_ugc_stories_author    ON ugc_stories (author_id);
CREATE INDEX IF NOT EXISTS idx_ugc_stories_status     ON ugc_stories (status);
CREATE INDEX IF NOT EXISTS idx_ugc_stories_deleted_at ON ugc_stories (deleted_at);
CREATE INDEX IF NOT EXISTS idx_ugc_stories_search     ON ugc_stories USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS ugc_story_tags (
    story_id BIGINT NOT NULL REFERENCES ugc_stories(id) ON DELETE CASCADE,
    tag_id   BIGINT NOT NULL REFERENCES ugc_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, tag_id)
);

CREATE TABLE IF NOT EXISTS ugc_story_nodes (
    id         BIGSERIAL PRIMARY KEY,
    story_id   BIGINT NOT NULL REFERENCES ugc_stories(id) ON DELETE CASCADE,
    title      VARCHAR(150),
    content    TEXT NOT NULL,
    is_ending  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_story_nodes_story ON ugc_story_nodes (story_id);

-- Deferred FK: ugc_stories.start_node_id references a row in a table that
-- doesn't exist until after ugc_stories itself is created.
ALTER TABLE ugc_stories
    ADD CONSTRAINT fk_ugc_stories_start_node
    FOREIGN KEY (start_node_id) REFERENCES ugc_story_nodes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ugc_story_choices (
    id           BIGSERIAL PRIMARY KEY,
    from_node_id BIGINT NOT NULL REFERENCES ugc_story_nodes(id) ON DELETE CASCADE,
    to_node_id   BIGINT NOT NULL REFERENCES ugc_story_nodes(id) ON DELETE CASCADE,
    label        VARCHAR(200) NOT NULL,
    order_index  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ugc_story_choices_from ON ugc_story_choices (from_node_id);

-- Chat ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ugc_chat_rooms (
    id          BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('quiz', 'story')),
    target_id   BIGINT NOT NULL,
    topic       VARCHAR(150),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS ugc_chat_messages (
    id            BIGSERIAL PRIMARY KEY,
    room_id       BIGINT NOT NULL REFERENCES ugc_chat_rooms(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    content       TEXT NOT NULL,
    hidden        BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_reason VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_chat_messages_room   ON ugc_chat_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ugc_chat_messages_hidden ON ugc_chat_messages (hidden);

-- Reports, moderation audit log, DMCA, ToS consent ----------------------------

CREATE TABLE IF NOT EXISTS ugc_reports (
    id          BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users(id),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('quiz', 'story', 'story_node', 'chat_message')),
    target_id   BIGINT NOT NULL,
    reason      VARCHAR(30) NOT NULL CHECK (reason IN ('spam', 'harassment', 'illegal_content', 'copyright', 'other')),
    details     TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_reports_target ON ugc_reports (target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ugc_reports_status ON ugc_reports (status);

CREATE TABLE IF NOT EXISTS ugc_dmca_notices (
    id                            BIGSERIAL PRIMARY KEY,
    target_type                   VARCHAR(20) NOT NULL,
    target_id                     BIGINT NOT NULL,
    claimant_name                 VARCHAR(150) NOT NULL,
    claimant_email                VARCHAR(255) NOT NULL,
    claimant_address              TEXT,
    copyrighted_work_description  TEXT NOT NULL,
    infringing_material_location  TEXT NOT NULL,
    good_faith_statement          BOOLEAN NOT NULL,
    accuracy_perjury_statement    BOOLEAN NOT NULL,
    electronic_signature          VARCHAR(255) NOT NULL,
    status                        VARCHAR(30) NOT NULL DEFAULT 'received'
                                   CHECK (status IN ('received', 'under_review', 'content_removed',
                                                      'counter_notice_received', 'reinstated', 'rejected')),
    reviewed_by                   BIGINT REFERENCES users(id),
    reviewed_at                   TIMESTAMPTZ,
    audit_notes                   TEXT,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_dmca_notices_target ON ugc_dmca_notices (target_type, target_id);

CREATE TABLE IF NOT EXISTS ugc_moderation_actions (
    id                     BIGSERIAL PRIMARY KEY,
    target_type            VARCHAR(20) NOT NULL,
    target_id              BIGINT NOT NULL,
    action                 VARCHAR(30) NOT NULL
                           CHECK (action IN ('auto_soft_hide', 'manual_hide', 'restore',
                                              'dmca_takedown', 'permanent_removal')),
    reason                 TEXT,
    triggered_by_user_id   BIGINT REFERENCES users(id),
    related_report_id      BIGINT REFERENCES ugc_reports(id),
    related_dmca_notice_id BIGINT REFERENCES ugc_dmca_notices(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ugc_moderation_actions_target ON ugc_moderation_actions (target_type, target_id, created_at);

CREATE TABLE IF NOT EXISTS user_tos_acceptances (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    tos_version VARCHAR(20) NOT NULL,
    context     VARCHAR(30) NOT NULL CHECK (context IN ('account_creation', 'content_publish')),
    ip_hash     VARCHAR(64) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_tos_acceptances_user ON user_tos_acceptances (user_id, accepted_at);
