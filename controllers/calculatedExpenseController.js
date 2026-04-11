const calculatedExpenseModel = require('../models/calculatedExpenseModel');

function normalizeFilters(query = {}) {
  return {
    dateFrom: query.date_from || query.dateFrom || null,
    dateTo: query.date_to || query.dateTo || null,
    granularity: query.granularity === 'yearly' ? 'yearly' : 'monthly',
    topProjectsLimit: query.top_projects_limit || query.topProjectsLimit || 10,
  };
}

exports.getCalculatedExpenseOverview = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const filters = normalizeFilters(req.query);

    const [revenueSummary, expenseSummary, trendRows, projectPerformance] = await Promise.all([
      calculatedExpenseModel.getRevenueSummary(companyId, filters),
      calculatedExpenseModel.getExpenseSummary(companyId, filters),
      calculatedExpenseModel.getTrendRows(companyId, filters),
      calculatedExpenseModel.getProjectPerformance(companyId, filters, filters.topProjectsLimit),
    ]);

    const totalSpend =
      Number(expenseSummary.totalProjectExpense || 0) +
      Number(expenseSummary.totalPersonalExpense || 0) +
      Number(expenseSummary.totalSalaryExpense || 0) +
      Number(expenseSummary.totalFreelancerExpense || 0);

    const totalReceivedRevenue = Number(revenueSummary.totalReceivedRevenue || 0);

    res.json({
      filtersApplied: filters,
      summary: {
        totalRecordedRevenue: Number(revenueSummary.totalRecordedRevenue || 0),
        totalReceivedRevenue,
        totalPendingRevenue: Number(revenueSummary.totalPendingRevenue || 0),
        totalProjectExpense: Number(expenseSummary.totalProjectExpense || 0),
        totalPersonalExpense: Number(expenseSummary.totalPersonalExpense || 0),
        totalSalaryExpense: Number(expenseSummary.totalSalaryExpense || 0),
        totalFreelancerExpense: Number(expenseSummary.totalFreelancerExpense || 0),
        totalSpend,
        totalProfit: totalReceivedRevenue - totalSpend,
      },
      trends: trendRows,
      projectPerformance,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to fetch calculated expense overview:', err);
    res.status(500).json({ error: 'Failed to load calculated expense overview.' });
  }
};
