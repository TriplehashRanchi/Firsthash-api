CREATE TABLE IF NOT EXISTS personal_expense (
    id CHAR(36) NOT NULL PRIMARY KEY,
    company_id CHAR(36) NOT NULL,
    created_by_admin_uid VARCHAR(128) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    rupees DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    purchase_date DATE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_personal_expense_company_date (company_id, purchase_date),
    KEY idx_personal_expense_created_by (created_by_admin_uid)
);
