-- Temporarily disable safe updates and foreign key checks for migration
SET @old_sql_safe_updates := @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;
SET @old_foreign_key_checks := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;
SET @stories_exists := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'stories'
);
SET @sql_create_stories := IF(@stories_exists = 0,
    'CREATE TABLE stories (\n'
    '    id INT AUTO_INCREMENT PRIMARY KEY,\n'
    '    name VARCHAR(255) NOT NULL,\n'
    '    slug VARCHAR(255) UNIQUE,\n'
    '    description TEXT,\n'
    '    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n'
    '    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n'
    '    UNIQUE KEY uq_story_name (name)\n'
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1'
);
PREPARE stmt_create_stories FROM @sql_create_stories; EXECUTE stmt_create_stories; DEALLOCATE PREPARE stmt_create_stories;

-- Add story_id column if missing
SET @story_id_col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'story_id'
);
SET @sql_add_story_id := IF(@story_id_col_exists = 0,
    'ALTER TABLE articles ADD COLUMN story_id INT NULL AFTER story',
    'SELECT 1'
);
PREPARE stmt_add_story_id FROM @sql_add_story_id; EXECUTE stmt_add_story_id; DEALLOCATE PREPARE stmt_add_story_id;

-- Add story_order column if missing
SET @story_order_col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'story_order'
);
SET @sql_add_story_order := IF(@story_order_col_exists = 0,
    'ALTER TABLE articles ADD COLUMN story_order INT NOT NULL DEFAULT 0 AFTER story_id',
    'SELECT 1'
);
PREPARE stmt_add_story_order FROM @sql_add_story_order; EXECUTE stmt_add_story_order; DEALLOCATE PREPARE stmt_add_story_order;

-- Ensure index on story_id exists
SET @idx_story_id_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND INDEX_NAME = 'idx_story_id'
);
SET @sql_idx_story_id := IF(@idx_story_id_exists = 0,
    'CREATE INDEX idx_story_id ON articles(story_id)',
    'SELECT 1'
);
PREPARE stmt_idx1 FROM @sql_idx_story_id; EXECUTE stmt_idx1; DEALLOCATE PREPARE stmt_idx1;

-- Conditionally add FK only if it doesn't already exist
SET @fk_exists := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'story_id'
      AND REFERENCED_TABLE_NAME = 'stories'
);
SET @sql_fk := IF(@fk_exists = 0,
    'ALTER TABLE articles ADD CONSTRAINT fk_articles_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk; EXECUTE stmt_fk; DEALLOCATE PREPARE stmt_fk;

-- 3) Backfill: create stories from distinct legacy story text values
INSERT INTO stories (name, slug)
SELECT DISTINCT s.legacy_name, LOWER(REPLACE(REPLACE(REPLACE(s.legacy_name, ' ', '-'), '_', '-'), '--', '-'))
FROM (
    SELECT DISTINCT TRIM(story) AS legacy_name FROM articles WHERE story IS NOT NULL AND TRIM(story) <> ''
) s
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4) Set story_id on articles by matching legacy story name
UPDATE articles a
JOIN stories s ON s.name = a.story
SET a.story_id = s.id
WHERE a.story IS NOT NULL AND a.story_id IS NULL;

-- 5) Compute story_order within each story by created_at (or id if null)
-- Portable approach using variables (works across MySQL 5.7/8.0)
SET @prev_story := NULL; SET @rn := -1;
UPDATE articles a
JOIN (
    SELECT id,
           CASE WHEN @prev_story = story_id THEN @rn := @rn + 1 ELSE @rn := 0 END AS rn,
           @prev_story := story_id AS _ps
    FROM (
        SELECT id, story_id
        FROM articles
        WHERE story_id IS NOT NULL
        ORDER BY story_id, COALESCE(created_at, date_written, CURRENT_TIMESTAMP), id
    ) t
) o ON o.id = a.id
SET a.story_order = o.rn;

-- 6) Optional: add composite index for fast story ordering queries
-- Ensure composite index for ordering exists
SET @idx_story_order_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND INDEX_NAME = 'idx_story_order'
);
SET @sql_idx_story_order := IF(@idx_story_order_exists = 0,
    'CREATE INDEX idx_story_order ON articles(story_id, story_order)',
    'SELECT 1'
);
PREPARE stmt_idx2 FROM @sql_idx_story_order; EXECUTE stmt_idx2; DEALLOCATE PREPARE stmt_idx2;

-- Note: Do not drop legacy 'story' column yet to maintain backward compatibility.

-- Re-enable safe updates and foreign key checks
SET FOREIGN_KEY_CHECKS = @old_foreign_key_checks;
SET SQL_SAFE_UPDATES = @old_sql_safe_updates;