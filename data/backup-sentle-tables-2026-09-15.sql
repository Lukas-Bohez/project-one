/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: 127.0.0.1    Database: quizTheSpire
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0+deb12u2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `sentle_users`
--

DROP TABLE IF EXISTS `sentle_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_users`
--

LOCK TABLES `sentle_users` WRITE;
/*!40000 ALTER TABLE `sentle_users` DISABLE KEYS */;
INSERT INTO `sentle_users` VALUES
(1,'testuser','ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f','2026-01-04 10:18:18'),
(2,'authtest_1767521932','7e6e0c3079a08c5cc6036789b57e951f65f82383913ba1a49ae992544f1b4b6e','2026-01-04 10:18:52');
/*!40000 ALTER TABLE `sentle_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_scores`
--

DROP TABLE IF EXISTS `sentle_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_scores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sentence_id` int(11) NOT NULL,
  `player_name` varchar(100) NOT NULL,
  `score` int(11) NOT NULL,
  `guesses` int(11) NOT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sentence_id` (`sentence_id`),
  CONSTRAINT `sentle_scores_ibfk_1` FOREIGN KEY (`sentence_id`) REFERENCES `sentle_sentences` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_scores`
--

LOCK TABLES `sentle_scores` WRITE;
/*!40000 ALTER TABLE `sentle_scores` DISABLE KEYS */;
INSERT INTO `sentle_scores` VALUES
(1,2,'Anonymous',2300,7,'2026-01-04','2026-01-04 10:09:09'),
(2,2,'Oroka Conner',5000,5,'2026-01-04','2026-01-04 17:02:03'),
(3,1,'Oroka Conner',5100,6,'2026-01-05','2026-01-05 18:56:13'),
(4,3,'Oroka Conner',3600,9,'2026-01-06','2026-01-06 06:16:22'),
(5,1,'User Server',100,5,'2024-01-01','2026-01-07 11:09:20'),
(6,4,'Oroka Conner',4500,9,'2026-01-07','2026-01-07 11:10:33'),
(7,5,'Oroka Conner',3000,23,'2026-01-08','2026-01-08 09:54:59'),
(8,6,'Oroka Conner',5100,14,'2026-01-09','2026-01-09 07:53:41'),
(9,11,'Oroka Conner',3300,21,'2026-02-19','2026-02-19 09:33:23');
/*!40000 ALTER TABLE `sentle_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_sessions`
--

DROP TABLE IF EXISTS `sentle_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `date` date NOT NULL,
  `played` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sentle_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `sentle_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_sessions`
--

LOCK TABLES `sentle_sessions` WRITE;
/*!40000 ALTER TABLE `sentle_sessions` DISABLE KEYS */;
INSERT INTO `sentle_sessions` VALUES
(1,1,'URj1ztXrAl268NyKWJFbeeVNNFFbXCK3Ral20SoMaZ4','127.0.0.1','curl/7.88.1','2026-01-04',0,'2026-01-04 10:18:21'),
(2,2,'-VfIsuSJ8XwLEG6dP4N2xRPDD5c7IvPr9Pohjr8mWqY','127.0.0.1','curl/7.88.1','2026-01-04',1,'2026-01-04 10:18:52');
/*!40000 ALTER TABLE `sentle_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_sentences`
--

DROP TABLE IF EXISTS `sentle_sentences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_sentences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `sentence` varchar(500) NOT NULL,
  `word_count` int(11) NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `reuse_count` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_sentences`
--

LOCK TABLES `sentle_sentences` WRITE;
/*!40000 ALTER TABLE `sentle_sentences` DISABLE KEYS */;
INSERT INTO `sentle_sentences` VALUES
(1,'2026-01-05','Joyous felicitations upon this magnificent day',6,1,0,'2026-01-04 09:48:51'),
(2,'2026-01-04','Canine companions exhibit extraordinary affection',5,1,1,'2026-01-04 09:49:37'),
(3,'2026-01-06','blue dogs tell lies',4,1,1,'2026-01-04 19:42:49'),
(4,'2026-01-07','living men tell many tales',5,1,1,'2026-01-05 19:00:38'),
(5,'2026-01-08','they worry about sickly elephants',5,1,1,'2026-01-06 07:44:32'),
(6,'2026-01-09','feline felons love eating cat food',6,1,1,'2026-01-07 11:38:45'),
(7,'2026-01-10','clever cats chase curious mice',5,1,0,'2026-01-08 18:30:19'),
(8,'2026-01-11','brave sailors navigate stormy seas',5,1,1,'2026-01-08 18:30:55'),
(10,'2026-01-12','gentle giants guard ancient gates',5,1,1,'2026-01-10 19:45:51'),
(11,'2026-01-13','merry merchants market mysterious maps',5,1,1,'2026-01-12 12:31:50'),
(13,'2026-01-14','wandering warriors wield weathered weapons',5,1,0,'2026-01-12 12:32:24'),
(14,'2026-01-15','whistling widows weave warm wreaths',5,1,1,'2026-01-12 12:33:15'),
(15,'2026-01-16','silent scholars study sacred scrolls',5,1,1,'2026-01-12 12:33:48'),
(16,'2026-01-17','merry merchants market mysterious maps',5,1,1,'2026-01-14 09:34:47'),
(17,'2026-01-18','silent scholars study sacred scrolls',5,1,0,'2026-01-18 16:24:23'),
(18,'2026-02-14','rustic robots repair rusty railways',5,0,0,'2026-02-13 21:51:21');
/*!40000 ALTER TABLE `sentle_sentences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_daily_sentences`
--

DROP TABLE IF EXISTS `sentle_daily_sentences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_daily_sentences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `sentence_id` int(11) NOT NULL,
  `is_reused` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`),
  KEY `sentence_id` (`sentence_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `sentle_daily_sentences_ibfk_1` FOREIGN KEY (`sentence_id`) REFERENCES `sentle_sentences` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_daily_sentences`
--

LOCK TABLES `sentle_daily_sentences` WRITE;
/*!40000 ALTER TABLE `sentle_daily_sentences` DISABLE KEYS */;
INSERT INTO `sentle_daily_sentences` VALUES
(1,'2026-01-04',2,0,'2026-02-02 13:04:20'),
(2,'2026-01-05',1,0,'2026-02-02 13:04:20'),
(3,'2026-01-06',3,0,'2026-02-02 13:04:20'),
(4,'2026-01-07',4,0,'2026-02-02 13:04:20'),
(5,'2026-01-08',5,0,'2026-02-02 13:04:20'),
(6,'2026-01-09',6,0,'2026-02-02 13:04:20'),
(7,'2026-01-10',7,0,'2026-02-02 13:04:20'),
(8,'2026-01-11',8,0,'2026-02-02 13:04:20'),
(9,'2026-01-12',10,0,'2026-02-02 13:04:20'),
(10,'2026-01-14',13,0,'2026-02-02 13:04:20'),
(11,'2026-01-15',14,0,'2026-02-02 13:04:20'),
(12,'2026-01-18',17,0,'2026-02-02 13:04:20'),
(13,'2026-02-02',8,1,'2026-02-02 13:08:09'),
(14,'2026-01-13',11,0,'2026-02-02 13:22:05'),
(15,'2026-01-16',15,0,'2026-02-02 13:22:05'),
(16,'2026-01-17',16,0,'2026-02-02 13:22:05'),
(17,'2026-02-03',10,1,'2026-02-03 09:59:52'),
(18,'2026-02-04',4,1,'2026-02-04 21:36:48'),
(19,'2026-02-13',5,1,'2026-02-13 21:50:15'),
(20,'2026-02-19',11,1,'2026-02-19 09:29:24'),
(21,'2026-03-02',2,1,'2026-03-02 08:01:51'),
(22,'2026-03-05',16,1,'2026-03-05 16:42:36'),
(23,'2026-04-27',14,1,'2026-04-27 08:12:06'),
(24,'2026-05-08',15,1,'2026-05-07 23:32:25'),
(25,'2026-05-20',3,1,'2026-05-20 06:51:17'),
(26,'2026-08-01',6,1,'2026-07-31 23:09:32');
/*!40000 ALTER TABLE `sentle_daily_sentences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_game_sessions`
--

DROP TABLE IF EXISTS `sentle_game_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_game_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `sentence_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `current_word_index` int(11) DEFAULT 0,
  `total_attempts` int(11) DEFAULT 0,
  `reveals_used` int(11) DEFAULT 0,
  `completed` tinyint(1) DEFAULT 0,
  `score` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_game` (`user_id`,`sentence_id`,`date`),
  KEY `sentence_id` (`sentence_id`),
  KEY `idx_user_date` (`user_id`,`date`),
  CONSTRAINT `sentle_game_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sentle_game_sessions_ibfk_2` FOREIGN KEY (`sentence_id`) REFERENCES `sentle_sentences` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_game_sessions`
--

LOCK TABLES `sentle_game_sessions` WRITE;
/*!40000 ALTER TABLE `sentle_game_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sentle_game_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_guesses`
--

DROP TABLE IF EXISTS `sentle_guesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_guesses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `game_session_id` int(11) NOT NULL,
  `word_index` int(11) NOT NULL,
  `guess` varchar(100) NOT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  `attempt_number` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_session_word` (`game_session_id`,`word_index`),
  CONSTRAINT `sentle_guesses_ibfk_1` FOREIGN KEY (`game_session_id`) REFERENCES `sentle_game_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_guesses`
--

LOCK TABLES `sentle_guesses` WRITE;
/*!40000 ALTER TABLE `sentle_guesses` DISABLE KEYS */;
/*!40000 ALTER TABLE `sentle_guesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sentle_reveals`
--

DROP TABLE IF EXISTS `sentle_reveals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sentle_reveals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `game_session_id` int(11) NOT NULL,
  `word_index` int(11) NOT NULL,
  `letter_index` int(11) NOT NULL,
  `letter` char(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_session_reveals` (`game_session_id`,`word_index`),
  CONSTRAINT `sentle_reveals_ibfk_1` FOREIGN KEY (`game_session_id`) REFERENCES `sentle_game_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentle_reveals`
--

LOCK TABLES `sentle_reveals` WRITE;
/*!40000 ALTER TABLE `sentle_reveals` DISABLE KEYS */;
/*!40000 ALTER TABLE `sentle_reveals` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-15 22:31:12
