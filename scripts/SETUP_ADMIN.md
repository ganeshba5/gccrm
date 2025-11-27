# Setting Up Firebase Admin SDK for Scripts

The scripts use Firebase Admin SDK which bypasses security rules and is perfect for server-side scripts.

## Quick Setup

### Step 1: Get Service Account Key

**IMPORTANT:** The service account key must be for the **same project** as your web app!

1. Check your project ID in `.env`:
   ```bash
   grep VITE_FIREBASE_PROJECT_ID .env
   ```

2. Go to [Firebase Console](https://console.firebase.google.com/)
3. Select your project (should match `VITE_FIREBASE_PROJECT_ID` from `.env`)
4. Click the gear icon ⚙️ > **Project Settings**
5. Go to **Service Accounts** tab
6. Click **Generate new private key**
7. Save the downloaded JSON file as `scripts/serviceAccountKey.json`

**Note:** If you see a warning about project ID mismatch when running scripts, your service account key is for a different project than your `.env` file. Download a new key for the correct project.

### Step 2: Add to .gitignore

**IMPORTANT:** Never commit the service account key to git!

```bash
echo "scripts/serviceAccountKey.json" >> .gitignore
```

### Step 3: Run Scripts

Now you can run scripts without permission errors:

```bash
npx tsx scripts/leadsbystatus.ts New
npx tsx scripts/leadsbystatus.ts Contacted
```

## Alternative: Use Environment Variable

Instead of placing the file in `scripts/`, you can:

1. Save the key file anywhere (e.g., `~/.firebase/serviceAccountKey.json`)
2. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=~/.firebase/serviceAccountKey.json
   ```

## Security Notes

- **Never commit** service account keys to version control
- Service account keys have **full admin access** to your Firebase project
- Keep keys secure and rotate them periodically
- Use different keys for different environments (dev/prod)

## Troubleshooting

### "Error initializing Firebase Admin"

- Make sure the service account key file exists
- Check that the JSON file is valid
- Verify the file path is correct

### "Permission denied" (still)

- Make sure you're using `firebase-admin.js` (not `firebase-node.js`)
- Verify the service account key is for the correct project (check the warning message when running scripts)
- Check that `firebase-admin` package is installed: `npm list firebase-admin`

### "Project ID mismatch" warning

If you see a warning about project ID mismatch:
- Your service account key is for a different project than your `.env` file
- Download a new service account key from the Firebase Console for the project specified in `VITE_FIREBASE_PROJECT_ID`
- Replace `scripts/serviceAccountKey.json` with the new key

