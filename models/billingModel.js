const db = require('../config/db');

const ALLOWED_SORT_FIELDS = new Set(['date_received', 'created_at', 'amount', 'project_name', 'client_name', 'status']);
const ALLOWED_SORT_ORDERS = new Set(['ASC', 'DESC']);

function normalizeStatusValue(rawStatus) {
  if (!rawStatus) return 'paid';
  if (rawStatus === 'pending') return 'pending';
  if (rawStatus === 'paid') return 'paid';
  return rawStatus;
}

function buildFilters(companyId, filters = {}, { includeDateFilters = true } = {}) {
  const where = [
    'p.company_id = ?',
    "COALESCE(rp.type, 'received') = 'received'",
  ];
  const params = [companyId];

  if (filters.projectId) {
    where.push('rp.project_id = ?');
    params.push(filters.projectId);
  }

  if (filters.clientId) {
    where.push('p.client_id = ?');
    params.push(filters.clientId);
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'paid') {
      where.push("(rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')");
    } else if (filters.status === 'pending') {
      where.push("rp.status = 'pending'");
    }
  }

  if (includeDateFilters && filters.dateFrom) {
    where.push('DATE(COALESCE(rp.date_received, rp.created_at)) >= ?');
    params.push(filters.dateFrom);
  }

  if (includeDateFilters && filters.dateTo) {
    where.push('DATE(COALESCE(rp.date_received, rp.created_at)) <= ?');
    params.push(filters.dateTo);
  }

  if (filters.search) {
    where.push(`(
      p.name LIKE ?
      OR c.name LIKE ?
      OR c.phone LIKE ?
      OR rp.description LIKE ?
      OR CAST(rp.id AS CHAR) LIKE ?
    )`);
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like);
  }

  return { whereSql: where.join(' AND '), params };
}

exports.getBillingInvoices = async (companyId, filters = {}) => {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : 'created_at';
  const sortOrder = ALLOWED_SORT_ORDERS.has(String(filters.sortOrder || '').toUpperCase())
    ? String(filters.sortOrder).toUpperCase()
    : 'DESC';

  const sortColumnMap = {
    date_received: 'COALESCE(rp.date_received, rp.created_at)',
    created_at: 'rp.created_at',
    amount: 'rp.amount',
    project_name: 'p.name',
    client_name: 'c.name',
    status: 'COALESCE(rp.status, "paid")',
  };

  const { whereSql, params } = buildFilters(companyId, filters);

  const [rows] = await db.query(
    `
    SELECT
      rp.id,
      rp.project_id AS projectId,
      rp.amount,
      rp.description,
      rp.type,
      rp.file_url AS fileUrl,
      rp.is_gst AS isGst,
      rp.gst_number AS gstNumber,
      rp.status,
      rp.date_received AS dateReceived,
      rp.created_at AS createdAt,
      p.name AS projectName,
      p.total_cost AS projectTotalCost,
      p.client_id AS clientId,
      c.name AS clientName,
      c.phone AS clientPhone,
      c.email AS clientEmail,
      COALESCE(ps.received_amount, 0) AS projectReceivedAmount,
      GREATEST(COALESCE(p.total_cost, 0) - COALESCE(ps.received_amount, 0), 0) AS projectRemainingAmount,
      GREATEST(COALESCE(p.total_cost, 0) - COALESCE(ps.invoiced_amount, 0), 0) AS projectCollectableAmount,
      COALESCE(ps.invoiced_amount, 0) AS projectInvoicedAmount
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    INNER JOIN clients c ON c.id = p.client_id
    LEFT JOIN (
      SELECT
        rp2.project_id,
        SUM(CASE
          WHEN COALESCE(rp2.type, 'received') = 'received' THEN COALESCE(rp2.amount, 0)
          ELSE 0
        END) AS invoiced_amount,
        SUM(CASE
          WHEN COALESCE(rp2.type, 'received') = 'received'
            AND (rp2.status = 'paid' OR rp2.status IS NULL OR rp2.status = '')
          THEN COALESCE(rp2.amount, 0)
          ELSE 0
        END) AS received_amount
      FROM received_payments rp2
      GROUP BY rp2.project_id
    ) ps ON ps.project_id = p.id
    WHERE ${whereSql}
    ORDER BY ${sortColumnMap[sortField]} ${sortOrder}, rp.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    INNER JOIN clients c ON c.id = p.client_id
    WHERE ${whereSql}
    `,
    params
  );

  return {
    items: rows.map((row) => ({
      ...row,
      status: normalizeStatusValue(row.status),
    })),
    pagination: {
      page,
      limit,
      total: countRows[0]?.total || 0,
      totalPages: Math.ceil((countRows[0]?.total || 0) / limit) || 0,
    },
  };
};

exports.getBillingSummary = async (companyId, filters = {}) => {
  const { whereSql, params } = buildFilters(companyId, filters);

  const [rows] = await db.query(
    `
    SELECT
      COUNT(*) AS invoiceCount,
      COALESCE(SUM(rp.amount), 0) AS totalInvoiceAmount,
      COALESCE(SUM(CASE
        WHEN rp.status = 'pending' THEN rp.amount
        ELSE 0
      END), 0) AS pendingInvoiceAmount,
      COALESCE(SUM(CASE
        WHEN rp.status = 'paid' OR rp.status IS NULL OR rp.status = '' THEN rp.amount
        ELSE 0
      END), 0) AS paidInvoiceAmount,
      COUNT(DISTINCT rp.project_id) AS projectCount,
      COUNT(DISTINCT p.client_id) AS clientCount
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    INNER JOIN clients c ON c.id = p.client_id
    WHERE ${whereSql}
    `,
    params
  );

  const [projectSummaryRows] = await db.query(
    `
    SELECT
      COALESCE(SUM(project_total), 0) AS totalProjectValue,
      COALESCE(SUM(project_received), 0) AS totalReceivedAmount,
      COALESCE(SUM(GREATEST(project_total - project_received, 0)), 0) AS totalRemainingAmount,
      COALESCE(SUM(GREATEST(project_total - project_invoiced, 0)), 0) AS totalCollectableAmount
    FROM (
      SELECT
        p.id AS project_id,
        COALESCE(p.total_cost, 0) AS project_total,
        COALESCE(SUM(CASE
          WHEN COALESCE(rp.type, 'received') = 'received'
            AND (rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')
          THEN COALESCE(rp.amount, 0)
          ELSE 0
        END), 0) AS project_received,
        COALESCE(SUM(CASE
          WHEN COALESCE(rp.type, 'received') = 'received'
          THEN COALESCE(rp.amount, 0)
          ELSE 0
        END), 0) AS project_invoiced
      FROM projects p
      INNER JOIN clients c ON c.id = p.client_id
      INNER JOIN received_payments rp ON rp.project_id = p.id
      WHERE ${whereSql}
      GROUP BY p.id, p.total_cost
    ) s
    `,
    params
  );

  return {
    ...(rows[0] || {}),
    ...(projectSummaryRows[0] || {}),
  };
};

exports.searchProjectsForBilling = async (companyId, q = '', limit = 20) => {
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const trimmedQuery = String(q || '').trim();

  const where = ['p.company_id = ?'];
  const params = [companyId];

  if (trimmedQuery) {
    const like = `%${trimmedQuery}%`;
    where.push('(p.name LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
    params.push(like, like, like);
  }

  const [rows] = await db.query(
    `
    SELECT
      p.id,
      p.name AS projectName,
      p.total_cost AS projectTotalCost,
      c.id AS clientId,
      c.name AS clientName,
      c.phone AS clientPhone,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
          AND (rp.status = 'paid' OR rp.status IS NULL OR rp.status = '')
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS receivedAmount,
      COALESCE(SUM(CASE
        WHEN COALESCE(rp.type, 'received') = 'received'
        THEN COALESCE(rp.amount, 0)
        ELSE 0
      END), 0) AS invoicedAmount
    FROM projects p
    INNER JOIN clients c ON c.id = p.client_id
    LEFT JOIN received_payments rp ON rp.project_id = p.id
    WHERE ${where.join(' AND ')}
    GROUP BY p.id, p.name, p.total_cost, c.id, c.name, c.phone
    ORDER BY p.created_at DESC
    LIMIT ?
    `,
    [...params, normalizedLimit]
  );

  return rows.map((row) => ({
    ...row,
    remainingAmount: Math.max(Number(row.projectTotalCost || 0) - Number(row.receivedAmount || 0), 0),
    collectableAmount: Math.max(Number(row.projectTotalCost || 0) - Number(row.invoicedAmount || 0), 0),
  }));
};

exports.getBillingInvoiceById = async (companyId, invoiceId) => {
  const [rows] = await db.query(
    `
    SELECT
      rp.id,
      rp.project_id AS projectId,
      rp.amount,
      rp.description,
      rp.type,
      rp.file_url AS fileUrl,
      rp.is_gst AS isGst,
      rp.gst_number AS gstNumber,
      rp.status,
      rp.date_received AS dateReceived,
      rp.created_at AS createdAt,
      p.name AS projectName,
      p.status AS projectStatus,
      p.total_cost AS projectTotalCost,
      p.package_cost AS projectPackageCost,
      p.additional_deliverables_cost AS projectAdditionalCost,
      p.client_id AS clientId,
      c.name AS clientName,
      c.phone AS clientPhone,
      c.email AS clientEmail,
      c.relation AS clientRelation,
      COALESCE(ps.received_amount, 0) AS projectReceivedAmount,
      GREATEST(COALESCE(p.total_cost, 0) - COALESCE(ps.received_amount, 0), 0) AS projectRemainingAmount,
      GREATEST(COALESCE(p.total_cost, 0) - COALESCE(ps.invoiced_amount, 0), 0) AS projectCollectableAmount,
      COALESCE(ps.invoiced_amount, 0) AS projectInvoicedAmount
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    INNER JOIN clients c ON c.id = p.client_id
    LEFT JOIN (
      SELECT
        rp2.project_id,
        SUM(CASE
          WHEN COALESCE(rp2.type, 'received') = 'received' THEN COALESCE(rp2.amount, 0)
          ELSE 0
        END) AS invoiced_amount,
        SUM(CASE
          WHEN COALESCE(rp2.type, 'received') = 'received'
            AND (rp2.status = 'paid' OR rp2.status IS NULL OR rp2.status = '')
          THEN COALESCE(rp2.amount, 0)
          ELSE 0
        END) AS received_amount
      FROM received_payments rp2
      GROUP BY rp2.project_id
    ) ps ON ps.project_id = p.id
    WHERE p.company_id = ?
      AND rp.id = ?
      AND COALESCE(rp.type, 'received') = 'received'
    LIMIT 1
    `,
    [companyId, invoiceId]
  );

  if (!rows.length) return null;

  const invoice = {
    ...rows[0],
    status: normalizeStatusValue(rows[0].status),
  };

  const [historyRows] = await db.query(
    `
    SELECT
      rp.id,
      rp.project_id AS projectId,
      rp.amount,
      rp.description,
      rp.file_url AS fileUrl,
      rp.status,
      rp.is_gst AS isGst,
      rp.date_received AS dateReceived,
      rp.created_at AS createdAt
    FROM received_payments rp
    INNER JOIN projects p ON p.id = rp.project_id
    WHERE p.company_id = ?
      AND rp.project_id = ?
      AND COALESCE(rp.type, 'received') = 'received'
    ORDER BY COALESCE(rp.date_received, rp.created_at) DESC, rp.id DESC
    `,
    [companyId, invoice.projectId]
  );

  return {
    ...invoice,
    history: historyRows.map((row) => ({
      ...row,
      status: normalizeStatusValue(row.status),
      isCurrent: String(row.id) === String(invoiceId),
    })),
  };
};
