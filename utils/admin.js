require('dotenv').config();

const admin = require('firebase-admin');

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY
} = process.env;

const parsedKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

console.log('✅ Newline count:', (parsedKey.match(/\n/g) || []).length);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: parsedKey,
  }),
});

console.log('✅ Firebase initialized successfully');

module.exports = admin;