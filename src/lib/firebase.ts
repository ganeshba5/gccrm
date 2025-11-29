import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Log environment variables availability
console.log('Firebase Config Environment Variables Status:', {
  apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: !!import.meta.env.VITE_FIREBASE_APP_ID
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '**HIDDEN**' : undefined
});

// Initialize Firebase
let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}
// Initialize Authentication with debug mode
let auth: Auth;
try {
  auth = getAuth(app);
  // Enable debugging
  auth.useDeviceLanguage();
  // Log the current configuration
  console.log('Firebase Auth Configuration:', {
    currentUser: auth.currentUser,
    languageCode: auth.languageCode,
    settings: {
      appVerificationDisabledForTesting: auth.settings.appVerificationDisabledForTesting,
    },
    config: {
      apiKey: auth.config.apiKey ? '**HIDDEN**' : 'missing',
      authDomain: auth.config.authDomain,
      apiHost: auth.config.apiHost
    }
  });
  console.log('Firebase Auth initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Auth:', error);
  if (error instanceof Error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
  throw error;
}

// Initialize Firestore
let db: Firestore;
try {
  // Initialize Firestore with the same app instance
  // Firestore automatically uses the auth from the same app
  db = getFirestore(app);
  console.log('Firestore initialized successfully');
  console.log('Firestore database:', db.app.name);
  console.log('Firestore will use auth from the same app instance');
} catch (error) {
  console.error('Error initializing Firestore:', error);
  throw error;
}

export { app, auth, db };
export type { FirebaseApp } from 'firebase/app';
export type { Auth } from 'firebase/auth';
export type { Firestore } from 'firebase/firestore';
export default app;