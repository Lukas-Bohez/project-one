-- 0001_ugc_schema.down.sql
-- Reverses 0001_ugc_schema.up.sql. `users` is intentionally left in place -
-- other parts of the backend may depend on it; drop it manually if this
-- migration truly owns that table in your deployment.

DROP TABLE IF EXISTS user_tos_acceptances CASCADE;
DROP TABLE IF EXISTS ugc_moderation_actions CASCADE;
DROP TABLE IF EXISTS ugc_dmca_notices CASCADE;
DROP TABLE IF EXISTS ugc_reports CASCADE;
DROP TABLE IF EXISTS ugc_chat_messages CASCADE;
DROP TABLE IF EXISTS ugc_chat_rooms CASCADE;
DROP TABLE IF EXISTS ugc_story_choices CASCADE;
ALTER TABLE IF EXISTS ugc_stories DROP CONSTRAINT IF EXISTS fk_ugc_stories_start_node;
DROP TABLE IF EXISTS ugc_story_nodes CASCADE;
DROP TABLE IF EXISTS ugc_story_tags CASCADE;
DROP TABLE IF EXISTS ugc_stories CASCADE;
DROP TABLE IF EXISTS ugc_answers CASCADE;
DROP TABLE IF EXISTS ugc_questions CASCADE;
DROP TABLE IF EXISTS ugc_quiz_tags CASCADE;
DROP TABLE IF EXISTS ugc_quizzes CASCADE;
DROP TABLE IF EXISTS ugc_tags CASCADE;
DROP TABLE IF EXISTS ugc_categories CASCADE;
