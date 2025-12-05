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
    
    // Option 1: Service account key as JSON string in environment variable (for GitHub Actions)
    const serviceAccountKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyEnv && serviceAccountKeyEnv.trim().length > 0) {
      try {
        serviceAccount = JSON.parse(serviceAccountKeyEnv.trim());
        console.log('Firebase Admin: Using service account from environment variable');
      } catch (parseError: any) {
        console.warn('Firebase Admin: Failed to parse service account key from environment variable:', parseError.message);
      }
    }
    
    // Option 2: Service account key from file path
    if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use path from environment variable
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (existsSync(keyPath)) {
        serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
        console.log('Firebase Admin: Using service account from file path');
      }
    }
    
    // Option 3: Try default location
    if (!serviceAccount) {
      const defaultPath = join(process.cwd(), 'scripts', 'serviceAccountKey.json');
      if (existsSync(defaultPath)) {
        serviceAccount = JSON.parse(readFileSync(defaultPath, 'utf8'));
        console.log('Firebase Admin: Using service account from default location');
      }
    }
    
    if (serviceAccount) {
      // Check if project ID from service account matches .env
      const serviceAccountProjectId = serviceAccount.project_id;
      const envProjectId = process.env.VITE_FIREBASE_PROJECT_ID;
      
      if (envProjectId && serviceAccountProjectId !== envProjectId) {
        console.warn(`⚠️  WARNING: Project ID mismatch!`);
        console.warn(`   Service Account Key: ${serviceAccountProjectId}`);
        console.warn(`   .env file: ${envProjectId}`);
        console.warn(`   Scripts will use: ${serviceAccountProjectId}`);
        console.warn(`   Web app uses: ${envProjectId}`);
        console.warn(`   → You need a service account key for "${envProjectId}" project\n`);
      }
      
      initializeApp({
        credential: cert(serviceAccount),
        // Optionally override project ID from environment
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id
      });
      console.log(`Firebase Admin initialized with service account (project: ${serviceAccount.project_id})`);
    } else {
      // Try to use default credentials (if running on GCP or with gcloud auth)
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      if (projectId) {
        initializeApp({ projectId });
        console.log(`Firebase Admin initialized with project: ${projectId}`);
      } else {
        console.log('No service account key found. Trying default credentials...');
        initializeApp();
        console.log('Firebase Admin initialized with default credentials');
      }
    }
  }
  
  db = getFirestore();
  
  // Log which project we're using
  const apps = getApps();
  if (apps.length > 0) {
    const projectId = apps[0].options.projectId || 'unknown';
    console.log(`Firebase Admin Firestore ready (project: ${projectId})\n`);
  } else {
    console.log('Firebase Admin Firestore ready\n');
  }
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

