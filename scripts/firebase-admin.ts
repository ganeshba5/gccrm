// Firebase Admin SDK initialization for Node.js scripts
// Admin SDK bypasses security rules and is suitable for server-side scripts
// 
// To use this, you need to:
// 1. Download your service account key from Firebase Console
// 2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
//    OR place the key file at: scripts/serviceAccountKey.json

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let db;

try {
  // Check if already initialized
  if (getApps().length === 0) {
    let serviceAccount = null;
    
    // Try to load service account key
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use path from environment variable
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (existsSync(keyPath)) {
        serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
      }
    } else {
      // Try default location
      const defaultPath = join(process.cwd(), 'scripts', 'serviceAccountKey.json');
      if (existsSync(defaultPath)) {
        serviceAccount = JSON.parse(readFileSync(defaultPath, 'utf8'));
      }
    }
    
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with service account');
    } else {
      // Try to use default credentials (if running on GCP or with gcloud auth)
      console.log('No service account key found. Trying default credentials...');
      initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    }
  }
  
  db = getFirestore();
  console.log('Firebase Admin Firestore ready\n');
} catch (error: any) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.error('\nTo fix this:');
  console.error('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save it as scripts/serviceAccountKey.json');
  console.error('   OR set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  throw error;
}

export { db };
export default db;

