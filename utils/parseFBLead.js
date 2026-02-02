const getFieldValue = (fieldData, key) => {
  if (!Array.isArray(fieldData)) return null;
  const entry = fieldData.find((f) => f.name === key);
  if (!entry || !Array.isArray(entry.values)) return null;
  return entry.values[0] || null;
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

  const createdTime = raw?.created_time
    ? new Date(raw.created_time)
    : new Date();

  return {
    full_name: fullName,
    email,
    phone_number: phone,
    address,
    created_time: createdTime,
  };
};

module.exports = parseFBLead;
