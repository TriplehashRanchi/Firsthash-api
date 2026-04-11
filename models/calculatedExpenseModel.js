const db = require('../config/db');

function buildDateClause(dateExpression, filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.dateFrom) {
    clauses.push(`${dateExpression} >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`${dateExpression} <= ?`);
    params.push(filters.dateTo);
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

function getPeriodSelect(granularity, dateExpression) {
  if (granularity === 'yearly') {
    return {
      key: `DATE_FORMAT(${dateExpression}, '%Y')`,
      label: `DATE_FORMAT(${dateExpression}, '%Y')`,
    };
  }

  return {
    key: `DATE_FORMAT(${dateExpression}, '%Y-%m')`,
    label: `DATE_FORMAT(${dateExpression}, '%b %Y')`,
  };
}

async function getRevenueSummary(companyId, filters) {
  const dateClause = buildDateClause('DATE(COALESCE(rp.date_received, rp.created_at))', filters);
  const [rows] = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received' THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS totalRecordedRevenue,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
          AND (rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS totalReceivedRevenue,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
          AND rp.status = 'pending'
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS totalPendingRevenue
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    WHERE p.company_id = ?
    ${dateClause.sql}
    `,
    [companyId, ...dateClause.params]
  );

  return rows[0] || {};
}

async function getExpenseSummary(companyId, filters) {
  const projectDate = buildDateClause('DATE(e.expense_date)', filters);
  const personalDate = buildDateClause('DATE(pe.purchase_date)', filters);
  const salaryDate = buildDateClause(
    `STR_TO_DATE(CONCAT(es.period_year, '-', LPAD(es.period_month, 2, '0'), '-01'), '%Y-%m-%d')`,
    filters
  );
  const freelancerDate = buildDateClause('DATE(fp.payment_date)', filters);

  const [[projectRow], [personalRow], [salaryRow], [freelancerRow]] = await Promise.all([
    db.query(
      `
      SELECT COALESCE(SUM(e.amount), 0) AS totalProjectExpense
      FROM expenses e
      WHERE e.company_id = ?
      ${projectDate.sql}
      `,
      [companyId, ...projectDate.params]
    ),
    db.query(
      `
      SELECT COALESCE(SUM(pe.rupees), 0) AS totalPersonalExpense
      FROM personal_expense pe
      WHERE pe.company_id = ?
      ${personalDate.sql}
      `,
      [companyId, ...personalDate.params]
    ),
    db.query(
      `
      SELECT COALESCE(SUM(es.amount_paid), 0) AS totalSalaryExpense
      FROM employee_salaries es
      WHERE es.company_id = ?
        AND COALESCE(es.amount_paid, 0) > 0
      ${salaryDate.sql}
      `,
      [companyId, ...salaryDate.params]
    ),
    db.query(
      `
      SELECT COALESCE(SUM(fp.payment_amount), 0) AS totalFreelancerExpense
      FROM freelancer_payments fp
      INNER JOIN employees e ON e.firebase_uid = fp.freelancer_uid
      WHERE e.company_id = ?
      ${freelancerDate.sql}
      `,
      [companyId, ...freelancerDate.params]
    ),
  ]);

  return {
    totalProjectExpense: Number(projectRow?.totalProjectExpense || 0),
    totalPersonalExpense: Number(personalRow?.totalPersonalExpense || 0),
    totalSalaryExpense: Number(salaryRow?.totalSalaryExpense || 0),
    totalFreelancerExpense: Number(freelancerRow?.totalFreelancerExpense || 0),
  };
}

async function getTrendRows(companyId, filters) {
  const granularity = filters.granularity === 'yearly' ? 'yearly' : 'monthly';

  const revenuePeriod = getPeriodSelect(granularity, 'DATE(COALESCE(rp.date_received, rp.created_at))');
  const revenueDate = buildDateClause('DATE(COALESCE(rp.date_received, rp.created_at))', filters);
  const [revenueRows] = await db.query(
    `
    SELECT
      ${revenuePeriod.key} AS periodKey,
      ${revenuePeriod.label} AS periodLabel,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
          AND (rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS receivedRevenue,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
          AND rp.status = 'pending'
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS pendingRevenue
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    WHERE p.company_id = ?
    ${revenueDate.sql}
    GROUP BY periodKey, periodLabel
    ORDER BY periodKey ASC
    `,
    [companyId, ...revenueDate.params]
  );

  const projectPeriod = getPeriodSelect(granularity, 'DATE(e.expense_date)');
  const projectDate = buildDateClause('DATE(e.expense_date)', filters);
  const [projectExpenseRows] = await db.query(
    `
    SELECT
      ${projectPeriod.key} AS periodKey,
      COALESCE(SUM(e.amount), 0) AS projectExpense
    FROM expenses e
    WHERE e.company_id = ?
    ${projectDate.sql}
    GROUP BY periodKey
    ORDER BY periodKey ASC
    `,
    [companyId, ...projectDate.params]
  );

  const personalPeriod = getPeriodSelect(granularity, 'DATE(pe.purchase_date)');
  const personalDate = buildDateClause('DATE(pe.purchase_date)', filters);
  const [personalExpenseRows] = await db.query(
    `
    SELECT
      ${personalPeriod.key} AS periodKey,
      COALESCE(SUM(pe.rupees), 0) AS personalExpense
    FROM personal_expense pe
    WHERE pe.company_id = ?
    ${personalDate.sql}
    GROUP BY periodKey
    ORDER BY periodKey ASC
    `,
    [companyId, ...personalDate.params]
  );

  const salaryPeriod = getPeriodSelect(
    granularity,
    `STR_TO_DATE(CONCAT(es.period_year, '-', LPAD(es.period_month, 2, '0'), '-01'), '%Y-%m-%d')`
  );
  const salaryDate = buildDateClause(
    `STR_TO_DATE(CONCAT(es.period_year, '-', LPAD(es.period_month, 2, '0'), '-01'), '%Y-%m-%d')`,
    filters
  );
  const [salaryExpenseRows] = await db.query(
    `
    SELECT
      ${salaryPeriod.key} AS periodKey,
      COALESCE(SUM(es.amount_paid), 0) AS salaryExpense
    FROM employee_salaries es
    WHERE es.company_id = ?
      AND COALESCE(es.amount_paid, 0) > 0
    ${salaryDate.sql}
    GROUP BY periodKey
    ORDER BY periodKey ASC
    `,
    [companyId, ...salaryDate.params]
  );

  const freelancerPeriod = getPeriodSelect(granularity, 'DATE(fp.payment_date)');
  const freelancerDate = buildDateClause('DATE(fp.payment_date)', filters);
  const [freelancerExpenseRows] = await db.query(
    `
    SELECT
      ${freelancerPeriod.key} AS periodKey,
      COALESCE(SUM(fp.payment_amount), 0) AS freelancerExpense
    FROM freelancer_payments fp
    INNER JOIN employees e ON e.firebase_uid = fp.freelancer_uid
    WHERE e.company_id = ?
    ${freelancerDate.sql}
    GROUP BY periodKey
    ORDER BY periodKey ASC
    `,
    [companyId, ...freelancerDate.params]
  );

  return {
    revenueRows,
    projectExpenseRows,
    personalExpenseRows,
    salaryExpenseRows,
    freelancerExpenseRows,
  };
}

async function getProjectPerformance(companyId, filters = {}, limit = 10) {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);
  const revenueDate = buildDateClause('DATE(COALESCE(rp.date_received, rp.created_at))', filters);
  const projectExpenseDate = buildDateClause('DATE(e.expense_date)', filters);
  const billingDate = buildDateClause('DATE(fb.billing_date)', filters);

  const [rows] = await db.query(
    `
    SELECT
      p.id AS projectId,
      p.name AS projectName,
      c.name AS clientName,
      COALESCE(rev.receivedRevenue, 0) AS receivedRevenue,
      COALESCE(exp.projectExpense, 0) AS projectExpense,
      COALESCE(freelancer.freelancerBilledCost, 0) AS freelancerBilledCost,
      COALESCE(exp.projectExpense, 0) + COALESCE(freelancer.freelancerBilledCost, 0) AS totalProjectSpend,
      COALESCE(rev.receivedRevenue, 0) - (COALESCE(exp.projectExpense, 0) + COALESCE(freelancer.freelancerBilledCost, 0)) AS projectProfit
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN (
      SELECT
        rp.project_id,
        COALESCE(SUM(CASE
          WHEN COALESCE(rp.type, 'received') = 'received'
            AND (rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')
          THEN COALESCE(rp.amount, 0)
          ELSE 0
        END), 0) AS receivedRevenue
      FROM received_payments rp
      INNER JOIN projects p2 ON p2.id = rp.project_id
      WHERE p2.company_id = ?
      ${revenueDate.sql}
      GROUP BY rp.project_id
    ) rev ON rev.project_id = p.id
    LEFT JOIN (
      SELECT
        e.project_id,
        COALESCE(SUM(e.amount), 0) AS projectExpense
      FROM expenses e
      WHERE e.company_id = ?
      ${projectExpenseDate.sql}
      GROUP BY e.project_id
    ) exp ON exp.project_id = p.id
    LEFT JOIN (
      SELECT
        project_id,
        COALESCE(SUM(fee), 0) AS freelancerBilledCost
      FROM (
        SELECT
          s.project_id,
          fb.fee
        FROM freelancer_billings fb
        INNER JOIN shoot_assignments sa ON sa.id = fb.assignment_id AND fb.assignment_type = 'shoot'
        INNER JOIN shoots s ON s.id = sa.shoot_id
        WHERE fb.company_id = ?
        ${billingDate.sql}

        UNION ALL

        SELECT
          t.project_id,
          fb.fee
        FROM freelancer_billings fb
        INNER JOIN tasks t ON t.id = SUBSTRING_INDEX(fb.assignment_id_composite, '-', 1)
        WHERE fb.company_id = ?
          AND fb.assignment_type = 'task'
          AND t.project_id IS NOT NULL
        ${billingDate.sql}
      ) billed_costs
      GROUP BY project_id
    ) freelancer ON freelancer.project_id = p.id
    WHERE p.company_id = ?
    ORDER BY projectProfit DESC, receivedRevenue DESC, p.name ASC
    LIMIT ?
    `,
    [
      companyId,
      ...revenueDate.params,
      companyId,
      ...projectExpenseDate.params,
      companyId,
      ...billingDate.params,
      companyId,
      ...billingDate.params,
      companyId,
      normalizedLimit,
    ]
  );

  return rows;
}

module.exports = {
  getRevenueSummary,
  getExpenseSummary,
  getTrendRows,
  getProjectPerformance,
};
