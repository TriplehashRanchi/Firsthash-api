// require('dotenv').config();

// const admin = require('firebase-admin');

// const {
//   FIREBASE_PROJECT_ID,
//   FIREBASE_CLIENT_EMAIL,
//   FIREBASE_PRIVATE_KEY
// } = process.env;

// const parsedKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

// console.log('✅ Newline count:', (parsedKey.match(/\n/g) || []).length);

// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: FIREBASE_PROJECT_ID,
//     clientEmail: FIREBASE_CLIENT_EMAIL,
//     privateKey: parsedKey,
//   }),
// });

// console.log('✅ Firebase initialized successfully');

// module.exports = admin;


// utils/admin.js
require('dotenv').config();
const admin = require('firebase-admin');

function resolvePrivateKey() {
  // Prefer base64 if you choose to store it that way
  if (process.env.FIREBASE_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64')
      .toString('utf8')
      .replace(/\r/g, '');
  }

  let k = process.env.FIREBASE_PRIVATE_KEY || '';

  // Trim and strip accidental wrapping quotes/backticks from secret UIs
  k = k.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'")) ||
    (k.startsWith('`') && k.endsWith('`'))
  ) {
    k = k.slice(1, -1);
  }

  // Convert escaped newlines -> real newlines (only if they are escaped)
  // If the env already has real newlines, this is a no-op
  k = k.replace(/\\n/g, '\n').replace(/\r/g, '');

  return k;
}

const privateKey = resolvePrivateKey();

// Helpful sanity check (fail fast with a clear message)
if (
  !privateKey.includes('BEGIN PRIVATE KEY') ||
  !privateKey.includes('END PRIVATE KEY') ||
  !/\n/.test(privateKey)
) {
  throw new Error(
    'FIREBASE_PRIVATE_KEY is missing/malformed. ' +
    'Ensure it includes BEGIN/END lines and uses \\n in .env (or set FIREBASE_PRIVATE_KEY_B64).'
  );
}

// Avoid double-initialization in dev/hot-reload
const app =
  admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });

if (process.env.NODE_ENV !== 'production') {
  // This counts *real* newlines, the thing OpenSSL needs.
  const newlineCount = (privateKey.match(/\n/g) || []).length;
  console.log('✅ Firebase Admin ready. Private key newline count:', newlineCount);
}

module.exports = { admin, app };
