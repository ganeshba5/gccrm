# Setting Environment Variables for fetchEmails Function

The function needs Gmail API credentials to work. Here's how to set them up:

## Quick Setup (Service Account - Recommended)

Since you already have `scripts/serviceAccountKey.json` working locally, use that:

### Step 1: Set Service Account Key as Secret

```bash
# From project root
cat scripts/serviceAccountKey.json | npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
```

Or manually:
```bash
npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
# When prompted, paste the entire JSON content from scripts/serviceAccountKey.json
```

### Step 2: Set Gmail User Email (Non-sensitive config)

```bash
npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"
```

### Step 3: Update Function to Use Secrets

You need to update the function code to access secrets. The function should use:
- `process.env.GOOGLE_SERVICE_ACCOUNT_KEY` (from secrets)
- `process.env.GMAIL_USER_EMAIL` (from config)

### Step 4: Redeploy Function

After setting secrets/config, redeploy:
```bash
npm run firebase:deploy:fetchEmails
```

## Alternative: Using Firebase Console

The exact path may vary. Try these:

**Method 1: Via Functions Page**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `gccrmapp`
3. Click **Functions** in the left sidebar
4. Look for **Configuration** or **Settings** (may be in a tab or gear icon)
5. Or click on the `fetchEmails` function, then look for **Configuration** or **Environment variables**

**Method 2: Via Google Cloud Console (Recommended)**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `gccrmapp`
3. Go to **Cloud Functions** (search in top bar)
4. Click on `fetchEmails` function
5. Go to **Configuration** tab
6. Scroll to **Environment variables** or **Secrets** section
7. Click **Edit** or **Add variable**
8. Add:
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: Paste entire JSON from `scripts/serviceAccountKey.json`
   - Name: `GMAIL_USER_EMAIL`
   - Value: `crm@infogloballink.com`
9. Click **Save**

**Important:** After adding secrets/variables, redeploy the function!

## Verify Setup

After redeploying, test the function:
```bash
npm run test:fetch-emails
```

## Troubleshooting

### "Missing required environment variables"

- Make sure you've set the secrets/config
- Make sure you've **redeployed** the function after setting them
- Check Firebase Console > Functions > Configuration to verify they're set

### "Error initializing Gmail client"

- Verify the service account key JSON is valid
- Check that domain-wide delegation is enabled in Google Workspace Admin
- Verify the service account has Gmail API access

