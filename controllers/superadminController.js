const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.superAdminLogin = async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Login attempt:', email);

  // Check if email matches the super admin email
  if (email !== process.env.SUPERADMIN_EMAIL) {
    console.warn('❌ Invalid email:', email);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Compare password with hashed password
  try {
    const isMatch = await bcrypt.compare(password, process.env.SUPERADMIN_PASSWORD_HASH);
    console.log('🔍 Password match:', isMatch);

    if (!isMatch) {
      console.warn('❌ Password mismatch for Super Admin');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { role: 'superadmin', email },
      process.env.JWT_SECRET_SUPERADMIN,
      { expiresIn: '1d' }
    );

    console.log('✅ Super Admin authenticated. JWT generated.');

    res.json({ token });
  } catch (err) {
    console.error('🔥 Error during Super Admin login:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};
