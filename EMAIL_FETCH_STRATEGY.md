# Email Fetch Strategy - HTTP Trigger with GitHub Actions Scheduler

## Overview

Since Azure Static Web Apps doesn't support Timer Triggers, we've converted the email fetch function to use an **HTTP trigger** that's called by a **GitHub Actions scheduled workflow**.

## Changes Made

### 1. Converted Timer Trigger to HTTP Trigger

**File: `api/fetchEmails/function.json`**
- Changed from `timerTrigger` to `httpTrigger`
- Now accepts GET/POST requests
- Compatible with Azure Static Web Apps

**File: `api/fetchEmails/index.ts`**
- Updated function signature to accept HTTP request/response
- Returns JSON response with results
- Can be called via HTTP endpoint

### 2. Created GitHub Actions Scheduler

**File: `.github/workflows/schedule-email-fetch.yml`**
- Runs every 15 minutes (cron: `*/15 * * * *`)
- Calls the HTTP endpoint: `https://<your-app>.azurestaticapps.net/api/fetchEmails`
- Can also be triggered manually via `workflow_dispatch`

### 3. Updated Deployment Workflow

**File: `.github/workflows/azure-static-web-apps-orange-island-0cd71360f.yml`**
- Set `api_location: "api"` to deploy the API functions
- HTTP triggers are supported by Azure Static Web Apps

## How It Works

```
GitHub Actions (Scheduled) 
    ↓ (every 15 minutes)
HTTP POST to /api/fetchEmails
    ↓
Azure Function (HTTP Trigger)
    ↓
Fetches emails from Gmail
    ↓
Stores in Firestore
```

## Setup Instructions

### 1. Configure GitHub Secret

Add your Azure Static Web App URL as a secret:

1. Go to: `https://github.com/ganeshba5/gccrm/settings/secrets/actions`
2. Click "New repository secret"
3. Name: `AZURE_STATIC_WEB_APP_URL`
4. Value: `https://<your-app-name>.azurestaticapps.net`
   - Find this in Azure Portal → Your Static Web App → Overview → URL

### 2. Deploy the Changes

After pushing these changes:
1. The main workflow will deploy the HTTP trigger function
2. The scheduled workflow will start calling it every 15 minutes

### 3. Verify It's Working

1. **Check GitHub Actions**:
   - Go to Actions tab
   - Look for "Schedule Email Fetch" workflow runs
   - Should run every 15 minutes

2. **Check Function Logs**:
   - Azure Portal → Your Static Web App → Functions → `fetchEmails`
   - View execution logs

3. **Check Firestore**:
   - Firebase Console → Firestore → `inboundEmails` collection
   - Should see new emails appearing

## Manual Testing

You can manually trigger the function:

1. **Via GitHub Actions**:
   - Go to Actions → "Schedule Email Fetch" → "Run workflow"

2. **Via HTTP Request**:
   ```bash
   curl -X POST https://<your-app>.azurestaticapps.net/api/fetchEmails
   ```

3. **Via Browser**:
   - Navigate to: `https://<your-app>.azurestaticapps.net/api/fetchEmails`
   - Should return JSON response

## Advantages of This Approach

✅ **Works with Azure Static Web Apps** - HTTP triggers are supported  
✅ **No separate Function App needed** - Everything in one deployment  
✅ **Easy to monitor** - GitHub Actions shows execution history  
✅ **Flexible scheduling** - Easy to change cron schedule  
✅ **Manual trigger** - Can test/debug easily  
✅ **Cost effective** - Uses GitHub Actions free tier (2000 minutes/month)

## Schedule Configuration

To change the frequency, edit `.github/workflows/schedule-email-fetch.yml`:

```yaml
schedule:
  - cron: '*/15 * * * *'  # Every 15 minutes
  # - cron: '0 * * * *'    # Every hour
  # - cron: '0 */6 * * *'  # Every 6 hours
  # - cron: '0 0 * * *'    # Daily at midnight
```

## Troubleshooting

### Function not found (404)
- Verify `api_location: "api"` is set in deployment workflow
- Check that function deployed successfully
- Verify the URL in GitHub secret is correct

### Authentication errors
- If you add function key authentication, update the workflow to include the key
- Set `AZURE_FUNCTION_KEY` secret in GitHub

### GitHub Actions not running
- Check that the workflow file is in `.github/workflows/`
- Verify cron syntax is correct
- Check GitHub Actions permissions

### No emails being fetched
- Check function logs in Azure Portal
- Verify Gmail API credentials are set in Azure Application Settings
- Check Firestore rules allow writes to `inboundEmails`

## Alternative: External Scheduler

If you prefer not to use GitHub Actions, you can use:
- **Azure Logic Apps** (Azure-native)
- **Cron-job.org** (Free external service)
- **EasyCron** (Paid service)
- **Your own server** with a cron job

All of these would call the same HTTP endpoint.

