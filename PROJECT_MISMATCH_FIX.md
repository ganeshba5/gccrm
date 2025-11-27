# Firebase Project Mismatch Issue

## Problem
You have **two different Firebase projects**:
- **Auth Project**: `gccrmapp` (user is authenticated here)
- **Firestore Project**: `device-streaming-45f887fb` (Firestore is deployed here)

The auth token has audience `gccrmapp`, but Firestore is in `device-streaming-45f887fb`. This causes permission denied errors because the auth token is for a different project.

## Solution Options

### Option 1: Use `gccrmapp` for Everything (Recommended)

1. **Update `.env` file** to use `gccrmapp` project:
   ```bash
   VITE_FIREBASE_PROJECT_ID=gccrmapp
   VITE_FIREBASE_AUTH_DOMAIN=gccrmapp.firebaseapp.com
   # Update other config values for gccrmapp project
   ```

2. **Switch Firebase CLI to `gccrmapp`**:
   ```bash
   npx firebase-tools use gccrmapp
   ```

3. **Deploy Firestore to `gccrmapp`**:
   ```bash
   npm run firebase:deploy:firestore
   ```

### Option 2: Use `device-streaming-45f887fb` for Everything

1. **Create new user in `device-streaming-45f887fb`** project
2. **Update auth domain** in `.env` to match `device-streaming-45f887fb`
3. **Re-authenticate** with the new project

### Option 3: Check if Projects are Linked

Sometimes projects can be linked. Check Firebase Console to see if these are the same project with different IDs.

## Quick Fix (Temporary)

To test immediately, you can temporarily open Firestore rules (FOR TESTING ONLY):

```javascript
// In firestore.rules - TEMPORARY
match /leads/{leadId} {
  allow read, write: if true; // Allows anyone - REMOVE IN PRODUCTION
}
```

**⚠️ WARNING**: This removes all security. Only use for testing!

## Recommended Action

Use **Option 1** - switch everything to `gccrmapp` since that's where your users are authenticated.

