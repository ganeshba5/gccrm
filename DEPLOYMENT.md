# Firebase Deployment Guide

## Prerequisites

1. **Login to Firebase CLI** (if not already logged in):
   ```bash
   npm run firebase:login
   ```
   This will open a browser window for authentication.

2. **Set Firebase Project** (choose one method):

   **Method A: Use environment variable** (if `VITE_FIREBASE_PROJECT_ID` is set):
   ```bash
   npm run firebase:set-project
   ```

   **Method B: Interactive selection**:
   ```bash
   npm run firebase:use
   ```
   This will show a list of your Firebase projects to choose from.

   **Method C: Manual setup**:
   Create a `.firebaserc` file with:
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```
   Replace `your-project-id` with your actual Firebase project ID (from `VITE_FIREBASE_PROJECT_ID` env var or Firebase Console).

## Deploy Firestore Rules and Indexes

### Option 1: Deploy Both (Recommended)
```bash
npm run firebase:deploy:firestore
```

This will deploy both Firestore security rules and indexes in one command.

### Option 2: Deploy Separately

**Deploy Firestore Security Rules:**
```bash
npm run firebase:deploy:rules
```

**Deploy Firestore Indexes:**
```bash
npm run firebase:deploy:indexes
```

## What Gets Deployed

### Firestore Rules (`firestore.rules`)
- Security rules for `leads` collection
- Security rules for `customers` collection
- Role-based access control (admin/sales)
- Data validation functions

### Firestore Indexes (`firestore.indexes.json`)
- Index for `leads` collection: `createdAt` (descending)
- Index for `customers` collection: `createdAt` (descending)
- Composite index for `customers` collection: `status` + `createdAt` (for filtered queries)

## Important Notes

1. **Index Building Time**: After deploying indexes, Firestore needs time to build them. This can take a few minutes to several hours depending on the amount of data. You can monitor the build status in the Firebase Console.

2. **Rules Deployment**: Rules are deployed immediately and take effect right away.

3. **Testing**: After deployment, test your application to ensure:
   - Leads can be created and queried
   - Customers can be created and queried
   - Security rules are working as expected
   - Queries don't fail due to missing indexes

## Troubleshooting

### "Missing or insufficient permissions" error
- Check that your Firebase user has the correct permissions
- Verify that custom claims (roles) are properly set for your user

### "Index not found" error
- Wait for indexes to finish building (check Firebase Console)
- Verify the index definition in `firestore.indexes.json` matches your queries

### "Rules deployment failed"
- Check the syntax of `firestore.rules` file
- Use `npx firebase-tools firestore:rules:test` to test rules locally

