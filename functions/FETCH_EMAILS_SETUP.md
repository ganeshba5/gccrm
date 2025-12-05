# Firebase Cloud Function: fetchEmails Setup Guide

This guide explains how to set up and deploy the `fetchEmails` Firebase Cloud Function.

## Overview

The `fetchEmails` function fetches emails from Gmail and stores them in Firestore. It can be:
- Called via HTTP endpoint
- Scheduled using Firebase Scheduler
- Triggered manually from Firebase Console

## Prerequisites

1. Firebase project with Functions enabled
2. Gmail API credentials (Service Account or OAuth2)
3. Node.js and Firebase CLI installed

## Installation

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Build the functions:**
   ```bash
   npm run build
   ```

## Environment Variables

Set these in Firebase Functions configuration. **Use Firebase Functions Secrets** (recommended for sensitive data):

### Option 1: Service Account (Recommended)

1. **Get your service account key JSON** from `scripts/serviceAccountKey.json` or Google Cloud Console

2. **Set as a secret** (recommended for sensitive data):
   ```bash
   # Read the service account key file
   cat scripts/serviceAccountKey.json | npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
   ```
   
   Or manually:
   ```bash
   npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
   # Then paste the entire JSON content when prompted
   ```

3. **Update function to use the secret:**
   ```bash
   npx firebase-tools functions:secrets:access GOOGLE_SERVICE_ACCOUNT_KEY
   ```

4. **Set Gmail user email** (non-sensitive):
   ```bash
   npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"
   ```

### Option 2: OAuth2

Set OAuth2 credentials as secrets:
```bash
npx firebase-tools functions:secrets:set GMAIL_CLIENT_ID
npx firebase-tools functions:secrets:set GMAIL_CLIENT_SECRET
npx firebase-tools functions:secrets:set GMAIL_REFRESH_TOKEN
npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"
```

**Important:** After setting secrets, you need to **redeploy the function** for the secrets to be available:
```bash
npm run firebase:deploy:fetchEmails
```

## Deployment

1. **Deploy the function:**
   ```bash
   firebase deploy --only functions:fetchEmails
   ```

2. **Or deploy all functions:**
   ```bash
   firebase deploy --only functions
   ```

## Usage

### HTTP Endpoint

After deployment, the function will be available at:
```
https://<region>-<project-id>.cloudfunctions.net/fetchEmails
```

**Call via curl:**
```bash
curl https://<region>-<project-id>.cloudfunctions.net/fetchEmails
```

**Response:**
```json
{
  "success": true,
  "message": "Email fetch completed",
  "stored": 5,
  "skipped": 2,
  "timestamp": "2025-12-05T10:30:00.000Z"
}
```

### Scheduled Execution

To set up scheduled execution:

1. **Uncomment the scheduled function** in `functions/src/fetchEmails.ts`:
   ```typescript
   export const fetchEmailsScheduled = functions.pubsub.schedule('*/15 * * * *').onRun(async (context) => {
     // ... code ...
   });
   ```

2. **Deploy the scheduled function:**
   ```bash
   firebase deploy --only functions:fetchEmailsScheduled
   ```

3. **Or use Firebase Console:**
   - Go to Firebase Console > Functions > Scheduler
   - Create a new job
   - Target: `fetchEmails` function
   - Schedule: `*/15 * * * *` (every 15 minutes)

### Manual Trigger

1. Go to Firebase Console > Functions
2. Find `fetchEmails` function
3. Click "Test" or "Trigger"

## Authentication (Optional)

To secure the HTTP endpoint, uncomment the authentication check in `fetchEmails.ts`:

```typescript
const authHeader = req.headers.authorization;
if (authHeader !== `Bearer ${process.env.FUNCTION_SECRET}`) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
```

Then set the secret:
```bash
firebase functions:secrets:set FUNCTION_SECRET
```

## Troubleshooting

### "No Gmail authentication credentials found"

- Verify environment variables are set correctly
- Check Firebase Functions configuration in Console
- Ensure service account key JSON is valid

### "Error initializing Gmail client"

- Verify service account has domain-wide delegation enabled
- Check OAuth2 credentials are valid
- Ensure Gmail API is enabled in Google Cloud Console

### "Missing or insufficient permissions"

- Verify Firestore security rules allow writes to `inboundEmails` collection
- Check service account has proper permissions

## Monitoring

View logs in Firebase Console:
- Go to Firebase Console > Functions > Logs
- Filter by function name: `fetchEmails`

Or via CLI:
```bash
firebase functions:log --only fetchEmails
```

## Cost Considerations

- **HTTP invocations:** Free tier includes 2 million invocations/month
- **Execution time:** Billed per 100ms
- **Gmail API:** Free quota: 1 billion quota units/day
- **Firestore writes:** Billed per document write

For scheduled execution every 15 minutes:
- ~2,880 invocations/month (well within free tier)

## Next Steps

1. Set up scheduled execution for automatic email fetching
2. Configure email linking to Accounts/Opportunities
3. Set up notifications for new emails
4. Implement email processing workflows

