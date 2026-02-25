const billingModel = require('../models/billingModel');
const financialsController = require('./financialsController');

function getListFilters(query = {}) {
  return {
    page: query.page,
    limit: query.limit,
    status: query.status,
    projectId: query.project_id || query.projectId,
    clientId: query.client_id || query.clientId,
    search: query.search || query.q,
    dateFrom: query.date_from || query.dateFrom,
    dateTo: query.date_to || query.dateTo,
    sortBy: query.sort_by || query.sortBy,
    sortOrder: query.sort_order || query.sortOrder,
  };
}

exports.getInvoices = async (req, res) => {
  try {
    const companyId = req.company.id;
    const filters = getListFilters(req.query);

    const [listResult, summary] = await Promise.all([
      billingModel.getBillingInvoices(companyId, filters),
      billingModel.getBillingSummary(companyId, filters),
    ]);

    res.json({
      ...listResult,
      summary,
      filtersApplied: filters,
    });
  } catch (err) {
    console.error('Failed to fetch billing invoices:', err);
    res.status(500).json({ error: 'Server error while fetching billing invoices.' });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const companyId = req.company.id;
    const { paymentId } = req.params;

    const invoice = await billingModel.getBillingInvoiceById(companyId, paymentId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    res.json(invoice);
  } catch (err) {
    console.error('Failed to fetch billing invoice by id:', err);
    res.status(500).json({ error: 'Server error while fetching invoice.' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const companyId = req.company.id;
    const filters = getListFilters(req.query);
    const summary = await billingModel.getBillingSummary(companyId, filters);

    res.json(summary);
  } catch (err) {
    console.error('Failed to fetch billing summary:', err);
    res.status(500).json({ error: 'Server error while fetching billing summary.' });
  }
};

exports.searchProjects = async (req, res) => {
  try {
    const companyId = req.company.id;
    const projects = await billingModel.searchProjectsForBilling(
      companyId,
      req.query.q || '',
      req.query.limit
    );

    res.json({ items: projects });
  } catch (err) {
    console.error('Failed to search billing projects:', err);
    res.status(500).json({ error: 'Server error while searching projects.' });
  }
};

exports.createInvoice = async (req, res, next) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required.' });
    }

    if (!req.body.amount) {
      return res.status(400).json({ error: 'amount is required.' });
    }

    if (!req.body.date_received) {
      return res.status(400).json({ error: 'date_received is required.' });
    }

    req.user = req.user || {};
    req.user.company_id = req.user.company_id || req.company?.id;
    req.params.projectId = projectId;
    return financialsController.generateBill(req, res, next);
  } catch (err) {
    console.error('Failed to create unified billing invoice:', err);
    res.status(500).json({ error: 'Server error while creating invoice.' });
  }
};

exports.markInvoiceAsPaid = async (req, res, next) => {
  req.user = req.user || {};
  req.user.company_id = req.user.company_id || req.company?.id;
  return financialsController.markPaymentAsPaid(req, res, next);
};
