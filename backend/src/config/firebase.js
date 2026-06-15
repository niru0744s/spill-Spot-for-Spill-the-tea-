const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'serviceAccountKey.json';
const absolutePath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(process.cwd(), serviceAccountPath);

try {
  const serviceAccount = require(absolutePath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[Firebase Admin] Initialized successfully using credentials from:', absolutePath);
} catch (error) {
  console.error('[Firebase Admin] Initialization Error!');
  console.error(`Please ensure you have placed your Firebase Service Account JSON file at: ${absolutePath}`);
  console.error(error.message);
  process.exit(1);
}

const db = getFirestore('default');
const auth = admin.auth();

module.exports = { admin, db, auth };
