// File: controllers/shootController.js

const shootModel = require("../models/shootModel");
const userModel = require("../models/userModel");
const { sendShootAssignmentWhatsApp } = require("../utils/sendAiSensyMessage");

/**
 * Handles the API request to update assignments for a service within a shoot.
 */
exports.updateAssignments = async (req, res) => {
  try {
    const { shootId } = req.params;
    const { serviceName, assigneeIds, startAt, endAt } = req.body;
    const company_id = req.company.id;

    if (!serviceName || typeof serviceName !== 'string') {
      return res.status(400).json({ error: 'serviceName is required.' });
    }

    if (!Array.isArray(assigneeIds)) {
      return res.status(400).json({ error: 'assigneeIds must be an array.' });
    }

    const saveResult = await shootModel.updateShootAssignments(
      shootId,
      serviceName,
      assigneeIds,
      company_id,
      startAt,
      endAt
    );

    const shoot = await shootModel.getShootById(shootId, company_id);
    const shootTitle = shoot?.title || "New Shoot";
    const location = shoot?.location || "-";
    const dateTime = shoot?.date_time || "-";
    const shootLink = `${process.env.FRONTEND_URL}/shoots/${shootId}`;

    if (assigneeIds.length > 0) {
      const assignees = await userModel.getUsersByFirebaseUids(assigneeIds);

      for (const a of assignees) {
        if (a.phone) {
          await sendShootAssignmentWhatsApp({
            phone: a.phone,
            assigneeName: a.name,
            shootTitle,
            location,
            dateTime,
            shootLink,
          });
        }
      }
    }

    res.json({
      success: true,
      message: "Assignments updated successfully.",
      slot: { startAt: saveResult.start_at, endAt: saveResult.end_at },
    });
  } catch (err) {
    console.error("❌ Failed to update assignments:", err);
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, conflicts: err.conflicts || [] });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Server error while updating shoot assignments." });
  }
};

exports.getAssignmentAvailability = async (req, res) => {
  try {
    const { shootId } = req.params;
    const { serviceName, startAt, endAt } = req.query;
    const company_id = req.company.id;

    const result = await shootModel.getAssignmentAvailability(
      shootId,
      serviceName,
      startAt,
      endAt,
      company_id
    );

    res.json(result);
  } catch (err) {
    console.error('❌ Failed to get assignment availability:', err);
    if (err.statusCode === 400 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error while fetching assignment availability.' });
  }
};
