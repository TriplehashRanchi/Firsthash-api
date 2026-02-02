const express = require('express');
const router = express.Router();
const {
  saveFbPages,
  getSavedFbPages,
  deleteSavedFbPages,
  deleteAllSavedFbPages,
  getAvailableFbPages,
  selectFbPages,
} = require('../controllers/fbPageController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.post('/pages', verifyToken, requireAdmin, saveFbPages);
router.get('/pages', verifyToken, requireAdmin, getSavedFbPages);
router.get('/pages/available', verifyToken, requireAdmin, getAvailableFbPages);
router.post('/pages/select', verifyToken, requireAdmin, selectFbPages);
router.delete('/pages/:pageID', verifyToken, requireAdmin, deleteSavedFbPages);
router.delete('/pages', verifyToken, requireAdmin, deleteAllSavedFbPages);

module.exports = router;
