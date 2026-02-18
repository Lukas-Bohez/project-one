-- ============================================
-- Spire AI Collaboration - Database Migration
-- ============================================
-- User-created quiz themes, CSV uploads, admin review system

-- Community themes created by users
CREATE TABLE IF NOT EXISTS community_themes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    created_by INT NOT NULL,
    status ENUM('draft', 'pending_review', 'approved', 'rejected') DEFAULT 'draft',
    reviewer_id INT DEFAULT NULL,
    review_notes TEXT DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    play_count INT DEFAULT 0,
    rating_sum INT DEFAULT 0,
    rating_count INT DEFAULT 0,
    csv_source BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Community questions (linked to community themes)
CREATE TABLE IF NOT EXISTS community_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_theme_id INT NOT NULL,
    question_text VARCHAR(500) NOT NULL,
    explanation TEXT,
    difficulty ENUM('easy', 'medium', 'hard', 'expert') DEFAULT 'medium',
    time_limit INT DEFAULT 30,
    points INT DEFAULT 10,
    image_url VARCHAR(500),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_theme_id) REFERENCES community_themes(id) ON DELETE CASCADE,
    INDEX idx_theme (community_theme_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Community answers (linked to community questions)
CREATE TABLE IF NOT EXISTS community_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_question_id INT NOT NULL,
    answer_text VARCHAR(300) NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (community_question_id) REFERENCES community_questions(id) ON DELETE CASCADE,
    INDEX idx_question (community_question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CSV upload history
CREATE TABLE IF NOT EXISTS csv_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    community_theme_id INT NOT NULL,
    original_filename VARCHAR(255),
    questions_imported INT DEFAULT 0,
    questions_failed INT DEFAULT 0,
    error_log TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (community_theme_id) REFERENCES community_themes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Theme ratings by users
CREATE TABLE IF NOT EXISTS community_theme_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_theme_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rating (community_theme_id, user_id),
    FOREIGN KEY (community_theme_id) REFERENCES community_themes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New items for the shop
INSERT IGNORE INTO items (name, description, effect, effect_value, rarity, cost, logoUrl, is_active) VALUES
('Shield', 'Protects from the next item effect used against you', 'activateShield()', 1, 'uncommon', 45, '/svg/shield.svg', 1),
('Double Points', 'Your next correct answer earns double points', 'activateDoublePoints()', 2, 'rare', 55, '/svg/double-points.svg', 1),
('Time Warp', 'Adds 10 extra seconds to the current question timer', 'activateTimeWarp()', 10, 'uncommon', 40, '/svg/time-warp.svg', 1),
('Lightning Bolt', 'Eliminates two wrong answers from the current question', 'activateLightningBolt()', 2, 'epic', 70, '/svg/lightning.svg', 1),
('Mystery Box', 'Grants a random item effect - could be anything!', 'activateMysteryBox()', 1, 'legendary', 90, '/svg/mystery-box.svg', 1),
('Spotlight', 'Highlights the correct answer for 2 seconds', 'activateSpotlight()', 2, 'legendary', 100, '/svg/spotlight.svg', 1),
('Earthquake', 'Shakes everyone''s screen for 5 seconds, making it hard to click', 'activateEarthquake()', 5, 'rare', 50, '/svg/earthquake.svg', 1);
