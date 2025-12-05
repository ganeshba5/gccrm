# Email Fetch Options - Understanding the Setup

## Current Situation

You have **two different approaches** for email fetching:

### Option 1: Azure Functions in Static Web App (Current - `api/fetchEmails/`)
- **Location**: `api/fetchEmails/` in your main project
- **What it is**: Azure Functions hosted by Azure Static Web Apps
- **How it works**: Azure Static Web Apps can host serverless functions in the `api/` folder
- **Status**: Currently failing with HTTP 500

### Option 2: Standalone Project (Backed up)
- **Location**: `/Users/ganeshb/Documents/CursorAI/GCCrm/fetchEmails-backup-20251204`
- **What it is**: Separate Azure Function App project
- **How it works**: Deployed as a separate Azure Function App (not part of Static Web App)
- **Status**: Ready to deploy separately

## The Confusion

When you say "We don't use Azure Functions", you might mean:
1. You don't want functions in the `api/` folder of your Static Web App
2. You prefer the standalone approach
3. You want a completely different solution

## Recommended Solution: Use Standalone Project

Since the `api/fetchEmails` approach is causing issues, let's use the **standalone project**:

### Steps:

1. **Remove `api/fetchEmails` from the main project**:
   ```bash
   git rm -r api/fetchEmails
   git commit -m "Remove api/fetchEmails - using standalone approach"
   ```

2. **Update deployment workflow** to skip API:
   - Set `api_location: ""` in the workflow

3. **Deploy standalone project separately**:
   - Use the backup at `fetchEmails-backup-20251204`
   - Deploy as separate Azure Function App
   - Set up GitHub Actions scheduler to call that endpoint

4. **Update GitHub Actions scheduler**:
   - Point to the standalone Function App URL instead

## Alternative: Fix Current Approach

If you want to keep `api/fetchEmails` in the Static Web App:

1. The function needs environment variables in Azure
2. The function code needs to be correct
3. The endpoint needs to be accessible

## What Would You Prefer?

1. **Remove `api/fetchEmails` and use standalone project** (Recommended)
2. **Keep `api/fetchEmails` and fix the current issues**
3. **Use a completely different approach** (e.g., separate service, different scheduler)

Let me know which approach you prefer and I'll help implement it.

