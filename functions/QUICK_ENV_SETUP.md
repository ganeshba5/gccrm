# Quick Environment Variables Setup

## Method 1: Using CLI (Easiest)

### Step 1: Set Service Account Key Secret

```bash
# From project root
cat scripts/serviceAccountKey.json | npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
```

When prompted, it will ask you to confirm. Type `y` and press Enter.

### Step 2: Set Gmail User Email

```bash
npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"
```

### Step 3: Redeploy Function

```bash
npm run firebase:deploy:fetchEmails
```

## Method 2: Using Google Cloud Console

1. Go to: https://console.cloud.google.com/functions/list?project=gccrmapp
2. Click on the `fetchEmails` function
3. Click **EDIT** (top right)
4. Expand **Runtime, build, connections and security settings**
5. Go to **Secrets** tab
6. Click **ADD SECRET**
   - Secret: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Version: `latest` (or create new)
   - Mount path: `/secrets/GOOGLE_SERVICE_ACCOUNT_KEY`
   - Click **DONE**
7. Go to **Environment variables** section
8. Click **ADD VARIABLE**
   - Name: `GMAIL_USER_EMAIL`
   - Value: `crm@infogloballink.com`
9. Click **DEPLOY** (or **NEXT** then **DEPLOY**)

## Method 3: Using Firebase Console (if available)

1. Go to: https://console.firebase.google.com/project/gccrmapp/functions
2. Click on `fetchEmails` function
3. Look for **Configuration** or **Environment variables** section
4. Add the variables as described above

## Verify Setup

After setting variables and redeploying, test:
```bash
npm run test:fetch-emails
```

## Troubleshooting

If you can't find Configuration in Firebase Console:
- Use **Google Cloud Console** instead (Method 2)
- Or use **CLI** (Method 1 - recommended)

