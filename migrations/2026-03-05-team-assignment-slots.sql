CREATE TABLE IF NOT EXISTS `team_assignment_slots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` char(36) NOT NULL,
  `member_uid` varchar(191) NOT NULL,
  `shoot_id` int(11) NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('booked','released','cancelled') NOT NULL DEFAULT 'booked',
  `released_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tas_member_window` (`member_uid`,`start_at`,`end_at`,`status`),
  KEY `idx_tas_company_status` (`company_id`,`status`),
  KEY `idx_tas_shoot_service_status` (`shoot_id`,`service_name`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
