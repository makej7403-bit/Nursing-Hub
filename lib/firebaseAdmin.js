// lib/firebaseAdmin.js
/**
 * Server-only Firebase Admin initializer.
 * Expects env var FIREBASE_SERVICE_ACCOUNT to contain the full service account JSON string.
 *
 * Exports:
 *  - getAdminApp()
 *  - getAdminFirestore()
 *  - getAdminStorage()  (returns bucket() object from admin.storage())
 */

import admin from "firebase-admin";

let _adminApp = null;

export function getAdminApp() {
  if (_adminApp) return _adminApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set (service account JSON required).");
  }

  let serviceAccount;
  try {
    serviceAccount = typeof raw === "string" && raw.trim().startsWith("{") ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: " + e.message);
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (serviceAccount.project_id + ".appspot.com");

  _adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName
  });

  return _adminApp;
}

export function getAdminFirestore() {
  return getAdminApp().firestore();
}

export function getAdminStorage() {
  return getAdminApp().storage().bucket();
}
