-- Add flag to permanently show quotation deliverables per project
ALTER TABLE `projects`
  ADD COLUMN `show_quotation_deliverables` tinyint(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD KEY `idx_projects_show_quotation_deliverables` (`show_quotation_deliverables`);
