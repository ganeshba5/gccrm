# GitHub Actions Setup for Email Fetch

The GitHub Actions workflow now calls the Firebase Cloud Function instead of running the script directly.

## Required GitHub Secrets

### Required:
- `FIREBASE_FUNCTION_URL` (optional, defaults to `https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails`)

### Optional:
- `FIREBASE_FUNCTION_SECRET` (if your function requires authentication)

## Setting Up GitHub Secrets

1. Go to your GitHub repository: https://github.com/ganeshba5/gccrm
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**

### Add Function URL (Optional)
- Name: `FIREBASE_FUNCTION_URL`
- Value: `https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails`
- Click **Add secret**

**Note:** If not set, the workflow will use the default URL.

### Add Function Secret (If Required)
- Name: `FIREBASE_FUNCTION_SECRET`
- Value: Your function authentication secret (if you enabled auth in the function)
- Click **Add secret**

## How It Works

1. **Scheduled**: Runs every 15 minutes via cron
2. **Manual**: Can be triggered manually from Actions tab
3. **Calls**: HTTP GET request to Firebase Cloud Function
4. **Reports**: Shows success/failure with response details

## Benefits

- ✅ No need to install dependencies in GitHub Actions
- ✅ No need to manage Gmail credentials in GitHub Secrets
- ✅ Faster execution (just an HTTP call)
- ✅ Centralized credential management (in Firebase/Google Cloud)
- ✅ Better error handling and logging in Firebase

## Troubleshooting

### "404 Not Found"
- Function not deployed yet
- Wrong function URL
- Check: `npm run firebase:functions:list`

### "500 Internal Server Error"
- Function deployed but missing environment variables
- Check Firebase Functions logs: `npx firebase-tools functions:log --only fetchEmails`
- Verify environment variables are set in Google Cloud Console

### "401 Unauthorized"
- Function requires authentication
- Set `FIREBASE_FUNCTION_SECRET` in GitHub Secrets
- Or disable authentication in the function code

