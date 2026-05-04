const { v4: uuidv4 } = require('uuid');
const {
  getActiveCompanyLocation,
  upsertActiveCompanyLocation,
} = require('../models/companyLocationModel');

const normalizeCoordinate = (value, min, max) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return null;
  }

  return numberValue;
};

const normalizeRadius = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.round(numberValue);
};

exports.getActiveLocation = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const location = await getActiveCompanyLocation(companyId);
    return res.json({ location });
  } catch (error) {
    console.error('getActiveLocation error:', error);
    return res.status(500).json({ error: 'Failed to fetch company location.' });
  }
};

exports.saveActiveLocation = async (req, res) => {
  try {
    const companyId = req.company?.id;
    if (!companyId) {
      return res.status(403).json({ error: 'Company context missing.' });
    }

    const latitude = normalizeCoordinate(req.body?.latitude, -90, 90);
    const longitude = normalizeCoordinate(req.body?.longitude, -180, 180);
    const radiusMeters = normalizeRadius(req.body?.radius_meters ?? 1000);

    if (latitude === null || longitude === null) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    if (radiusMeters === null) {
      return res.status(400).json({ error: 'Radius must be greater than 0.' });
    }

    const location = await upsertActiveCompanyLocation(companyId, {
      id: req.body?.id || uuidv4(),
      location_name: req.body?.location_name || 'Office',
      address: req.body?.address || null,
      latitude,
      longitude,
      radius_meters: radiusMeters,
    });

    return res.json({ success: true, location });
  } catch (error) {
    console.error('saveActiveLocation error:', error);
    return res.status(500).json({ error: 'Failed to save company location.' });
  }
};
