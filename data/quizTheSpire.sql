SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Database: `quizTheSpire`
--
DROP DATABASE IF EXISTS quizTheSpire;

CREATE DATABASE IF NOT EXISTS `quizTheSpire` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quizTheSpire`;

-- Note: User creation should be handled in a separate administrative script
CREATE USER IF NOT EXISTS 'quiz_user'@'localhost' IDENTIFIED BY 'secure_password_not_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON quizTheSpire.* TO 'quiz_user'@'localhost';
FLUSH PRIVILEGES;

--
-- Table structure for table `userRoles`
--

DROP TABLE IF EXISTS `userRoles`;
CREATE TABLE `userRoles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(50) NOT NULL,
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
  `order_index` int DEFAULT 0,
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `last_name` varchar(100) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `salt` varchar(255) NOT NULL,
  `rfid_code` varchar(100) NOT NULL,
  `userRoleId` int NOT NULL,
  `soul_points` int DEFAULT 4,
  `limb_points` int DEFAULT 4,
  `last_active` datetime DEFAULT NULL,
  `session_expires_at` datetime DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userRoleId` (`userRoleId`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_users_session` (`session_expires_at`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`userRoleId`) REFERENCES `userRoles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_soul_points_check` CHECK (`soul_points` BETWEEN 0 AND 4),
  CONSTRAINT `users_limb_points_check` CHECK (`limb_points` BETWEEN 0 AND 4)
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
  `Url` varchar(500) DEFAULT NULL,
  `time_limit` int DEFAULT 30,
  `think_time` int DEFAULT 0,
  `points` int DEFAULT 10,
  `is_active` boolean DEFAULT false,
  `no_answer_correct` boolean DEFAULT false,
  `createdBy` int DEFAULT NULL,
  `LightMax` int DEFAULT NULL,
  `LightMin` int DEFAULT NULL,
  `TempMax` int DEFAULT NULL,
  `TempMin` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `themeId` (`themeId`),
  KEY `difficultyLevelId` (`difficultyLevelId`),
  KEY `createdBy` (`createdBy`),
  KEY `idx_questions_theme_difficulty` (`themeId`, `difficultyLevelId`),
  CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `questions_ibfk_2` FOREIGN KEY (`difficultyLevelId`) REFERENCES `difficultyLevels` (`id`),
  CONSTRAINT `questions_ibfk_3` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `questions_chk_1` CHECK ((`time_limit` > 0)),
  CONSTRAINT `questions_chk_2` CHECK ((`think_time` >= 0)),
  CONSTRAINT `questions_chk_3` CHECK ((`points` > 0))
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
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sessionStatusId` (`sessionStatusId`),
  KEY `themeId` (`themeId`),
  KEY `hostUserId` (`hostUserId`),
  KEY `idx_sessions_date` (`session_date`),
  KEY `idx_sessions_status` (`sessionStatusId`, `session_date`),
  CONSTRAINT `quizSessions_ibfk_1` FOREIGN KEY (`sessionStatusId`) REFERENCES `sessionStatuses` (`id`),
  CONSTRAINT `quizSessions_ibfk_2` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `quizSessions_ibfk_3` FOREIGN KEY (`hostUserId`) REFERENCES `users` (`id`)
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
-- Table structure for table `playerAnswers`
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
  `ownedBy` int DEFAULT NULL,
  `is_banned` boolean DEFAULT FALSE,
  `ban_reason` text DEFAULT NULL,
  `ban_date` datetime DEFAULT NULL,
  `banned_by` int DEFAULT NULL,
  `ban_expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ip_address` (`ip_address`),
  KEY `banned_by` (`banned_by`),
  KEY `idx_ip_banned` (`is_banned`, `ban_expires_at`),
  CONSTRAINT `ipAddresses_ibfk_2` FOREIGN KEY (`banned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Create a junction table for the many-to-many relationship between users and IP addresses
DROP TABLE IF EXISTS `userIpAddresses`;
CREATE TABLE `userIpAddresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `ipAddressId` int NOT NULL,
  `is_primary` boolean DEFAULT FALSE,
  `usage_count` int DEFAULT 1,
  `first_used` timestamp DEFAULT CURRENT_TIMESTAMP,
  `last_used` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_ip_unique` (`userId`, `ipAddressId`),
  KEY `idx_userId` (`userId`),
  KEY `idx_ipAddressId` (`ipAddressId`),
  KEY `idx_user_ip_primary` (`userId`, `is_primary`),
  KEY `idx_user_ip_recent` (`userId`, `last_used` DESC),
  KEY `idx_last_used` (`last_used`),
  CONSTRAINT `fk_userIp_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_userIp_ipAddressId` FOREIGN KEY (`ipAddressId`) REFERENCES `ipAddresses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_usage_count_positive` CHECK (`usage_count` >= 0),
  CONSTRAINT `chk_first_used_before_last` CHECK (`first_used` <= `last_used`)
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
  PRIMARY KEY (`id`),
  KEY `idx_items_rarity` (`rarity`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `playerItems`
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
  `temperature` decimal(5,2) DEFAULT NULL,
  `lightIntensity` int DEFAULT NULL,
  `servoPosition` int DEFAULT NULL COMMENT 'Servomotor position (0-180 degrees)',
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `idx_sensor_timestamp` (`sessionId`, `timestamp`),
  CONSTRAINT `sensorData_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sensorData_chk_1` CHECK ((`temperature` BETWEEN -50 AND 100)),
  CONSTRAINT `sensorData_chk_3` CHECK ((`lightIntensity` >= 0)),
  CONSTRAINT `sensorData_chk_4` CHECK ((`servoPosition` BETWEEN 0 AND 180))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `auditLog`
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
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_audit_table_record` (`table_name`, `record_id`),
  CONSTRAINT `auditLog_ibfk_1` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `reply_to_id` int DEFAULT NULL,
  `is_flagged` boolean DEFAULT FALSE,
  `flagged_by` int DEFAULT NULL,
  `flagged_reason` varchar(255) DEFAULT NULL,
  `flagged_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `reply_to_id` (`reply_to_id`),
  KEY `flagged_by` (`flagged_by`),
  KEY `idx_chat_session_time` (`sessionId`, `created_at`),
  KEY `idx_chat_flagged` (`is_flagged`, `flagged_at`),
  CONSTRAINT `chatLog_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizSessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_3` FOREIGN KEY (`reply_to_id`) REFERENCES `chatLog` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_ibfk_4` FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_chk_1` CHECK (CHAR_LENGTH(`message_text`) <= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `bannedWords`
--

DROP TABLE IF EXISTS `bannedWords`;
CREATE TABLE `bannedWords` (
  `id` int NOT NULL AUTO_INCREMENT,
  `word` varchar(255) NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'severe') DEFAULT 'medium',
  `is_active` boolean DEFAULT TRUE,
  `added_by` int DEFAULT NULL,
  `added_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `word` (`word`),
  KEY `added_by` (`added_by`),
  KEY `idx_banned_words_active` (`is_active`, `severity`),
  CONSTRAINT `bannedWords_ibfk_1` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bannedWords`
--

LOCK TABLES `bannedWords` WRITE;
INSERT INTO `bannedWords` (`word`, `severity`) VALUES 
('spam', 'low'),
('abuse', 'medium'),
('fuck', 'medium'),
('shit', 'medium'),
('asshole', 'medium'),
('bitch', 'medium'),
('nigger', 'severe'),
('faggot', 'severe'),
('whore', 'medium'),
('slut', 'medium'),
('cunt', 'high'),
('dick', 'medium'),
('pussy', 'medium'),
('kill', 'high'),
('murder', 'high'),
('hitler', 'severe'),
('rape', 'severe'),
('terrorist', 'severe'),
('retard', 'high'),
('cum', 'medium'),
('twat', 'medium'),
('dildo', 'medium'),
('bastard', 'medium'),
('sex', 'low'),
('molest', 'severe'),
('pedo', 'severe'),
('incest', 'severe'),
('necrophilia', 'severe'),
('zoophilia', 'severe'),
('anal', 'medium'),
('cock', 'medium'),
('bollocks', 'medium'),
('terror', 'high'),
('slur', 'high'),
('gas the', 'severe'),
('nazi', 'severe'),
('sieg heil', 'severe'),
('mein kampf', 'medium'),
('penis','severe'),
('gringo','medium'),
('boob','high');
UNLOCK TABLES;


--
-- Trigger to automatically flag messages containing banned words
--

DELIMITER $$

CREATE TRIGGER `chatLog_content_check` 
BEFORE INSERT ON `chatLog`
FOR EACH ROW
BEGIN
    DECLARE banned_word_found VARCHAR(255) DEFAULT NULL;
    DECLARE word_severity VARCHAR(10) DEFAULT NULL;
    DECLARE done INT DEFAULT FALSE;
    DECLARE word_cursor CURSOR FOR 
        SELECT `word`, `severity` FROM `bannedWords` WHERE `is_active` = TRUE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Check message length first
    IF CHAR_LENGTH(NEW.message_text) > 1000 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Message too long. Maximum 1000 characters allowed.';
    END IF;

    -- Open cursor to check each banned word
    OPEN word_cursor;
    
    check_words: LOOP
        FETCH word_cursor INTO banned_word_found, word_severity;
        IF done THEN
            LEAVE check_words;
        END IF;
        
        -- Check if the message contains this banned word (case-insensitive, word boundary)
        IF LOWER(NEW.message_text) REGEXP CONCAT('\\b', LOWER(banned_word_found), '\\b') THEN
            SET NEW.is_flagged = TRUE;
            SET NEW.flagged_reason = CONCAT('Auto-flagged for inappropriate content: ', banned_word_found);
            SET NEW.flagged_at = NOW();
            
            -- Exit loop once we find a violation (that's the intended behavior)
            LEAVE check_words;
        END IF;
    END LOOP;
    
    CLOSE word_cursor;
END$$

DELIMITER ;




-- Insert the theme (if not already exists)
INSERT INTO `themes` (`name`, `description`, `is_active`) 
VALUES ('Japanese Language', 'Questions about Japanese language and culture', TRUE)
ON DUPLICATE KEY UPDATE `is_active` = TRUE;

-- Get the theme ID
SET @theme_id = (SELECT `id` FROM `themes` WHERE `name` = 'Japanese Language' LIMIT 1);

-- Insert the user "server" with password "salty"
-- First create a salt and hash the password
SET @salt = SHA2(UUID(), 256);
SET @password_hash = SHA2(CONCAT('salty', @salt), 256);

-- Insert the user
INSERT INTO `users` (`last_name`, `first_name`, `password_hash`, `salt`, `rfid_code`, `userRoleId`, `soul_points`, `limb_points`) 
VALUES ('Server', 'User', @password_hash, @salt, 'SERVER123', 
        (SELECT `id` FROM `userRoles` WHERE `description` = 'User' LIMIT 1), 
        4, 4);

-- Get the user ID
SET @user_id = LAST_INSERT_ID();

-- Insert the "Mystery Potion" item
INSERT INTO `items` (`name`, `description`, `effect`, `effect_value`, `rarity`, `cost`, `is_active`) 
VALUES ('Mystery Potion', 'A strange potion with unpredictable effects', 'rakuraku anrakushi', 1, 'rare', 50, TRUE);

-- Get the item ID
SET @item_id = LAST_INSERT_ID();

-- Give the user the Mystery Potion
INSERT INTO `playerItems` (`userId`, `itemId`, `quantity`) 
VALUES (@user_id, @item_id, 1);

-- Create a quiz session
INSERT INTO `quizSessions` (`session_date`, `name`, `description`, `sessionStatusId`, `themeId`, `hostUserId`) 
VALUES (NOW(), 'Japanese Quiz', 'Test your knowledge of Japanese language', 
        (SELECT `id` FROM `sessionStatuses` WHERE `description` = 'Active' LIMIT 1), 
        @theme_id, @user_id);

-- Get the session ID
SET @session_id = LAST_INSERT_ID();

-- Add the user as a player in the session
INSERT INTO `sessionPlayers` (`sessionId`, `userId`) 
VALUES (@session_id, @user_id);

-- Create a question about the kanji 三浦 with proper explanation, temperature, and light settings
INSERT INTO `questions` (
    `question_text`, 
    `themeId`, 
    `difficultyLevelId`, 
    `explanation`, 
    `is_active`, 
    `createdBy`,
    `TempMax`, 
    `TempMin`, 
    `LightMax`, 
    `LightMin`
) 
VALUES (
    'What is the correct reading for the kanji 三浦?', 
    @theme_id, 
    (SELECT `id` FROM `difficultyLevels` WHERE `name` = 'Medium' LIMIT 1), 
    '三浦 is a common Japanese surname read as "Miura". It literally means "three bays" where 三 (mi/san) means "three" and 浦 (ura) means "bay" or "inlet".', 
    TRUE, 
    @user_id,
    25,
    18,
    1000,
    300
);

-- Get the question ID
SET @question_id = LAST_INSERT_ID();

-- Add answers for the question
INSERT INTO `answers` (`questionId`, `answer_text`, `is_correct`) 
VALUES 
(@question_id, 'Miura', TRUE),
(@question_id, 'Sanura', FALSE),
(@question_id, 'Mitsuura', FALSE),
(@question_id, 'Sampo', FALSE);

-- Simulate the effect of the Mystery Potion (limbs disappearing)
UPDATE `users` 
SET `limb_points` = 0 
WHERE `id` = @user_id;

-- Add the chat message
INSERT INTO `chatLog` (`sessionId`, `userId`, `message_text`, `message_type`) 
VALUES (@session_id, @user_id, 'aw man, that was awfull luck', 'chat');

-- Log the item usage in audit log
INSERT INTO `auditLog` (`table_name`, `record_id`, `action`, `old_values`, `new_values`, `changed_by`, `ip_address`) 
VALUES ('users', @user_id, 'UPDATE', 
        JSON_OBJECT('limb_points', 4), 
        JSON_OBJECT('limb_points', 0), 
        @user_id, '127.0.0.1');
        
        
        
-- Insert 50 sensor data records with servomotor simulation
INSERT INTO `sensorData` (`sessionId`, `temperature`, `lightIntensity`, `servoPosition`, `timestamp`)
VALUES
-- Initial setup (pre-game, servo at 0)
(@session_id, 21.5, 500, 0, DATE_ADD(NOW(), INTERVAL -300 SECOND)),

-- Quiz starts (servo begins moving up as time counts down)
(@session_id, 21.6, 500, 18, DATE_ADD(NOW(), INTERVAL -290 SECOND)),
(@session_id, 21.7, 500, 36, DATE_ADD(NOW(), INTERVAL -280 SECOND)),
(@session_id, 21.8, 500, 54, DATE_ADD(NOW(), INTERVAL -270 SECOND)),
(@session_id, 21.9, 500, 72, DATE_ADD(NOW(), INTERVAL -260 SECOND)),
(@session_id, 22.0, 500, 90, DATE_ADD(NOW(), INTERVAL -250 SECOND)),
(@session_id, 22.1, 500, 108, DATE_ADD(NOW(), INTERVAL -240 SECOND)),
(@session_id, 22.2, 500, 126, DATE_ADD(NOW(), INTERVAL -230 SECOND)),
(@session_id, 22.3, 500, 144, DATE_ADD(NOW(), INTERVAL -220 SECOND)),
(@session_id, 22.4, 500, 162, DATE_ADD(NOW(), INTERVAL -210 SECOND)),
(@session_id, 22.5, 500, 180, DATE_ADD(NOW(), INTERVAL -200 SECOND)),

-- Time's up! (servo begins moving back to 0 during explanation)
(@session_id, 22.6, 300, 162, DATE_ADD(NOW(), INTERVAL -190 SECOND)),
(@session_id, 22.7, 300, 144, DATE_ADD(NOW(), INTERVAL -180 SECOND)),
(@session_id, 22.8, 300, 126, DATE_ADD(NOW(), INTERVAL -170 SECOND)),
(@session_id, 22.9, 300, 108, DATE_ADD(NOW(), INTERVAL -160 SECOND)),
(@session_id, 23.0, 300, 90, DATE_ADD(NOW(), INTERVAL -150 SECOND)),
(@session_id, 23.1, 300, 72, DATE_ADD(NOW(), INTERVAL -140 SECOND)),
(@session_id, 23.2, 300, 54, DATE_ADD(NOW(), INTERVAL -130 SECOND)),
(@session_id, 23.3, 300, 36, DATE_ADD(NOW(), INTERVAL -120 SECOND)),
(@session_id, 23.4, 300, 18, DATE_ADD(NOW(), INTERVAL -110 SECOND)),
(@session_id, 23.5, 300, 0, DATE_ADD(NOW(), INTERVAL -100 SECOND)),

-- Next question cycle begins
(@session_id, 23.6, 500, 18, DATE_ADD(NOW(), INTERVAL -90 SECOND)),
(@session_id, 23.7, 500, 36, DATE_ADD(NOW(), INTERVAL -80 SECOND)),
(@session_id, 23.8, 500, 54, DATE_ADD(NOW(), INTERVAL -70 SECOND)),
(@session_id, 23.9, 500, 72, DATE_ADD(NOW(), INTERVAL -60 SECOND)),
(@session_id, 24.0, 500, 90, DATE_ADD(NOW(), INTERVAL -50 SECOND)),
(@session_id, 24.1, 500, 108, DATE_ADD(NOW(), INTERVAL -40 SECOND)),
(@session_id, 24.2, 500, 126, DATE_ADD(NOW(), INTERVAL -30 SECOND)),
(@session_id, 24.3, 500, 144, DATE_ADD(NOW(), INTERVAL -20 SECOND)),
(@session_id, 24.4, 500, 162, DATE_ADD(NOW(), INTERVAL -10 SECOND)),
(@session_id, 24.5, 500, 180, NOW()),

-- Final explanation phase
(@session_id, 24.6, 300, 162, DATE_ADD(NOW(), INTERVAL 10 SECOND)),
(@session_id, 24.7, 300, 144, DATE_ADD(NOW(), INTERVAL 20 SECOND)),
(@session_id, 24.8, 300, 126, DATE_ADD(NOW(), INTERVAL 30 SECOND)),
(@session_id, 24.9, 300, 108, DATE_ADD(NOW(), INTERVAL 40 SECOND)),
(@session_id, 25.0, 300, 90, DATE_ADD(NOW(), INTERVAL 50 SECOND)),
(@session_id, 25.1, 300, 72, DATE_ADD(NOW(), INTERVAL 60 SECOND)),
(@session_id, 25.2, 300, 54, DATE_ADD(NOW(), INTERVAL 70 SECOND)),
(@session_id, 25.3, 300, 36, DATE_ADD(NOW(), INTERVAL 80 SECOND)),
(@session_id, 25.4, 300, 18, DATE_ADD(NOW(), INTERVAL 90 SECOND)),
(@session_id, 25.5, 300, 0, DATE_ADD(NOW(), INTERVAL 100 SECOND));