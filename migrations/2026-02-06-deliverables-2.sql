-- Add deliverables_2 table
CREATE TABLE IF NOT EXISTS `deliverables_2` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('pending','ongoing','completed') NOT NULL DEFAULT 'pending',
  `due_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deliverables_2_project` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add deliverable_2_id to tasks
ALTER TABLE `tasks`
  ADD COLUMN `deliverable_2_id` int(11) DEFAULT NULL AFTER `deliverable_id`,
  ADD KEY `idx_tasks_deliverable_2` (`deliverable_2_id`);
