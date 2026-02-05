-- ============================================================
-- Manage the Spire Database Migration
-- Employee Management System Tables
-- ============================================================
-- IMPORTANT: This migration safely adds new tables without 
-- affecting existing Quiz the Spire tables
-- ============================================================

USE `quizTheSpire`;

-- ============================================================
-- Table: manage_businesses
-- Stores company/business information
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_businesses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_name` varchar(255) NOT NULL,
  `owner_user_id` int NOT NULL,
  `contact_email` varchar(255) NOT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `timezone` varchar(100) DEFAULT 'UTC',
  `subscription_tier` ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  `subscription_expires_at` datetime DEFAULT NULL,
  `max_employees` int DEFAULT 10,
  `settings_json` TEXT DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_owner` (`owner_user_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `manage_businesses_owner_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_employee_roles
-- Defines roles within the management system
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_employee_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT IGNORE INTO `manage_employee_roles` (`role_name`, `description`) VALUES
('owner', 'Business owner with full access'),
('manager', 'Manager with scheduling and oversight capabilities'),
('employee', 'Standard employee with self-service access');

-- ============================================================
-- Table: manage_employees
-- Employee profiles and information
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `employee_code` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `role_id` int NOT NULL,
  `position_title` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `hire_date` date NOT NULL,
  `termination_date` date DEFAULT NULL,
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `pto_balance_hours` decimal(10,2) DEFAULT 0.00,
  `sick_balance_hours` decimal(10,2) DEFAULT 0.00,
  `emergency_contact_name` varchar(255) DEFAULT NULL,
  `emergency_contact_phone` varchar(50) DEFAULT NULL,
  `status` ENUM('active', 'on_leave', 'terminated', 'suspended') DEFAULT 'active',
  `notes` TEXT DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`),
  UNIQUE KEY `uk_business_employee_code` (`business_id`, `employee_code`),
  CONSTRAINT `manage_employees_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_employees_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `manage_employees_role_fk` FOREIGN KEY (`role_id`) REFERENCES `manage_employee_roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_shifts
-- Employee work schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `shift_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `position` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `break_minutes` int DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_date` (`shift_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `manage_shifts_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_shifts_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_shifts_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_time_entries
-- Clock in/out records
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_time_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `shift_id` int DEFAULT NULL,
  `clock_in` datetime NOT NULL,
  `clock_out` datetime DEFAULT NULL,
  `clock_in_location` varchar(255) DEFAULT NULL,
  `clock_out_location` varchar(255) DEFAULT NULL,
  `break_minutes` int DEFAULT 0,
  `total_hours` decimal(10,2) DEFAULT NULL,
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `total_pay` decimal(10,2) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_shift` (`shift_id`),
  KEY `idx_clock_in` (`clock_in`),
  CONSTRAINT `manage_time_entries_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_time_entries_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_time_entries_shift_fk` FOREIGN KEY (`shift_id`) REFERENCES `manage_shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `manage_time_entries_approver_fk` FOREIGN KEY (`approved_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_time_off_requests
-- PTO and sick leave requests
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_time_off_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `request_type` ENUM('pto', 'sick', 'unpaid', 'bereavement', 'other') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_hours` decimal(10,2) NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'denied', 'cancelled') DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `review_notes` TEXT DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_dates` (`start_date`, `end_date`),
  CONSTRAINT `manage_time_off_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_time_off_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_time_off_reviewer_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_warnings
-- Disciplinary actions and performance issues
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_warnings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `warning_type` ENUM('verbal', 'written', 'final', 'suspension', 'termination') NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `incident_date` date NOT NULL,
  `description` TEXT NOT NULL,
  `corrective_action` TEXT DEFAULT NULL,
  `follow_up_date` date DEFAULT NULL,
  `issued_by` int NOT NULL,
  `acknowledged_by_employee` boolean DEFAULT FALSE,
  `acknowledged_at` datetime DEFAULT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_type` (`warning_type`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `manage_warnings_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_warnings_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_warnings_issuer_fk` FOREIGN KEY (`issued_by`) REFERENCES `manage_employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_commendations
-- Positive recognition and achievements
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_commendations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `commendation_type` ENUM('recognition', 'achievement', 'bonus', 'promotion', 'other') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` TEXT NOT NULL,
  `date_earned` date NOT NULL,
  `bonus_amount` decimal(10,2) DEFAULT NULL,
  `issued_by` int NOT NULL,
  `is_public` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_type` (`commendation_type`),
  CONSTRAINT `manage_commendations_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_commendations_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_commendations_issuer_fk` FOREIGN KEY (`issued_by`) REFERENCES `manage_employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_skills
-- Skills and certifications catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `skill_name` varchar(255) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `requires_certification` boolean DEFAULT FALSE,
  `certification_expires` boolean DEFAULT FALSE,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_active` (`is_active`),
  UNIQUE KEY `uk_business_skill` (`business_id`, `skill_name`),
  CONSTRAINT `manage_skills_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_employee_skills
-- Employee-skill junction with certifications
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_employee_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `skill_id` int NOT NULL,
  `proficiency_level` ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
  `certified_date` date DEFAULT NULL,
  `certification_expires_at` date DEFAULT NULL,
  `certification_number` varchar(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_skill` (`skill_id`),
  KEY `idx_expiry` (`certification_expires_at`),
  UNIQUE KEY `uk_employee_skill` (`employee_id`, `skill_id`),
  CONSTRAINT `manage_employee_skills_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_employee_skills_skill_fk` FOREIGN KEY (`skill_id`) REFERENCES `manage_skills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_availability
-- Employee availability patterns
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `day_of_week` ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `is_available` boolean DEFAULT TRUE,
  `notes` TEXT DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_day` (`day_of_week`),
  CONSTRAINT `manage_availability_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_shift_swaps
-- Shift trade/swap requests
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_shift_swaps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `original_shift_id` int NOT NULL,
  `from_employee_id` int NOT NULL,
  `to_employee_id` int DEFAULT NULL,
  `swap_type` ENUM('drop', 'swap', 'cover') NOT NULL,
  `new_shift_id` int DEFAULT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` ENUM('pending', 'accepted', 'approved', 'denied', 'cancelled') DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `review_notes` TEXT DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_original_shift` (`original_shift_id`),
  KEY `idx_from_employee` (`from_employee_id`),
  KEY `idx_to_employee` (`to_employee_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `manage_shift_swaps_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_shift_swaps_original_shift_fk` FOREIGN KEY (`original_shift_id`) REFERENCES `manage_shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_shift_swaps_from_employee_fk` FOREIGN KEY (`from_employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_shift_swaps_to_employee_fk` FOREIGN KEY (`to_employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `manage_shift_swaps_reviewer_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_announcements
-- Company-wide communications
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_announcements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` TEXT NOT NULL,
  `priority` ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  `target_audience` ENUM('all', 'managers', 'employees', 'specific') DEFAULT 'all',
  `expires_at` datetime DEFAULT NULL,
  `created_by` int NOT NULL,
  `is_active` boolean DEFAULT TRUE,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `manage_announcements_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_announcements_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `manage_employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_feedback
-- Anonymous employee feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `feedback_type` ENUM('suggestion', 'complaint', 'safety', 'harassment', 'other') NOT NULL,
  `message` TEXT NOT NULL,
  `anonymous_hash` varchar(255) DEFAULT NULL,
  `status` ENUM('new', 'reviewed', 'investigating', 'resolved', 'dismissed') DEFAULT 'new',
  `response` TEXT DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_type` (`feedback_type`),
  KEY `idx_status` (`status`),
  CONSTRAINT `manage_feedback_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_feedback_reviewer_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_compliance_alerts
-- Auto-generated compliance warnings
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_compliance_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `employee_id` int DEFAULT NULL,
  `alert_type` ENUM('overtime', 'break_violation', 'minor_hours', 'certification_expired', 'other') NOT NULL,
  `severity` ENUM('info', 'warning', 'critical') DEFAULT 'warning',
  `description` TEXT NOT NULL,
  `related_entity_type` varchar(50) DEFAULT NULL,
  `related_entity_id` int DEFAULT NULL,
  `status` ENUM('new', 'acknowledged', 'resolved', 'dismissed') DEFAULT 'new',
  `resolved_by` int DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_type` (`alert_type`),
  KEY `idx_status` (`status`),
  KEY `idx_severity` (`severity`),
  CONSTRAINT `manage_compliance_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_compliance_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `manage_employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_compliance_resolver_fk` FOREIGN KEY (`resolved_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: manage_audit_logs
-- Comprehensive audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS `manage_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_id` int NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `record_id` int NOT NULL,
  `action` ENUM('create', 'update', 'delete', 'view') NOT NULL,
  `old_values` TEXT DEFAULT NULL,
  `new_values` TEXT DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_business` (`business_id`),
  KEY `idx_table_record` (`table_name`, `record_id`),
  KEY `idx_action` (`action`),
  KEY `idx_performed_by` (`performed_by`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `manage_audit_logs_business_fk` FOREIGN KEY (`business_id`) REFERENCES `manage_businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manage_audit_logs_performer_fk` FOREIGN KEY (`performed_by`) REFERENCES `manage_employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Migration Complete
-- ============================================================
SELECT 'Manage the Spire tables created successfully!' AS Status;
