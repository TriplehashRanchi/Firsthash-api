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


// /app/utils/admin.js
require('dotenv').config();
const admin = require('firebase-admin');

function decodeB64(name) {
  const v = process.env[name];
  if (!v || !v.trim()) return null;
  try {
    return Buffer.from(v.trim(), 'base64').toString('utf8');
  } catch {
    throw new Error(`${name} is not valid base64.`);
  }
}

function stripWrappingQuotes(s) {
  if (!s) return s;
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('`') && s.endsWith('`'))) {
    return s.slice(1, -1);
  }
  return s;
}

function toPemFromEnv() {
  // 1) Entire JSON (best): FIREBASE_CREDENTIALS_B64
  const credsB64 = decodeB64('FIREBASE_CREDENTIALS_B64');
  if (credsB64) {
    // JSON.parse converts "\n" to real newlines in the private_key automatically.
    const sa = JSON.parse(credsB64);
    return { mode: 'json_b64', serviceAccount: sa };
  }

  // 2) PEM (base64): FIREBASE_PRIVATE_KEY_B64
  const pemB64 = decodeB64('FIREBASE_PRIVATE_KEY_B64');
  if (pemB64) {
    let pk = pemB64.replace(/\r/g, '');
    if (!pk.endsWith('\n')) pk += '\n';
    return { mode: 'pem_b64', privateKey: pk };
  }

  // 3) PEM (escaped \n): FIREBASE_PRIVATE_KEY
  let pk = process.env.FIREBASE_PRIVATE_KEY || '';
  pk = stripWrappingQuotes(pk);

  // Unescape multiple layers of \n (handles \\n and \\\\n)
  for (let i = 0; i < 5 && pk.includes('\\n'); i++) {
    pk = pk.replace(/\\n/g, '\n');
  }
  pk = pk.replace(/\r/g, '');
  if (!pk.endsWith('\n')) pk += '\n';
  return { mode: 'pem_env', privateKey: pk };
}

function validatePemShape(pem) {
  const hasBegin = pem.includes('-----BEGIN PRIVATE KEY-----');
  const hasEnd   = pem.includes('-----END PRIVATE KEY-----');
  const nl = (pem.match(/\n/g) || []).length;
  if (!hasBegin || !hasEnd || nl < 3) {
    const head = JSON.stringify(pem.slice(0, 60));
    const tail = JSON.stringify(pem.slice(-60));
    throw new Error(
      `Private key malformed after cleanup. hasBegin=${hasBegin} hasEnd=${hasEnd} newlineCount=${nl} start=${head} end=${tail}`
    );
  }
}

const mode = toPemFromEnv();

let credential;
if (mode.mode === 'json_b64') {
  const sa = mode.serviceAccount;
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_CREDENTIALS_B64 decoded, but JSON missing project_id/client_email/private_key.');
  }
  // No PEM validation needed; firebase-admin accepts the object as-is.
  credential = admin.credential.cert({
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    privateKey: sa.private_key,
  });
} else {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!projectId || !clientEmail) {
    throw new Error('FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL must be set.');
  }
  validatePemShape(mode.privateKey);
  credential = admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: mode.privateKey,
  });
}

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

module.exports = admin; //

