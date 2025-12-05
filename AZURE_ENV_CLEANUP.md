# Azure Static Web App - Environment Variables Cleanup Guide

## Current Situation

Since we're now using GitHub Actions to run the email fetch script directly (not Azure Functions), you can clean up some environment variables in Azure Static Web Apps.

## Environment Variables to KEEP (Required for Frontend)

These are needed for your React app to work:

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase client SDK | ✅ **KEEP** |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase authentication | ✅ **KEEP** |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ **KEEP** |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage | ✅ **KEEP** |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging | ✅ **KEEP** |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | ✅ **KEEP** |

**Note**: These are set in **GitHub Secrets** (for build time) and can optionally be in Azure (for runtime, though not needed since they're embedded in the build).

## Environment Variables to REMOVE (Not Needed Anymore)

These were only needed for the Azure Function (`api/fetchEmails`), which we're not using:

| Variable | Purpose | Action |
|----------|---------|--------|
| `GMAIL_USER_EMAIL` | Gmail account for email fetch | ❌ **REMOVE** (now in GitHub Secrets) |
| `GMAIL_CLIENT_ID` | Gmail OAuth2 Client ID | ❌ **REMOVE** (now in GitHub Secrets) |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth2 Client Secret | ❌ **REMOVE** (now in GitHub Secrets) |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 Refresh Token | ❌ **REMOVE** (now in GitHub Secrets) |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK project ID | ❌ **REMOVE** (now in GitHub Secrets) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account key path | ❌ **REMOVE** (now in GitHub Secrets) |

## Where These Variables Are Now

All Gmail/Firebase Admin variables are now in **GitHub Secrets** (used by the scheduled workflow):
- `GMAIL_USER_EMAIL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `FIREBASE_ADMIN_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `VITE_FIREBASE_PROJECT_ID` (optional)

## Steps to Clean Up Azure

1. **Go to Azure Portal**:
   - Navigate to your Static Web App
   - Click **"Configuration"** → **"Application settings"**

2. **Remove the Gmail/Firebase Admin variables**:
   - Find each variable listed above
   - Click the **"..."** menu → **"Delete"**
   - Confirm deletion

3. **Keep the VITE_FIREBASE_* variables** (if they exist):
   - These are optional since they're in GitHub Secrets
   - But keeping them won't hurt if you want redundancy

4. **Save** the configuration

## Important Notes

- **GitHub Secrets** are used for:
  - Building the frontend (VITE_* variables)
  - Running the email fetch script (Gmail/Firebase Admin variables)

- **Azure Application Settings** are now only needed if:
  - You want runtime environment variables (not common for static apps)
  - You plan to use the `api/fetchEmails` function in the future

- **The `api/fetchEmails` folder is kept** in the repo but won't be deployed since `api_location: ""` in the workflow

## If You Want to Use `api/fetchEmails` Later

If you decide to use the Azure Function approach later:

1. Set `api_location: "api"` in the deployment workflow
2. Add back the Gmail/Firebase Admin environment variables in Azure
3. The function will be deployed and available at `/api/fetchEmails`

## Summary

**Remove from Azure:**
- All `GMAIL_*` variables
- `FIREBASE_ADMIN_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`

**Keep in Azure (optional):**
- `VITE_FIREBASE_*` variables (if you want runtime access, though not needed)

**Keep in GitHub Secrets:**
- All `VITE_FIREBASE_*` variables (for build)
- All `GMAIL_*` and Firebase Admin variables (for email fetch script)

