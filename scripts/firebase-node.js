// Firebase initialization for Node.js scripts
// This version uses process.env instead of import.meta.env
// 
// To use this, set environment variables:
//   export VITE_FIREBASE_API_KEY=your-key
//   export VITE_FIREBASE_PROJECT_ID=your-project-id
//   etc.
//
// Or use dotenv by installing it and loading before this module:
//   npm install -D dotenv
//   Then in your script: import 'dotenv/config' before this import

import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Get environment variables from process.env (for Node.js)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Validate config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase configuration. Please set environment variables:\n' +
    'VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.\n' +
    'Or create a .env file in the project root.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);

// Log configuration (without sensitive data)
console.log('Firebase initialized for Node.js script:');
console.log(`  Project ID: ${firebaseConfig.projectId}`);
console.log(`  Auth Domain: ${firebaseConfig.authDomain}`);
console.log('  Firestore: Initialized\n');

export { db, app };
export default db;

