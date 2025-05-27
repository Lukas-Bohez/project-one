CREATE DATABASE  IF NOT EXISTS `quizthespire` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `quizthespire`;
-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: quizthespire
-- ------------------------------------------------------
-- Server version	9.0.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `answers`
--

DROP TABLE IF EXISTS `answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `questionId` int NOT NULL,
  `answer_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `questionId` (`questionId`),
  KEY `idx_answers_correct` (`questionId`,`is_correct`),
  CONSTRAINT `answers_ibfk_1` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=135 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `answers`
--

LOCK TABLES `answers` WRITE;
/*!40000 ALTER TABLE `answers` DISABLE KEYS */;
INSERT INTO `answers` VALUES (1,1,'Miura',1),(2,1,'Sanura',0),(3,1,'Mitsuura',0),(4,1,'Sampo',0),(5,2,'Window',1),(6,2,'Door',0),(7,2,'The second plane hit the tower',0),(8,2,'Sky',0),(9,2,'Light',0),(10,3,'Sword',0),(11,3,'Heart',0),(12,3,'Anger',0),(13,3,'Quick',0),(14,4,'十五',1),(15,4,'十ご',0),(16,4,'じゅうご',0),(17,4,'一五',0),(18,4,'105',0),(19,5,'山',1),(20,5,'川',0),(21,5,'木',0),(22,5,'人',0),(23,5,'?',1),(24,6,'時',1),(25,6,'寺',0),(26,6,'持',0),(27,6,'詩',0),(28,6,'十',0),(29,7,'Forest',1),(30,7,'Woodpile',0),(31,7,'Treehouse',0),(32,7,'Timber',0),(33,7,'The Lorax',0),(34,8,'13',1),(35,8,'8',0),(36,8,'21',0),(37,8,'10',0),(38,8,'Just 1 big stroke',0),(39,9,'Water radical (氵)',1),(40,9,'Person radical (亻)',0),(41,9,'Mouth radical (口)',0),(42,9,'Tree radical (木)',0),(43,9,'The one that looks like waves',1),(44,10,'きょう (kyou)',1),(45,10,'こんにち (konnichi)',0),(46,10,'いまひ (imahi)',0),(47,10,'こんにちは (konnichiwa)',0),(48,10,'きょねん (kyonen)',0),(49,11,'Cat tongue',1),(50,11,'Cat person',0),(51,11,'Licking cats',0),(52,11,'Cat food',0),(53,11,'When cats stick their tongue out',0),(54,12,'枚',1),(55,12,'本',0),(56,12,'匹',0),(57,12,'台',0),(58,12,'つ',0),(59,13,'Thursday',1),(60,13,'Tree day',0),(61,13,'Wood cutting day',0),(62,13,'Arbor Day',0),(63,13,'Forest bathing holiday',0),(64,14,'Blue',1),(65,14,'Green',1),(66,14,'Young',1),(67,14,'Fresh',1),(68,14,'All of the above',1),(69,15,'small',0),(70,15,'you',0),(71,15,'me',1),(72,15,'Tiny me',0),(73,15,'enormous ',0),(74,15,'embarrassed',0),(75,16,'devil',0),(76,16,'angel',1),(77,16,'heaven',0),(78,16,'messenger',0),(79,16,'spirit',0),(80,16,'dream',0),(81,17,'aneru',0),(82,17,'anheru',1),(83,17,'angeru',0),(84,17,'anjeru',0),(85,17,'ankheru',0),(86,17,'anhelu',0),(87,18,'day',0),(88,18,'night',1),(89,18,'evening',0),(90,18,'morning',0),(91,18,'darkness',0),(92,18,'moon',0),(93,19,'topic marker',0),(94,19,'possessive marker',1),(95,19,'object marker',0),(96,19,'subject marker',0),(97,19,'location marker',0),(98,19,'time marker',0),(99,20,'sound',0),(100,20,'voice',1),(101,20,'word',0),(102,20,'song',0),(103,20,'music',0),(104,20,'whisper',0),(105,21,'kimi',1),(106,21,'kami',0),(107,21,'kumi',0),(108,21,'kemi',0),(109,21,'komi',0),(110,21,'kamu',0),(111,22,'universe',0),(112,22,'world',1),(113,22,'society',0),(114,22,'boundary',0),(115,22,'earth',0),(116,22,'planet',0),(117,23,'utau',1),(118,23,'utaru',0),(119,23,'uteru',0),(120,23,'utoru',0),(121,23,'utaku',0),(122,23,'utamu',0),(123,24,'mind',0),(124,24,'heart',1),(125,24,'soul',0),(126,24,'spirit',0),(127,24,'feeling',0),(128,24,'emotion',0),(129,25,'hitori',1),(130,25,'hitari',0),(131,25,'hetori',0),(132,25,'hotori',0),(133,25,'hutori',0),(134,25,'hatari',0);
/*!40000 ALTER TABLE `answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditlog`
--

DROP TABLE IF EXISTS `auditlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `changed_by` int DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_audit_table_record` (`table_name`,`record_id`),
  CONSTRAINT `auditLog_ibfk_1` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditlog`
--

LOCK TABLES `auditlog` WRITE;
/*!40000 ALTER TABLE `auditlog` DISABLE KEYS */;
INSERT INTO `auditlog` VALUES (1,'users',1,'UPDATE','{\"limb_points\": 4}','{\"limb_points\": 0}',1,'127.0.0.1');
/*!40000 ALTER TABLE `auditlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bannedwords`
--

DROP TABLE IF EXISTS `bannedwords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bannedwords` (
  `id` int NOT NULL AUTO_INCREMENT,
  `word` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','severe') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `is_active` tinyint(1) DEFAULT '1',
  `added_by` int DEFAULT NULL,
  `added_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `word` (`word`),
  KEY `added_by` (`added_by`),
  KEY `idx_banned_words_active` (`is_active`,`severity`),
  CONSTRAINT `bannedWords_ibfk_1` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bannedwords`
--

LOCK TABLES `bannedwords` WRITE;
/*!40000 ALTER TABLE `bannedwords` DISABLE KEYS */;
INSERT INTO `bannedwords` VALUES (1,'spam','low',1,NULL,'2025-05-27 09:13:42'),(2,'abuse','medium',1,NULL,'2025-05-27 09:13:42'),(3,'fuck','medium',1,NULL,'2025-05-27 09:13:42'),(4,'shit','medium',1,NULL,'2025-05-27 09:13:42'),(5,'asshole','medium',1,NULL,'2025-05-27 09:13:42'),(6,'bitch','medium',1,NULL,'2025-05-27 09:13:42'),(7,'nigger','severe',1,NULL,'2025-05-27 09:13:42'),(8,'faggot','severe',1,NULL,'2025-05-27 09:13:42'),(9,'whore','medium',1,NULL,'2025-05-27 09:13:42'),(10,'slut','medium',1,NULL,'2025-05-27 09:13:42'),(11,'cunt','high',1,NULL,'2025-05-27 09:13:42'),(12,'dick','medium',1,NULL,'2025-05-27 09:13:42'),(13,'pussy','medium',1,NULL,'2025-05-27 09:13:42'),(14,'kill','high',1,NULL,'2025-05-27 09:13:42'),(15,'murder','high',1,NULL,'2025-05-27 09:13:42'),(16,'hitler','severe',1,NULL,'2025-05-27 09:13:42'),(17,'rape','severe',1,NULL,'2025-05-27 09:13:42'),(18,'terrorist','severe',1,NULL,'2025-05-27 09:13:42'),(19,'retard','high',1,NULL,'2025-05-27 09:13:42'),(20,'cum','medium',1,NULL,'2025-05-27 09:13:42'),(21,'twat','medium',1,NULL,'2025-05-27 09:13:42'),(22,'dildo','medium',1,NULL,'2025-05-27 09:13:42'),(23,'bastard','medium',1,NULL,'2025-05-27 09:13:42'),(24,'sex','low',1,NULL,'2025-05-27 09:13:42'),(25,'molest','severe',1,NULL,'2025-05-27 09:13:42'),(26,'pedo','severe',1,NULL,'2025-05-27 09:13:42'),(27,'incest','severe',1,NULL,'2025-05-27 09:13:42'),(28,'necrophilia','severe',1,NULL,'2025-05-27 09:13:42'),(29,'zoophilia','severe',1,NULL,'2025-05-27 09:13:42'),(30,'anal','medium',1,NULL,'2025-05-27 09:13:42'),(31,'cock','medium',1,NULL,'2025-05-27 09:13:42'),(32,'bollocks','medium',1,NULL,'2025-05-27 09:13:42'),(33,'terror','high',1,NULL,'2025-05-27 09:13:42'),(34,'slur','high',1,NULL,'2025-05-27 09:13:42'),(35,'gas the','severe',1,NULL,'2025-05-27 09:13:42'),(36,'nazi','severe',1,NULL,'2025-05-27 09:13:42'),(37,'sieg heil','severe',1,NULL,'2025-05-27 09:13:42'),(38,'mein kampf','medium',1,NULL,'2025-05-27 09:13:42'),(39,'penis','severe',1,NULL,'2025-05-27 09:13:42'),(40,'gringo','medium',1,NULL,'2025-05-27 09:13:42'),(41,'fucking','medium',1,NULL,'2025-05-27 09:13:42'),(42,'boob','high',1,NULL,'2025-05-27 09:13:42');
/*!40000 ALTER TABLE `bannedwords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chatlog`
--

DROP TABLE IF EXISTS `chatlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chatlog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int DEFAULT NULL,
  `message_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` enum('chat','system','announcement','warning') COLLATE utf8mb4_unicode_ci DEFAULT 'chat',
  `reply_to_id` int DEFAULT NULL,
  `is_flagged` tinyint(1) DEFAULT '0',
  `flagged_by` int DEFAULT NULL,
  `flagged_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `flagged_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `reply_to_id` (`reply_to_id`),
  KEY `flagged_by` (`flagged_by`),
  KEY `idx_chat_session_time` (`sessionId`,`created_at`),
  KEY `idx_chat_flagged` (`is_flagged`,`flagged_at`),
  CONSTRAINT `chatLog_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizsessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chatLog_ibfk_3` FOREIGN KEY (`reply_to_id`) REFERENCES `chatlog` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_ibfk_4` FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chatLog_chk_1` CHECK ((char_length(`message_text`) <= 1000))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chatlog`
--

LOCK TABLES `chatlog` WRITE;
/*!40000 ALTER TABLE `chatlog` DISABLE KEYS */;
INSERT INTO `chatlog` VALUES (1,1,NULL,'Item used on user system causing loss of LP','announcement',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:43'),(2,1,1,'aw man, that was awfull luck','chat',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:43'),(3,1,1,'I fucking love the lorax movie.','chat',NULL,1,NULL,'Auto-flagged for inappropriate content: fucking','2025-05-27 09:13:46','2025-05-27 09:13:46'),(4,1,NULL,'Do not use banned words user system!','warning',3,0,NULL,NULL,NULL,'2025-05-27 09:13:46'),(5,1,NULL,'ワリオさんは残念ながらボーナスポイントを獲得できませんでした','system',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47'),(6,1,2,'全問正解です！音楽のように完璧ですね♪','chat',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47'),(7,1,3,'ワリオの負けパターンもまたカッコいいぜ！','chat',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47'),(8,1,2,'漢字はリズムと同じ、規則を覚えれば簡単です','chat',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47'),(9,1,3,'次は絶対...いや多分無理だワハハ！','chat',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47'),(10,1,NULL,'ワリオさんはボーナスポイントを獲得できませんでした','system',NULL,0,NULL,NULL,NULL,'2025-05-27 09:13:47');
/*!40000 ALTER TABLE `chatlog` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `chatLog_content_check` BEFORE INSERT ON `chatlog` FOR EACH ROW BEGIN
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `difficultylevels`
--

DROP TABLE IF EXISTS `difficultylevels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `difficultylevels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_index` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_difficulty_order` (`order_index`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `difficultylevels`
--

LOCK TABLES `difficultylevels` WRITE;
/*!40000 ALTER TABLE `difficultylevels` DISABLE KEYS */;
INSERT INTO `difficultylevels` VALUES (1,'Easy','Beginner level questions',1),(2,'Medium','Intermediate level questions',2),(3,'Hard','Advanced level questions',3),(4,'Expert','Expert level questions',4);
/*!40000 ALTER TABLE `difficultylevels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ipaddresses`
--

DROP TABLE IF EXISTS `ipaddresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ipaddresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_banned` tinyint(1) DEFAULT '0',
  `ban_reason` text COLLATE utf8mb4_unicode_ci,
  `ban_date` datetime DEFAULT NULL,
  `banned_by` int DEFAULT NULL,
  `ban_expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ip_address` (`ip_address`),
  KEY `banned_by` (`banned_by`),
  KEY `idx_ip_banned` (`is_banned`,`ban_expires_at`),
  CONSTRAINT `ipAddresses_ibfk_2` FOREIGN KEY (`banned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipaddresses`
--

LOCK TABLES `ipaddresses` WRITE;
/*!40000 ALTER TABLE `ipaddresses` DISABLE KEYS */;
INSERT INTO `ipaddresses` VALUES (1,'127.0.0.1',0,NULL,NULL,NULL,NULL,'2025-05-27 09:13:47');
/*!40000 ALTER TABLE `ipaddresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `effect` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `effect_value` int DEFAULT NULL,
  `rarity` enum('common','uncommon','rare','epic','legendary') COLLATE utf8mb4_unicode_ci DEFAULT 'common',
  `cost` int DEFAULT '0',
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_items_rarity` (`rarity`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES (1,'Mystery Potion','A strange potion with unpredictable effects','rakuraku anrakushi',1,'rare',50,NULL,1);
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playeranswers`
--

DROP TABLE IF EXISTS `playeranswers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playeranswers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `questionId` int NOT NULL,
  `answerId` int DEFAULT NULL,
  `is_correct` tinyint(1) NOT NULL,
  `points_earned` int DEFAULT '0',
  `time_taken` int DEFAULT NULL,
  `answered_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_user_question` (`sessionId`,`userId`,`questionId`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `questionId` (`questionId`),
  KEY `answerId` (`answerId`),
  KEY `idx_player_answers_session` (`sessionId`,`userId`),
  CONSTRAINT `playerAnswers_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizsessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_3` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerAnswers_ibfk_4` FOREIGN KEY (`answerId`) REFERENCES `answers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `playerAnswers_chk_1` CHECK ((`points_earned` >= 0)),
  CONSTRAINT `playerAnswers_chk_2` CHECK ((`time_taken` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playeranswers`
--

LOCK TABLES `playeranswers` WRITE;
/*!40000 ALTER TABLE `playeranswers` DISABLE KEYS */;
INSERT INTO `playeranswers` VALUES (1,1,2,1,1,1,10,1,'2025-05-27 09:13:47'),(2,1,2,5,19,1,10,3,'2025-05-27 09:13:47'),(3,1,2,6,24,1,10,3,'2025-05-27 09:13:47'),(4,1,2,7,29,1,10,4,'2025-05-27 09:13:47'),(5,1,2,8,34,1,10,3,'2025-05-27 09:13:47'),(6,1,2,9,39,1,10,5,'2025-05-27 09:13:47'),(7,1,2,10,44,1,10,2,'2025-05-27 09:13:47'),(8,1,2,11,49,1,10,4,'2025-05-27 09:13:47'),(9,1,2,12,54,1,10,5,'2025-05-27 09:13:47'),(10,1,2,13,59,1,10,4,'2025-05-27 09:13:47'),(16,1,3,1,2,0,0,30,'2025-05-27 09:13:47'),(17,1,3,5,21,0,0,20,'2025-05-27 09:13:47'),(18,1,3,6,25,0,0,25,'2025-05-27 09:13:47'),(19,1,3,7,31,0,0,15,'2025-05-27 09:13:47'),(20,1,3,8,36,0,0,30,'2025-05-27 09:13:47'),(21,1,3,9,41,0,0,25,'2025-05-27 09:13:47'),(22,1,3,10,45,0,0,20,'2025-05-27 09:13:47'),(23,1,3,11,50,0,0,25,'2025-05-27 09:13:47'),(24,1,3,12,55,0,0,20,'2025-05-27 09:13:47'),(25,1,3,13,61,0,0,15,'2025-05-27 09:13:47');
/*!40000 ALTER TABLE `playeranswers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playeritems`
--

DROP TABLE IF EXISTS `playeritems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playeritems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `itemId` int NOT NULL,
  `quantity` int DEFAULT '1',
  `acquired_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_item` (`userId`,`itemId`),
  KEY `userId` (`userId`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `playerItems_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerItems_ibfk_2` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playerItems_chk_1` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playeritems`
--

LOCK TABLES `playeritems` WRITE;
/*!40000 ALTER TABLE `playeritems` DISABLE KEYS */;
INSERT INTO `playeritems` VALUES (1,1,1,1,'2025-05-27 09:13:42');
/*!40000 ALTER TABLE `playeritems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `themeId` int NOT NULL,
  `difficultyLevelId` int NOT NULL,
  `explanation` text COLLATE utf8mb4_unicode_ci,
  `Url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_limit` int DEFAULT '30',
  `think_time` int DEFAULT '0',
  `points` int DEFAULT '10',
  `is_active` tinyint(1) DEFAULT '0',
  `no_answer_correct` tinyint(1) DEFAULT '0',
  `createdBy` int DEFAULT NULL,
  `LightMax` int DEFAULT NULL,
  `LightMin` int DEFAULT NULL,
  `TempMax` int DEFAULT NULL,
  `TempMin` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `themeId` (`themeId`),
  KEY `difficultyLevelId` (`difficultyLevelId`),
  KEY `createdBy` (`createdBy`),
  KEY `idx_questions_theme_difficulty` (`themeId`,`difficultyLevelId`),
  CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `questions_ibfk_2` FOREIGN KEY (`difficultyLevelId`) REFERENCES `difficultylevels` (`id`),
  CONSTRAINT `questions_ibfk_3` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `questions_chk_1` CHECK ((`time_limit` > 0)),
  CONSTRAINT `questions_chk_2` CHECK ((`think_time` >= 0)),
  CONSTRAINT `questions_chk_3` CHECK ((`points` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,'What is the correct reading for the kanji 三浦?',1,2,'三浦 is a common Japanese surname read as \"Miura\". It literally means \"three bays\" where 三 (mi/san) means \"three\" and 浦 (ura) means \"bay\" or \"inlet\".',NULL,30,0,10,1,0,1,1000,300,25,18),(2,'What is the correct meaning of the kanji 窓?',1,2,'The kanji 窓 (まど/mado) means \"window\". It combines the radical for \"hole\" (穴) with the character for \"heart/mind\" (心), suggesting a window as a \"hole for the mind/heart to look through\".',NULL,30,0,10,1,0,1,1000,300,25,18),(3,'What is the correct meaning of the kanji 忍?',1,3,'The kanji 忍 (にん/nin) means \"patience\" or \"endurance\". The character shows a blade (刃) over heart (心), symbolizing enduring pain. The correct strategy was to wait patiently without answering.',NULL,10,0,10,1,1,1,NULL,NULL,NULL,NULL),(4,'How would you write the number 15 in kanji, really think about it?',1,1,'The number 15 is written as 十五 in kanji. 十 (juu) means 10 and 五 (go) means 5, combining to make 15.',NULL,20,15,10,1,0,1,NULL,NULL,NULL,NULL),(5,'Which kanji represents \"mountain\"?',1,1,'山 is the kanji for mountain. It visually resembles a mountain range with three peaks.',NULL,20,0,10,1,0,1,NULL,NULL,NULL,NULL),(6,'Which kanji means \"time\"?',1,2,'時 (とき/ji) means time. It combines 日 (sun/day) with 寺 (temple), suggesting marking time.',NULL,25,0,10,1,0,1,NULL,NULL,NULL,NULL),(7,'What does 木+木+木 make?',1,1,'森 (mori) means forest - literally \"many trees\"! Three 木 (tree) kanji together make a forest.',NULL,15,0,10,1,0,1,NULL,NULL,NULL,NULL),(8,'How many strokes in the kanji 愛 (love)?',1,3,'愛 has 13 strokes. It contains elements for \"heart\" (心) and \"to receive\" (受).',NULL,30,0,10,1,0,1,NULL,NULL,NULL,NULL),(9,'What radical appears in both 泳 (swim) and 河 (river)?',1,2,'The water radical 氵(さんずい) appears in both, indicating water-related meanings.',NULL,25,0,10,1,0,1,NULL,NULL,NULL,NULL),(10,'How is 今日 pronounced?',1,2,'今日 is pronounced きょう (kyou) meaning \"today\". This is a special reading - the kanji separately would be 今 (ima/kon) + 日 (hi/nichi).',NULL,20,0,10,1,0,1,NULL,NULL,NULL,NULL),(11,'What does 猫舌 (nekojita) literally mean?',1,3,'猫舌 means \"cat tongue\" - someone who can\'t handle hot food/drinks! 猫=cat + 舌=tongue.',NULL,25,0,10,1,0,1,NULL,NULL,NULL,NULL),(12,'Which kanji is used for counting flat objects?',1,2,'枚 (まい) is the counter for flat objects like paper, shirts, or pancakes!',NULL,20,0,10,1,0,1,NULL,NULL,NULL,NULL),(13,'What does 木曜日 mean?',1,1,'木曜日 is Thursday (もくようび). The 木 means tree, and Thursday is \"Jupiter day\" - Jupiter was associated with wood in Chinese elements.',NULL,15,0,10,1,0,1,NULL,NULL,NULL,NULL),(14,'What can 青 mean?',1,2,'青 (あお) primarily means blue, but can also mean green (in traffic lights) or young/unripe (青い).',NULL,20,0,10,1,0,1,NULL,NULL,NULL,NULL),(15,'what does the kanji 私(watashi) mean in ちっちゃな私 (chicchana watashi)?',1,3,'私 here means me with a tone of humility or endearing smallness.','https://www.youtube.com/watch?v=4aFC2oC-wHA',20,0,10,1,0,1,NULL,NULL,NULL,NULL),(16,'What does the kanji 天使 (tenshi) mean in the context of this song?',1,2,'天使 (tenshi) means \"angel\" - 天 means heaven/sky and 使 means messenger.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',15,0,10,1,0,1,NULL,NULL,NULL,NULL),(17,'What is the romaji reading of the katakana アンヘル?',1,1,'アンヘル is written as \"anheru\" in romaji, which is the Japanese pronunciation of \"angel\".','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',10,0,10,1,0,1,NULL,NULL,NULL,NULL),(18,'What does the kanji 夜 (yoru) mean?',1,1,'夜 (yoru) means \"night\" and is commonly used in Japanese to refer to nighttime.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',10,0,10,1,0,1,NULL,NULL,NULL,NULL),(19,'In the phrase \"君の声\" (kimi no koe), what is the function of the particle の (no)?',1,2,'の (no) is a possessive particle that shows ownership or relationship, here meaning \"your voice\".','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',15,0,10,1,0,1,NULL,NULL,NULL,NULL),(20,'What does the kanji 声 (koe) mean?',1,1,'声 (koe) means \"voice\" and is used to refer to someone\'s speaking voice or sound.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',10,0,10,1,0,1,NULL,NULL,NULL,NULL),(21,'What is the romaji reading of the hiragana きみ?',1,1,'きみ is read as \"kimi\" in romaji, meaning \"you\" in an informal/intimate way.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',10,0,10,1,0,1,NULL,NULL,NULL,NULL),(22,'What does the kanji compound 世界 (sekai) mean?',1,2,'世界 (sekai) means \"world\" - 世 refers to society/generation and 界 means boundary/realm.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',15,0,10,1,0,1,NULL,NULL,NULL,NULL),(23,'What is the dictionary form of the verb 歌って (utatte)?',1,3,'歌って (utatte) is the te-form of 歌う (utau), which means \"to sing\".','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',20,0,10,1,0,1,NULL,NULL,NULL,NULL),(24,'What does the kanji 心 (kokoro) mean?',1,2,'心 (kokoro) means \"heart\" in the emotional/spiritual sense, not the physical organ.','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',15,0,10,1,0,1,NULL,NULL,NULL,NULL),(25,'What is the romaji reading of ひとり?',1,1,'ひとり is read as \"hitori\" in romaji, meaning \"alone\" or \"one person\".','https://vocaloidlyrics.fandom.com/wiki/%E3%82%A2%E3%83%B3%E3%83%98%E3%83%AB_(%C3%81ngel)',10,0,10,1,0,1,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quizsessions`
--

DROP TABLE IF EXISTS `quizsessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quizsessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_date` datetime NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sessionStatusId` int NOT NULL,
  `themeId` int NOT NULL,
  `hostUserId` int NOT NULL,
  `start_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `end_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sessionStatusId` (`sessionStatusId`),
  KEY `themeId` (`themeId`),
  KEY `hostUserId` (`hostUserId`),
  KEY `idx_sessions_date` (`session_date`),
  KEY `idx_sessions_status` (`sessionStatusId`,`session_date`),
  CONSTRAINT `quizSessions_ibfk_1` FOREIGN KEY (`sessionStatusId`) REFERENCES `sessionstatuses` (`id`),
  CONSTRAINT `quizSessions_ibfk_2` FOREIGN KEY (`themeId`) REFERENCES `themes` (`id`),
  CONSTRAINT `quizSessions_ibfk_3` FOREIGN KEY (`hostUserId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quizsessions`
--

LOCK TABLES `quizsessions` WRITE;
/*!40000 ALTER TABLE `quizsessions` DISABLE KEYS */;
INSERT INTO `quizsessions` VALUES (1,'2025-05-27 09:13:42','Japanese Quiz','Test your knowledge of Japanese language',2,1,1,'2025-05-27 09:13:42',NULL);
/*!40000 ALTER TABLE `quizsessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sensordata`
--

DROP TABLE IF EXISTS `sensordata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sensordata` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `temperature (°C)` decimal(5,2) DEFAULT NULL,
  `lightIntensity (lux)` int DEFAULT NULL,
  `servoPosition (°)` int DEFAULT NULL COMMENT 'Servomotor position (0-180 degrees)',
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessionId` (`sessionId`),
  KEY `idx_sensor_timestamp` (`sessionId`,`timestamp`),
  CONSTRAINT `sensorData_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizsessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sensorData_chk_1` CHECK ((`temperature (°C)` between -(50) and 100)),
  CONSTRAINT `sensorData_chk_3` CHECK ((`lightIntensity (lux)` >= 0)),
  CONSTRAINT `sensorData_chk_4` CHECK ((`servoPosition (°)` between 0 and 180))
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sensordata`
--

LOCK TABLES `sensordata` WRITE;
/*!40000 ALTER TABLE `sensordata` DISABLE KEYS */;
INSERT INTO `sensordata` VALUES (1,1,21.50,500,0,'2025-05-27 09:08:43'),(2,1,21.60,500,18,'2025-05-27 09:08:53'),(3,1,21.70,500,36,'2025-05-27 09:09:03'),(4,1,21.80,500,54,'2025-05-27 09:09:13'),(5,1,21.90,500,72,'2025-05-27 09:09:23'),(6,1,22.00,500,90,'2025-05-27 09:09:33'),(7,1,22.10,500,108,'2025-05-27 09:09:43'),(8,1,22.20,500,126,'2025-05-27 09:09:53'),(9,1,22.30,500,144,'2025-05-27 09:10:03'),(10,1,22.40,500,162,'2025-05-27 09:10:13'),(11,1,22.50,500,180,'2025-05-27 09:10:23'),(12,1,22.60,300,162,'2025-05-27 09:10:33'),(13,1,22.70,300,144,'2025-05-27 09:10:43'),(14,1,22.80,300,126,'2025-05-27 09:10:53'),(15,1,22.90,300,108,'2025-05-27 09:11:03'),(16,1,23.00,300,90,'2025-05-27 09:11:13'),(17,1,23.10,300,72,'2025-05-27 09:11:23'),(18,1,23.20,300,54,'2025-05-27 09:11:33'),(19,1,23.30,300,36,'2025-05-27 09:11:43'),(20,1,23.40,300,18,'2025-05-27 09:11:53'),(21,1,23.50,300,0,'2025-05-27 09:12:03'),(22,1,23.60,500,18,'2025-05-27 09:12:13'),(23,1,23.70,500,36,'2025-05-27 09:12:23'),(24,1,23.80,500,54,'2025-05-27 09:12:33'),(25,1,23.90,500,72,'2025-05-27 09:12:43'),(26,1,24.00,500,90,'2025-05-27 09:12:53'),(27,1,24.10,500,108,'2025-05-27 09:13:03'),(28,1,24.20,500,126,'2025-05-27 09:13:13'),(29,1,24.30,500,144,'2025-05-27 09:13:23'),(30,1,24.40,500,162,'2025-05-27 09:13:33'),(31,1,24.50,500,180,'2025-05-27 09:13:43'),(32,1,24.60,300,162,'2025-05-27 09:13:53'),(33,1,24.70,300,144,'2025-05-27 09:14:03'),(34,1,24.80,300,126,'2025-05-27 09:14:13'),(35,1,24.90,300,108,'2025-05-27 09:14:23'),(36,1,25.00,300,90,'2025-05-27 09:14:33'),(37,1,25.10,300,72,'2025-05-27 09:14:43'),(38,1,25.20,300,54,'2025-05-27 09:14:53'),(39,1,25.30,300,36,'2025-05-27 09:15:03'),(40,1,25.40,300,18,'2025-05-27 09:15:13'),(41,1,25.50,300,0,'2025-05-27 09:15:23'),(42,1,25.60,500,0,'2025-05-27 09:15:34'),(43,1,25.70,500,36,'2025-05-27 09:15:44'),(44,1,25.80,500,72,'2025-05-27 09:15:54'),(45,1,25.90,500,108,'2025-05-27 09:16:04'),(46,1,26.00,500,144,'2025-05-27 09:16:14'),(47,1,26.10,500,180,'2025-05-27 09:16:24'),(48,1,26.20,300,144,'2025-05-27 09:16:34'),(49,1,26.30,300,108,'2025-05-27 09:16:44'),(50,1,26.40,300,72,'2025-05-27 09:16:54'),(51,1,26.50,300,36,'2025-05-27 09:17:04'),(52,1,26.60,300,0,'2025-05-27 09:17:14');
/*!40000 ALTER TABLE `sensordata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessionplayers`
--

DROP TABLE IF EXISTS `sessionplayers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessionplayers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `score` int DEFAULT '0',
  `correctAnswers` int DEFAULT '0',
  `wrongAnswers` int DEFAULT '0',
  `bonus_points` int DEFAULT '0',
  `time_bonus` int DEFAULT '0',
  `streak_count` int DEFAULT '0',
  `joinedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_user` (`sessionId`,`userId`),
  KEY `sessionId` (`sessionId`),
  KEY `userId` (`userId`),
  KEY `idx_session_players_score` (`sessionId`,`score` DESC),
  CONSTRAINT `sessionPlayers_ibfk_1` FOREIGN KEY (`sessionId`) REFERENCES `quizsessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessionPlayers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessionPlayers_chk_1` CHECK ((`correctAnswers` >= 0)),
  CONSTRAINT `sessionPlayers_chk_2` CHECK ((`wrongAnswers` >= 0)),
  CONSTRAINT `sessionPlayers_chk_3` CHECK ((`score` >= 0)),
  CONSTRAINT `sessionPlayers_chk_4` CHECK ((`bonus_points` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessionplayers`
--

LOCK TABLES `sessionplayers` WRITE;
/*!40000 ALTER TABLE `sessionplayers` DISABLE KEYS */;
INSERT INTO `sessionplayers` VALUES (1,1,1,0,0,0,0,0,0,'2025-05-27 09:13:43',1),(2,1,2,100,10,0,50,0,0,'2025-05-27 09:13:47',1),(3,1,3,0,0,10,0,0,0,'2025-05-27 09:13:47',1);
/*!40000 ALTER TABLE `sessionplayers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessionstatuses`
--

DROP TABLE IF EXISTS `sessionstatuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessionstatuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessionstatuses`
--

LOCK TABLES `sessionstatuses` WRITE;
/*!40000 ALTER TABLE `sessionstatuses` DISABLE KEYS */;
INSERT INTO `sessionstatuses` VALUES (1,'Pending'),(2,'Active'),(3,'Completed'),(4,'Cancelled');
/*!40000 ALTER TABLE `sessionstatuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `themes`
--

DROP TABLE IF EXISTS `themes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `themes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `themes`
--

LOCK TABLES `themes` WRITE;
/*!40000 ALTER TABLE `themes` DISABLE KEYS */;
INSERT INTO `themes` VALUES (1,'Japanese Language','Questions about Japanese language and culture',NULL,1);
/*!40000 ALTER TABLE `themes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `useripaddresses`
--

DROP TABLE IF EXISTS `useripaddresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `useripaddresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `ipAddressId` int NOT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `usage_count` int DEFAULT '1',
  `first_used` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_ip_unique` (`userId`,`ipAddressId`),
  KEY `idx_userId` (`userId`),
  KEY `idx_ipAddressId` (`ipAddressId`),
  KEY `idx_user_ip_primary` (`userId`,`is_primary`),
  KEY `idx_user_ip_recent` (`userId`,`last_used` DESC),
  KEY `idx_last_used` (`last_used`),
  CONSTRAINT `fk_userIp_ipAddressId` FOREIGN KEY (`ipAddressId`) REFERENCES `ipaddresses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_userIp_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_first_used_before_last` CHECK ((`first_used` <= `last_used`)),
  CONSTRAINT `chk_usage_count_positive` CHECK ((`usage_count` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `useripaddresses`
--

LOCK TABLES `useripaddresses` WRITE;
/*!40000 ALTER TABLE `useripaddresses` DISABLE KEYS */;
INSERT INTO `useripaddresses` VALUES (1,1,1,1,1,'2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48'),(2,2,1,0,2,'2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48'),(3,3,1,0,3,'2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48','2025-05-27 09:13:48');
/*!40000 ALTER TABLE `useripaddresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `userroles`
--

DROP TABLE IF EXISTS `userroles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `userroles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `userroles`
--

LOCK TABLES `userroles` WRITE;
/*!40000 ALTER TABLE `userroles` DISABLE KEYS */;
INSERT INTO `userroles` VALUES (1,'Admin'),(2,'Moderator'),(3,'User');
/*!40000 ALTER TABLE `userroles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salt` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rfid_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userRoleId` int NOT NULL,
  `soul_points` int DEFAULT '4',
  `limb_points` int DEFAULT '4',
  `last_active` datetime DEFAULT NULL,
  `session_expires_at` datetime DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userRoleId` (`userRoleId`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_users_session` (`session_expires_at`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`userRoleId`) REFERENCES `userroles` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_limb_points_check` CHECK ((`limb_points` between 0 and 4)),
  CONSTRAINT `users_soul_points_check` CHECK ((`soul_points` between 0 and 4))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Server','User','6d02c898cee990ab4a55e50b300d0a3932da3d5a06abc4fd18cf01f7979a5f76','6a5ac1d86ad57895541b500517eb99b3392420d1e6ff3c84f09a84ed882fd51a','SERVER123',3,4,0,NULL,NULL,NULL),(2,'ぴのきおっぷ','プロデューサー','06a15766039a97c4797e68348f3e5fb4928db2b36ab5c1dafb4634fbce82ef39','53cdd779370d342caea9dfa67755c9a9ab5fa4dd32acba8239d9b61252b043f9','VOCALOID123',3,4,4,NULL,NULL,NULL),(3,'ワリオ','ゲーム','1055332b80c4ee90776f3860d4b8c0039d434d6bf7efddf206e2ed3251a64841','b0553cbb1f3f42721def7e87f9b7dc4daa53fec445b800281865c2b62cf19929','WAHWAH123',3,4,4,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'quizthespire'
--

--
-- Dumping routines for database 'quizthespire'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-27 15:46:33
