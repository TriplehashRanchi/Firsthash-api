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
    const { serviceName, assigneeIds } = req.body;
    const company_id = req.company.id;

    await shootModel.updateShootAssignments(shootId, serviceName, assigneeIds, company_id);

    const shoot = await shootModel.getShootById(shootId, company_id);
    const shootTitle = shoot?.title || "New Shoot";
    const location = shoot?.location || "-";
    const dateTime = shoot?.date_time || "-";
    const shootLink = `${process.env.FRONTEND_URL}/shoots/${shootId}`;

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

    res.json({ success: true, message: "Assignments updated and WhatsApp sent." });
  } catch (err) {
    console.error("❌ Failed to update assignments:", err);
    res.status(500).json({ error: "Server error while updating shoot assignments." });
  }
};