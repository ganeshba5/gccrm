# Troubleshooting Permission Denied Errors

## Current Issue
User is authenticated but getting "Missing or insufficient permissions" when querying Firestore.

## Debugging Steps

### 1. Verify Authentication
- ✅ User is logged in (UID: 9D9fDnV4slf7Cc2QbaDThXNK0nA3)
- ✅ ID token is obtained (922 characters - valid)
- ✅ Auth state is properly set

### 2. Verify Firestore Rules
- ✅ Rules are deployed
- ✅ Rules allow `isAuthenticated()` users to read
- ⚠️ **Possible Issue**: Rules might not be evaluating correctly

### 3. Check Firestore Database Mode
The database should be in **Native mode** (not Datastore mode).

To check:
```bash
npx firebase-tools firestore:databases:get
```

### 4. Test with Simpler Query
The code now tries a query without `orderBy` first, which should work if the issue is index-related.

### 5. Check Firebase Console
1. Go to Firebase Console > Firestore Database > Rules
2. Verify the deployed rules match `firestore.rules`
3. Check the Rules Playground to test with your user

### 6. Possible Solutions

#### Solution A: Temporary Open Rules (Testing Only)
For testing, you can temporarily open the rules:
```javascript
// In firestore.rules - TEMPORARY FOR TESTING
allow read: if true;  // Allows anyone to read
```

**⚠️ WARNING**: Never deploy this to production!

#### Solution B: Check Auth Token
The auth token might not be properly attached. The code now explicitly gets the ID token before querying.

#### Solution C: Database Mode Issue
If the database is in Datastore mode instead of Native mode, rules work differently. Check in Firebase Console.

### 7. Next Steps
1. Check browser console for the new debug logs
2. Try the query again - it should now try without orderBy first
3. Check Firebase Console Rules tab to verify deployment
4. Test in Rules Playground with your user UID

## Current Status
- User: Authenticated ✅
- Token: Valid ✅  
- Rules: Deployed ✅
- Query: Still failing ❌

The query now tries without `orderBy` first, which should help identify if it's an index issue or a permissions issue.

