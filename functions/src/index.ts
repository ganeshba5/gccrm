// Firebase Cloud Functions
// Deploy this to Firebase Functions

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Export addRole function
exports.addRole = functions.https.onCall(async (data: any, context: any) => {
  // Check if request is made by an authenticated admin
  if (!context || !context.auth || !(context.auth.token as any)?.roles?.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can modify roles.'
    );
  }

  // Validate data
  const userId = data?.userId;
  const role = data?.role;
  if (!userId || !role || !['admin', 'sales'].includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid user ID or role specified.'
    );
  }

  try {
    // Get user and current custom claims
    const user = await admin.auth().getUser(userId);
    const currentClaims = user.customClaims || {};
    
    // Update roles in custom claims
    const roles = currentClaims.roles || {};
    roles[role] = true;
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      roles,
    });

    // Store role in Firestore for UI access
    await admin.firestore()
      .collection('roles')
      .doc(userId)
      .set({ roles }, { merge: true });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'Error modifying user roles.',
      error
    );
  }
});

// Export fetchEmails function
import { fetchEmails } from './fetchEmails';
exports.fetchEmails = fetchEmails;