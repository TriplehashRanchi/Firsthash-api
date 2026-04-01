// backend/controllers/selfController.js
const {
  fetchEmployeeByUid,
  fetchPaymentDetails,
  upsertPaymentDetails,
  fetchAttendanceForUid,
  fetchAttendanceForUidAndDate,
  upsertAttendanceRecord
} = require('../models/memberModel');

const ATTENDANCE_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata';

function getTodayDateInTimezone() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function normalizeAttendanceTime(rawTime) {
  if (typeof rawTime !== 'string') {
    return null;
  }

  const trimmed = rawTime.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || '00');

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return `${match[1]}:${match[2]}:${String(seconds).padStart(2, '0')}`;
}

function timeToSeconds(time) {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}
/**
 * GET /api/self/profile
 * Requires verifyToken (uses req.firebase_uid set by your middleware)
 */
exports.getMyProfile = async (req, res) => {
  try {
    const uid = req.firebase_uid; // set in verifyToken
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const employee = await fetchEmployeeByUid(uid);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Only expose safe fields
    const safe = {
      firebase_uid: employee.firebase_uid,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      employee_type: employee.employee_type, // 0=freelancer, 1=in-house, 2=manager
      status: employee.status,
      address: employee.address ?? null,
      salary: employee.salary ?? null,
      roles: employee.roles ?? [],
    };

    res.json(safe);
  } catch (err) {
    console.error('getMyProfile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/self/payment-details
 * Requires verifyToken
 * Only bank details, no QR or extra fields.
 */
exports.getMyPaymentDetails = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const details = await fetchPaymentDetails(uid);
    // Only send bank details related fields
    const bank = {
      bank_name: details.bank_name ?? '',
      branch_name: details.branch_name ?? '',
      ifsc_code: details.ifsc_code ?? '',
      account_number: details.account_number ?? '',
      account_holder: details.account_holder ?? '',
      account_type: details.account_type ?? '',
      upi_id: details.upi_id ?? '',
    };
    res.json(bank);
  } catch (err) {
    console.error('getMyPaymentDetails error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.updateMyProfile = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    // only allow these fields to be updated by employee
    const { name, phone, address } = req.body || {};
    if (name == null && phone == null && address == null) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    // Reuse your editEmployee model via a local call pattern:
    const pool = require('../config/db');
    const fields = [];
    const params = [];

    if (name != null) { fields.push('name = ?'); params.push(name); }
    if (phone != null) { fields.push('phone = ?'); params.push(phone); }
    if (address != null) { fields.push('address = ?'); params.push(address); }
    params.push(uid);

    await pool.execute(`UPDATE employees SET ${fields.join(', ')} WHERE firebase_uid = ?`, params);

    const updated = await fetchEmployeeByUid(uid);
    // Return only safe subset
    const safe = {
      firebase_uid: updated.firebase_uid,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      employee_type: updated.employee_type,
      status: updated.status,
      address: updated.address ?? null,
      salary: updated.salary ?? null,
      roles: updated.roles ?? [],
    };
    res.json(safe);
  } catch (err) {
    console.error('updateMyProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

// PUT /api/self/payment-details
exports.updateMyPaymentDetails = async (req, res) => {
  try {
    const uid = req.firebase_uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const {
      bank_name      = null,
      branch_name    = null,
      ifsc_code      = null,
      account_number = null,
      account_holder = null,
      account_type   = null,
      upi_id         = null
    } = req.body || {};

    await upsertPaymentDetails(uid, {
      bank_name,
      branch_name,
      ifsc_code,
      account_number,
      account_holder,
      account_type,
      upi_id
    });

    res.json({ success: true });
  } catch (err) {
    console.error('updateMyPaymentDetails error:', err);
    res.status(500).json({ error: 'Failed to update bank details.' });
  }
};



exports.getMyAttendance = async (req, res) => {
  try {
    // The middleware provides req.firebase_uid. We use that directly.
    const employeeUid = req.firebase_uid; 
    
    if (!employeeUid) {
      // This is a safety check in case the middleware fails for some reason
      return res.status(401).json({ error: "Authentication details not found." });
    }

    const records = await fetchAttendanceForUid(employeeUid);
    res.json(records);
    
  } catch (err) {
    console.error("getMyAttendance error:", err.stack || err);
    res.status(500).json({ error: "Failed to load your attendance records." });
  }
};

exports.markMyAttendanceManually = async (req, res) => {
  try {
    const employeeUid = req.user?.firebase_uid || req.firebase_uid;
    const employeeType = req.user?.employee_type;
    const { mark_type, time } = req.body || {};

    if (!employeeUid) {
      return res.status(401).json({ error: 'Authentication details not found.' });
    }

    if (![1, 2].includes(employeeType)) {
      return res.status(403).json({ error: 'Only employees and managers can mark attendance manually.' });
    }

    if (!['in_time', 'out_time'].includes(mark_type)) {
      return res.status(400).json({ error: "mark_type must be either 'in_time' or 'out_time'." });
    }

    const normalizedTime = normalizeAttendanceTime(time);
    if (!normalizedTime) {
      return res.status(400).json({ error: 'time must be in HH:MM or HH:MM:SS format.' });
    }

    const today = getTodayDateInTimezone();
    const existingRecord = await fetchAttendanceForUidAndDate(employeeUid, today);

    if (mark_type === 'in_time') {
      if (existingRecord?.in_time) {
        return res.status(409).json({ error: 'Today in-time is already marked.' });
      }

      if (existingRecord?.out_time) {
        return res.status(409).json({ error: 'Out-time already exists for today. Contact admin to correct this record.' });
      }
    }

    if (mark_type === 'out_time') {
      if (!existingRecord?.in_time) {
        return res.status(409).json({ error: 'Mark today in-time first before adding out-time.' });
      }

      if (existingRecord?.out_time) {
        return res.status(409).json({ error: 'Today out-time is already marked.' });
      }

      if (timeToSeconds(normalizedTime) <= timeToSeconds(existingRecord.in_time)) {
        return res.status(400).json({ error: 'Out-time must be later than today in-time.' });
      }
    }

    await upsertAttendanceRecord({
      firebase_uid: employeeUid,
      a_date: today,
      in_time: mark_type === 'in_time' ? normalizedTime : existingRecord?.in_time || null,
      out_time: mark_type === 'out_time' ? normalizedTime : existingRecord?.out_time || null,
      a_status: 1
    });

    const savedRecord = await fetchAttendanceForUidAndDate(employeeUid, today);
    return res.json({
      success: true,
      message: `${mark_type === 'in_time' ? 'In-time' : 'Out-time'} marked successfully for today.`,
      record: savedRecord
    });
  } catch (err) {
    console.error('markMyAttendanceManually error:', err.stack || err);
    return res.status(500).json({ error: 'Failed to mark attendance manually.' });
  }
};
exports.getMyOwnAttendance = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ error: 'Authorization token is missing or invalid.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log("idToken:", idToken);

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const employeeUid = decodedToken.uid;

    if (!employeeUid) {
      return res.status(401).json({ error: "Could not identify user from token." });
    }
    
    const records = await fetchAttendanceForUid(employeeUid);
    res.json(records);

  } catch (err) {
    console.error("getMyOwnAttendance error:", err);
    res.status(500).json({ error: "Failed to load your attendance records." });
  }
};
