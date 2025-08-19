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

/**
 * Turn whatever the hosting platform gives us into a valid PEM string.
 * - Supports FIREBASE_PRIVATE_KEY_B64 (base64-encoded key) OR FIREBASE_PRIVATE_KEY (escaped \n)
 * - Strips accidental wrapping quotes/backticks
 * - Unescapes \n repeatedly (handles "\\n" and "\\\\n" cases)
 * - Removes \r (CRLF) and ensures trailing newline after END line
 */
function resolvePrivateKey() {
  // Preferred path: base64 (most reliable across Render/Railway/GitHub Actions)
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (b64 && b64.trim()) {
    let k = Buffer.from(b64.trim(), 'base64').toString('utf8');
    k = k.replace(/\r/g, '');
    if (!k.endsWith('\n')) k += '\n';
    return k;
  }

  // Fallback: escaped newlines in env var
  let k = process.env.FIREBASE_PRIVATE_KEY || '';
  k = k.trim();

  // Strip accidental wrapping quotes/backticks from secret UIs
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'")) ||
    (k.startsWith('`') && k.endsWith('`'))
  ) {
    k = k.slice(1, -1);
  }

  // Repeatedly unescape \n until none remain (handles \n, \\n, \\\\n edge cases)
  let guard = 0;
  while (k.includes('\\n') && guard < 5) {
    k = k.replace(/\\n/g, '\n');
    guard++;
  }

  // Remove CRs (Windows newlines)
  k = k.replace(/\r/g, '');

  // Ensure single trailing newline (OpenSSL is picky)
  if (!k.endsWith('\n')) k += '\n';

  return k;
}

function sanityCheckPem(k) {
  // Do NOT log the key. Just validate its *shape*.
  const hasBegin = k.includes('-----BEGIN PRIVATE KEY-----');
  const hasEnd   = k.includes('-----END PRIVATE KEY-----');
  const newlineCount = (k.match(/\n/g) || []).length;

  if (!hasBegin || !hasEnd || newlineCount < 3) {
    const head = k.slice(0, 50);
    const tail = k.slice(-50);
    throw new Error(
      [
        'FIREBASE_PRIVATE_KEY still malformed after cleanup.',
        `Contains BEGIN: ${hasBegin}, END: ${hasEnd}, newlineCount: ${newlineCount}`,
        // Show the first/last chars only (safe), to catch stray quotes/backticks
        `Start preview: ${JSON.stringify(head)}`,
        `End preview: ${JSON.stringify(tail)}`
      ].join(' | ')
    );
  }
}

const privateKey = resolvePrivateKey();
sanityCheckPem(privateKey);

// Avoid double init in dev/hot-reload
const app =
  admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });

if (process.env.NODE_ENV !== 'production') {
  console.log('✅ Firebase Admin initialized.');
}

module.exports = { admin, app };

