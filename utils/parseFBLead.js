const getFieldValue = (fieldData, key) => {
  if (!Array.isArray(fieldData)) return null;
  const entry = fieldData.find((f) => f.name === key);
  if (!entry || !Array.isArray(entry.values)) return null;
  return entry.values[0] || null;
};

const getFirstFieldValue = (fieldData, keys = []) => {
  for (const key of keys) {
    const value = getFieldValue(fieldData, key);
    if (value) return value;
  }
  return null;
};

const toSqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseFBLead = (raw) => {
  const fieldData = raw?.field_data || [];

  const fullName =
    getFieldValue(fieldData, 'full_name') ||
    [
      getFieldValue(fieldData, 'first_name'),
      getFieldValue(fieldData, 'last_name'),
    ]
      .filter(Boolean)
      .join(' ') ||
    null;

  const email = getFieldValue(fieldData, 'email') || null;
  const phone =
    getFieldValue(fieldData, 'phone_number') ||
    getFieldValue(fieldData, 'phone') ||
    null;

  const address =
    getFieldValue(fieldData, 'street_address') ||
    getFieldValue(fieldData, 'address') ||
    null;

  const date = toSqlDate(
    getFirstFieldValue(fieldData, ['date', 'event_date', 'preferred_date'])
  );
  const eventMonth = toSqlDate(
    getFirstFieldValue(fieldData, ['event_month', 'month'])
  );
  const coverageRaw = getFirstFieldValue(fieldData, [
    'coverage_amount',
    'coverage',
    'budget',
  ]);
  const coverageAmount = coverageRaw
    ? Number.parseFloat(String(coverageRaw).replace(/[^0-9.]/g, ''))
    : null;

  const createdTime = raw?.created_time
    ? new Date(raw.created_time)
    : new Date();

  return {
    full_name: fullName,
    email,
    phone_number: phone,
    address,
    date,
    gender: getFirstFieldValue(fieldData, ['gender']) || null,
    company_name: getFirstFieldValue(fieldData, [
      'company_name',
      'company',
      'organization_name',
    ]),
    event_location: getFirstFieldValue(fieldData, [
      'event_location',
      'location',
      'city',
    ]),
    event_month: eventMonth,
    coverage_amount:
      Number.isFinite(coverageAmount) && coverageAmount >= 0
        ? coverageAmount
        : null,
    created_time: createdTime,
  };
};

module.exports = parseFBLead;
