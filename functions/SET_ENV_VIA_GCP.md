# Setting Environment Variables via Google Cloud Console

Firebase Functions v1 doesn't automatically expose secrets as environment variables. You need to set them as environment variables in Google Cloud Console.

## Step-by-Step Instructions

### Step 1: Open Google Cloud Console

1. Go to: https://console.cloud.google.com/functions/list?project=gccrmapp
2. Click on the **fetchEmails** function

### Step 2: Edit the Function

1. Click **EDIT** button (top right)
2. Expand **Runtime, build, connections and security settings**

### Step 3: Add Environment Variables

1. Scroll to **Environment variables** section
2. Click **ADD VARIABLE** for each variable:

   **Variable 1:**
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: Paste the **entire JSON content** from `scripts/serviceAccountKey.json`
   - Click **DONE**

   **Variable 2:**
   - Name: `GMAIL_USER_EMAIL`
   - Value: `crm@infogloballink.com`
   - Click **DONE**

### Step 4: Deploy

1. Click **DEPLOY** (or **NEXT** then **DEPLOY**)
2. Wait for deployment to complete

### Step 5: Test

```bash
npm run test:fetch-emails
```

## Alternative: Using gcloud CLI

If you prefer CLI:

```bash
# Get your service account key content
SERVICE_ACCOUNT_KEY=$(cat scripts/serviceAccountKey.json | jq -c .)

# Update function with environment variables
gcloud functions deploy fetchEmails \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=fetchEmails \
  --trigger-http \
  --set-env-vars="GOOGLE_SERVICE_ACCOUNT_KEY=$SERVICE_ACCOUNT_KEY,GMAIL_USER_EMAIL=crm@infogloballink.com" \
  --project=gccrmapp
```

**Note:** This requires gcloud CLI to be installed and authenticated.

## Why This is Needed

Firebase Functions v1 uses `functions.config()` for non-sensitive config and `process.env` for environment variables set in Google Cloud Console. Secrets set via `firebase functions:secrets:set` are stored in Secret Manager but aren't automatically available to v1 functions without additional code to access Secret Manager API.

Setting them as environment variables in Google Cloud Console is the simplest solution for v1 functions.

