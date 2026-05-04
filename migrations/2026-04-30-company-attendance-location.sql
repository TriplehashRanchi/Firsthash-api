ALTER TABLE attendance
  ADD COLUMN distance_from_office_meters DECIMAL(10, 2) NULL,
  ADD COLUMN location_status ENUM('inside_radius', 'outside_radius') DEFAULT 'inside_radius';

CREATE TABLE IF NOT EXISTS company_locations (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  location_name VARCHAR(255),
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INT DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_company_locations_company_active (company_id, is_active)
);
