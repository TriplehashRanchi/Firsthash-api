// backend/firebase/admin.js
const path = require('path');
const admin = require('firebase-admin');

// point at your JSON file
const serviceAccount = require(path.resolve(__dirname, './firebaseAdmin.json'));

// 🔒 Only init once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL, storageBucket, etc., if you need them
  });
}

module.exports = admin;
