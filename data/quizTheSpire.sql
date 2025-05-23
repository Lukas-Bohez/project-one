SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Database: `quizTheSpire`
-- sessionleaderboardssessionleaderboards
DROP DATABASE IF EXISTS quizTheSpire;

CREATE DATABASE IF NOT EXISTS `quizTheSpire` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quizTheSpire`;

-- Note: User creation should be handled in a separate administrative script
-- CREATE USER IF NOT EXISTS 'quiz_user'@'localhost' IDENTIFIED BY 'secure_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON quizTheSpire.* TO 'quiz_user'@'localhost';
-- FLUSH PRIVILEGES;

--
-- Table structure for table `userRoles`
--

DROP TABLE IF EXISTS `userRoles`;
CREATE TABLE `userRoles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `userRoles`
--

LOCK TABLES `userRoles` WRITE;
INSERT INTO `userRoles` (`description`) VALUES ('Admin'),('Moderator'),('User');
UNLOCK TABLES;

--
-- Table structure for table `sessionStatuses`
--

DROP TABLE IF EXISTS `sessionStatuses`;
CREATE TABLE `sessionStatuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessionStatuses`
--

LOCK TABLES `sessionStatuses` WRITE;
INSERT INTO `sessionStatuses` (`description`) VALUES ('Pending'),('Active'),('Completed'),('Cancelled');
UNLOCK TABLES;

--
-- Table structure for table `difficultyLevels`
--

DROP TABLE IF EXISTS `difficultyLevels`;
CREATE TABLE `difficultyLevels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `logoUrl` varchar(255) DEFAULT NULL,
  `order_index` int DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_difficulty_order` (`order_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `difficultyLevels`
--

LOCK TABLES `difficultyLevels` WRITE;
INSERT INTO `difficultyLevels` (`name`, `description`, `order_index`) VALUES 
('Easy', 'Beginner level questions', 1),
('Medium', 'Intermediate level questions', 2),
('Hard', 'Advanced level questions', 3),
('Expert', 'Expert level questions', 4);
UNLOCK TABLES;

--
-- Table structure for table `themes`
--

DROP TABLE IF EXISTS `themes`;
CREATE TABLE `themes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `logoUrl` varchar(255) DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_themes_active` (`is_active`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `last_name` varchar(100) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `salt` varchar(255) DEFAULT NULL,
  `rfid_code` varchar(100) NOT NULL,
  `userRoleId` int NOT NULL,
  `logoUrl` varchar(255) DEFAULT NULL,
  `email_verified` boolean DEFAULT FALSE,
  `email_verified_at` datetime DEFAULT NULL,
  `last_active` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `rfid_code` (`rfid_code`),
  KEY `userRoleId` (`userRoleId`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_active` (`deleted_at`, `last_active`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`userRoleId`) REFERENCES `userRoles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_text` text NOT NULL,
  `themeId` int NOT NULL,
  `difficultyLevelId` int NOT NULL,
  `explanation` text,
  `audioUrl` varchar(500) DEFAULT NULL,
  `imageUrl` varchar(500) DEFAULT NULL,
  `time_limit` int DEFAULT 30,
  `points` int DEFAULT 10,
  `is_active` boolean DEFAULT false,
  `createdBy` int,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `version` int DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `themeId` (`themeId`),
  KEY `difficultyLevelId` (`difficultyLevelId`),
  KEY `createdBy` (`createdBy`),
  KEY `idx_questions_theme_difficulty` (`themeId`, `difficultyLevelId`),
  KEY `idx_questions_active` (`is_active`, `deleted_at`),
  CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `questions_ibfk_2` FOREIGN KEY (`difficultyLevelId`) REFERENCES `difficultyLevels` (`id`),
  CONSTRAINT `questions_ibfk_3` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `questions_chk_1` CHECK ((`time_limit` > 0)),
  CONSTRAINT `questions_chk_2` CHECK ((`points` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `answers`
--

DROP TABLE IF EXISTS `answers`;
CREATE TABLE `answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `questionId` int NOT NULL,
  `answer_text` text NOT NULL,
  `is_correct` boolean NOT NULL DEFAULT FALSE,
  `order_index` int DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `questionId` (`questionId`),
  KEY `idx_answers_correct` (`questionId`, `is_correct`),
  CONSTRAINT `answers_ibfk_1` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `quizSessions`
--

DROP TABLE IF EXISTS `quizSessions`;
CREATE TABLE `quizSessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_date` datetime NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `sessionStatusId` int NOT NULL,
  `themeId` int NOT NULL,
  `hostUserId` int NOT NULL,
  `maxPlayers` int DEFAULT 10,
  `currentScore` int DEFAULT 0,
  `maxScore` int DEFAULT 0,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `is_public` boolean DEFAULT TRUE,
  `join_code` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version` int DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `join_code` (`join_code`),
  KEY `sessionStatusId` (`sessionStatusId`),
  KEY `themeId` (`themeId`),
  KEY `hostUserId` (`hostUserId`),
  KEY `idx_sessions_date` (`session_date`),
  KEY `idx_sessions_status` (`sessionStatusId`, `session_date`),
  CONSTRAINT `quizSessions_ibfk_1` FOREIGN KEY (`sessionStatusId`) REFERENCES `sessionStatuses` (`id`),
  CONSTRAINT `quizSessions_ibfk_2` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `quizSessions_ibfk_3` FOREIGN KEY (`hostUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `quizSessions_chk_1` CHECK ((`maxPlayers` > 0)),
  CONSTRAINT `quizSessions_chk_2` CHECK ((`currentScore` >= 0)),
  CONSTRAINT `quizSessions_chk_3` CHECK ((`maxScore` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sessionPlayers`
--

DROP TABLE IF EXISTS `sessionPlayers`;
CREATE TABLE `sessionPlayers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `score` int DEFAULT 0,
  `correctAnswers` int DEFAULT 0,
  `wrongAnswers` int DEFAULT 0,
  `bonus_points` int DEFAULT 0,
  `time_bonus` int DEFAULT 0,
  `streak_count` int DEFAULT 0,
  `joinedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `leftAt` datetime DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `idx_session_players_score` (`sessionId`, `score` DESC),
  CONSTRAINT `sessionPlayers_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessionPlayers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessionPlayers_chk_1` CHECK ((`correctAnswers` >= 0)),
  CONSTRAINT `sessionPlayers_chk_2` CHECK ((`wrongAnswers` >= 0)),
  CONSTRAINT `sessionPlayers_chk_3` CHECK ((`score` >= 0)),
  CONSTRAINT `sessionPlayers_chk_4` CHECK ((`bonus_points` >= 0)),
  UNIQUE KEY `session_user` (`sessionId`, `userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `playerAnswers` (New table for tracking individual answers)
--

DROP TABLE IF EXISTS `playerAnswers`;
CREATE TABLE `playerAnswers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `questionId` int NOT NULL,
  `answerId` int DEFAULT NULL,
  `is_correct` boolean NOT NULL,
  `points_earned` int DEFAULT 0,
  `time_taken` int DEFAULT NULL,
  `answered_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `questionId` (`questionId`),
  KEY `answerId` (`answerId`),
  KEY `idx_player_answers_session` (`sessionId`, `userId`),
  CONSTRAINT `playerAnswers_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_3` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_4` FOREIGN KEY (`answerId`) REFERENCES `answers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `playerAnswers_chk_1` CHECK ((`points_earned` >= 0)),
  CONSTRAINT `playerAnswers_chk_2` CHECK ((`time_taken` >= 0)),
  UNIQUE KEY `session_user_question` (`sessionId`, `userId`, `questionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `ipAddresses`
--

DROP TABLE IF EXISTS `ipAddresses`;
CREATE TABLE `ipAddresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL,
  `ownedBy` int,
  `is_banned` boolean DEFAULT FALSE,
  `ban_reason` text,
  `ban_date` datetime,
  `banned_by` int DEFAULT NULL,
  `ban_expires_at` datetime DEFAULT NULL,
  `first_seen` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_seen` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ip_address` (`ip_address`),
  KEY `ownedBy` (`ownedBy`),
  KEY `banned_by` (`banned_by`),
  KEY `idx_ip_banned` (`is_banned`, `ban_expires_at`),
  CONSTRAINT `ipAddresses_ibfk_1` FOREIGN KEY (`ownedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ipAddresses_ibfk_2` FOREIGN KEY (`banned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text,
  `effect` varchar(100) NOT NULL,
  `effect_value` int DEFAULT NULL,
  `rarity` ENUM('common', 'uncommon', 'rare', 'epic', 'legendary') DEFAULT 'common',
  `cost` int DEFAULT 0,
  `logoUrl` varchar(255) DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_items_rarity` (`rarity`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `playerItems` (New table for player inventory)
--

DROP TABLE IF EXISTS `playerItems`;
CREATE TABLE `playerItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `itemId` int NOT NULL,
  `quantity` int DEFAULT 1,
  `acquired_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `playerItems_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerItems_ibfk_2` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerItems_chk_1` CHECK ((`quantity` > 0)),
  UNIQUE KEY `user_item` (`userId`, `itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sensorData`
--

DROP TABLE IF EXISTS `sensorData`;
CREATE TABLE `sensorData` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `temperature` decimal(5,2),
  `humidity` decimal(5,2),
  `lightIntensity` int,
  `soundLevel` decimal(5,2),
  `air_quality` int DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `idx_sensor_timestamp` (`sessionId`, `timestamp`),
  CONSTRAINT `sensorData_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sensorData_chk_1` CHECK ((`temperature` BETWEEN -50 AND 100)),
  CONSTRAINT `sensorData_chk_2` CHECK ((`humidity` BETWEEN 0 AND 100)),
  CONSTRAINT `sensorData_chk_3` CHECK ((`lightIntensity` >= 0)),
  CONSTRAINT `sensorData_chk_4` CHECK ((`soundLevel` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `auditLog` (New table for tracking changes)
--

DROP TABLE IF EXISTS `auditLog`;
CREATE TABLE `auditLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(50) NOT NULL,
  `record_id` int NOT NULL,
  `action` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  `old_values` JSON DEFAULT NULL,
  `new_values` JSON DEFAULT NULL,
  `changed_by` int DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_audit_table_record` (`table_name`, `record_id`),
  KEY `idx_audit_timestamp` (`created_at`),
  CONSTRAINT `auditLog_ibfk_1` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Create views for common queries
--

-- View for active users with role information
CREATE VIEW `activeUsers` AS
SELECT 
    u.`id`,
    u.`first_name`,
    u.`last_name`,
    u.`email`,
    u.`email_verified`,
    ur.`description` as `role`,
    u.`last_active`,
    u.`created_at`
FROM `users` u
JOIN `userRoles` ur ON u.`userRoleId` = ur.`id`
WHERE u.`deleted_at` IS NULL;

-- View for session leaderboards
CREATE VIEW `sessionLeaderboards` AS
SELECT 
    sp.`sessionId`,
    u.`first_name`,
    u.`last_name`,
    sp.`score`,
    sp.`correctAnswers`,
    sp.`wrongAnswers`,
    ROUND((sp.`correctAnswers` / NULLIF(sp.`correctAnswers` + sp.`wrongAnswers`, 0)) * 100, 2) as `accuracy_percentage`,
    ROW_NUMBER() OVER (PARTITION BY sp.`sessionId` ORDER BY sp.`score` DESC, sp.`correctAnswers` DESC) as `rank_position`
FROM `sessionPlayers` sp
JOIN `users` u ON sp.`userId` = u.`id`
WHERE sp.`is_active` = TRUE AND u.`deleted_at` IS NULL;






--
-- Table structure for table `chatLog`
--

DROP TABLE IF EXISTS `chatLog`;
CREATE TABLE `chatLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `message_text` text NOT NULL,
  `message_type` ENUM('chat', 'system', 'announcement', 'warning') DEFAULT 'chat',
  `is_visible` boolean DEFAULT TRUE,
  `reply_to_id` int DEFAULT NULL,
  `is_flagged` boolean DEFAULT FALSE,
  `flagged_by` int DEFAULT NULL,
  `flagged_reason` varchar(255) DEFAULT NULL,
  `flagged_at` datetime DEFAULT NULL,
  `is_deleted` boolean DEFAULT FALSE,
  `deleted_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `reply_to_id` (`reply_to_id`),
  KEY `flagged_by` (`flagged_by`),
  KEY `deleted_by` (`deleted_by`),
  KEY `idx_chat_session_time` (`sessionId`, `created_at`),
  KEY `idx_chat_visible` (`sessionId`, `is_visible`, `is_deleted`),
  KEY `idx_chat_flagged` (`is_flagged`, `flagged_at`),
  CONSTRAINT `chatLog_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_3` FOREIGN KEY (`reply_to_id`) REFERENCES `chatLog` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_ibfk_4` FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_ibfk_5` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_chk_1` CHECK (CHAR_LENGTH(`message_text`) <= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Create a view for active chat messages with user information
--

CREATE VIEW `activeChatMessages` AS
SELECT 
    c.`id`,
    c.`sessionId`,
    c.`message_text`,
    c.`message_type`,
    c.`reply_to_id`,
    c.`created_at`,
    u.`first_name`,
    u.`last_name`,
    u.`email`,
    ur.`description` as `user_role`,
    reply_user.`first_name` as `reply_to_first_name`,
    reply_user.`last_name` as `reply_to_last_name`
FROM `chatLog` c
JOIN `users` u ON c.`userId` = u.`id`
JOIN `userRoles` ur ON u.`userRoleId` = ur.`id`
LEFT JOIN `chatLog` reply_msg ON c.`reply_to_id` = reply_msg.`id`
LEFT JOIN `users` reply_user ON reply_msg.`userId` = reply_user.`id`
WHERE c.`is_visible` = TRUE 
  AND c.`is_deleted` = FALSE 
  AND u.`deleted_at` IS NULL
ORDER BY c.`created_at` ASC;

--
-- Create indexes for better performance on common chat queries
--

CREATE INDEX `idx_chat_user_session` ON `chatLog` (`userId`, `sessionId`, `created_at`);
CREATE INDEX `idx_chat_recent` ON `chatLog` (`created_at` DESC, `is_visible`, `is_deleted`);

--
-- Example trigger to automatically flag messages containing inappropriate content
-- (You would need to customize the word list based on your application's needs)
--

DELIMITER $$

CREATE TRIGGER `chatLog_content_check_before_insert`
BEFORE INSERT ON `chatLog`
FOR EACH ROW
BEGIN
    DECLARE temp_message TEXT;
    DECLARE link_count INT;
    DECLARE repeat_pattern_count INT;
    
    -- Normalize message for checking (lowercase, remove extra spaces)
    SET temp_message = LOWER(TRIM(NEW.message_text));
    
    -- Check 1: Basic inappropriate content (case-insensitive)
IF temp_message REGEXP '(?i)\\b(spam|abuse|fuck|shit|asshole|bitch|nigger|fagot|fagotG|whore|slut|cunt|dick|pussy|kill|murder|hitler|rape|terrorist|retard|cum|faggot|twat|dildo|bastard|sex|molest|pedo|incest|necrophilia|zoophilia|anal|cock|bollocks|rape|terror|slurs|gas the jews|nazi|sieg heil)\\b'
 THEN
        SET NEW.is_flagged = TRUE;
        SET NEW.flagged_reason = CONCAT(IFNULL(NEW.flagged_reason, ''), 'Auto-flagged for inappropriate language. ');
        SET NEW.flagged_at = NOW();
    END IF;
    
    -- Check 2: Excessive capitalization (more than 50% caps)
    IF (LENGTH(temp_message) - LENGTH(REPLACE(temp_message, ' ', ''))) > 5 
       AND (LENGTH(REGEXP_REPLACE(temp_message, '[^A-Z]', '')) / LENGTH(REGEXP_REPLACE(temp_message, '[^a-zA-Z]', '')) > 0.5) THEN
        SET NEW.is_flagged = TRUE;
        SET NEW.flagged_reason = CONCAT(IFNULL(NEW.flagged_reason, ''), 'Auto-flagged for excessive capitalization. ');
        SET NEW.flagged_at = NOW();
    END IF;
    
    -- Check 3: URL detection
    SET link_count = (SELECT REGEXP_COUNT(temp_message, '(https?:\\/\\/|www\\.)[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-.,@?^=%&:\\/~+#]*[\\w\\-@?^=%&\\/~+#])?'));
    IF link_count > 0 THEN
        SET NEW.is_flagged = TRUE;
        SET NEW.flagged_reason = CONCAT(IFNULL(NEW.flagged_reason, ''), CONCAT('Auto-flagged for containing ', link_count, ' link(s). '));
        SET NEW.flagged_at = NOW();
    END IF;
    
    -- Check 4: Repeated character patterns (e.g., "loooool")
    SET repeat_pattern_count = (SELECT REGEXP_COUNT(temp_message, '([a-zA-Z])\\1{3,}'));
    IF repeat_pattern_count > 0 THEN
        SET NEW.is_flagged = TRUE;
        SET NEW.flagged_reason = CONCAT(IFNULL(NEW.flagged_reason, ''), 'Auto-flagged for suspicious character repetition. ');
        SET NEW.flagged_at = NOW();
    END IF;
    
    -- Check 5: Message length validation
    IF CHAR_LENGTH(NEW.message_text) > 1000 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Message too long. Maximum 1000 characters allowed.';
    ELSEIF CHAR_LENGTH(NEW.message_text) = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Empty messages are not allowed.';
    END IF;
    
    -- Check 6: Excessive special characters
    IF (LENGTH(REGEXP_REPLACE(temp_message, '[a-zA-Z0-9\\s]', '')) / GREATEST(LENGTH(temp_message), 1)) > 0.3 THEN
        SET NEW.is_flagged = TRUE;
        SET NEW.flagged_reason = CONCAT(IFNULL(NEW.flagged_reason, ''), 'Auto-flagged for excessive special characters. ');
        SET NEW.flagged_at = NOW();
    END IF;
END$$

DELIMITER ;


-- This would track when messages are flagged, deleted, or moderated