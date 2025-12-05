# Azure Function Environment Variables Setup

## Problem: HTTP 500 Error

If you're getting HTTP 500 errors when calling the email fetch function, it's likely due to missing environment variables in Azure.

## Required Environment Variables

Set these in **Azure Portal** → Your Static Web App → **Configuration** → **Application settings**:

### Option 1: OAuth2 Credentials (If using OAuth2)

| Name | Value | Description |
|------|-------|-------------|
| `GMAIL_USER_EMAIL` | `crm@infogloballink.com` | Gmail account to fetch emails from |
| `GMAIL_CLIENT_ID` | `your-client-id` | Google OAuth2 Client ID |
| `GMAIL_CLIENT_SECRET` | `your-client-secret` | Google OAuth2 Client Secret |
| `GMAIL_REFRESH_TOKEN` | `your-refresh-token` | Google OAuth2 Refresh Token |
| `FIREBASE_ADMIN_PROJECT_ID` | `gccrmapp` | Firebase Project ID (optional if using service account) |

### Option 2: Service Account (Recommended for Production)

| Name | Value | Description |
|------|-------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key | Path to service account JSON file |
| `FIREBASE_ADMIN_PROJECT_ID` | `gccrmapp` | Firebase Project ID |
| `GMAIL_USER_EMAIL` | `crm@infogloballink.com` | Gmail account to fetch emails from |

**Note**: For Service Account, you need to upload the service account key file to Azure. See "Service Account Setup" below.

## Steps to Configure

### 1. Go to Azure Portal

1. Navigate to your Static Web App
2. Click **"Configuration"** in the left sidebar
3. Click **"Application settings"** tab

### 2. Add Environment Variables

For each variable:
1. Click **"+ Add"**
2. Enter the **Name** and **Value**
3. Click **"OK"**

### 3. Save Configuration

1. Click **"Save"** at the top
2. Wait for the app to restart (usually takes 1-2 minutes)

## Service Account Setup (Recommended)

If using Service Account authentication:

### Step 1: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`gccrmapp`)
3. Click ⚙️ → **Project Settings** → **Service Accounts**
4. Click **"Generate new private key"**
5. Save the JSON file

### Step 2: Upload to Azure

**Option A: Store as Application Setting (JSON string)**

1. Open the service account JSON file
2. Copy the entire JSON content
3. In Azure Portal → Configuration → Application settings
4. Add new setting:
   - Name: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - Value: (paste the entire JSON)
5. Update the function code to read from this setting

**Option B: Use Azure Key Vault (More Secure)**

1. Store the service account key in Azure Key Vault
2. Reference it from Application Settings

**Option C: Use File System (If supported)**

1. Upload the JSON file to Azure Storage
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the file path

## Verify Configuration

After setting environment variables:

1. **Check Function Logs**:
   - Azure Portal → Static Web App → Functions → `fetchEmails` → Monitor
   - Look for initialization errors

2. **Test Manually**:
   ```bash
   curl -X POST https://<your-app>.azurestaticapps.net/api/fetchEmails
   ```

3. **Check GitHub Actions**:
   - The scheduled workflow should now succeed
   - Check the response body for detailed error messages

## Common Errors

### "Missing required environment variables"
- **Solution**: Add the missing variables in Azure Application Settings
- Check that variable names match exactly (case-sensitive)

### "Firebase Admin not initialized"
- **Solution**: Set `FIREBASE_ADMIN_PROJECT_ID` or `GOOGLE_APPLICATION_CREDENTIALS`
- Verify Firebase project ID is correct

### "Error initializing Gmail client"
- **Solution**: Check Gmail API credentials are correct
- Verify Service Account has Domain-Wide Delegation enabled (if using Service Account)
- Check OAuth2 credentials are valid (if using OAuth2)

### "Missing or insufficient permissions" (Firestore)
- **Solution**: Check Firestore security rules allow writes to `inboundEmails`
- Verify Firebase Admin SDK has proper permissions

## Testing Locally

To test the function locally before deploying:

1. Create `api/fetchEmails/local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "GMAIL_USER_EMAIL": "crm@infogloballink.com",
       "GMAIL_CLIENT_ID": "your-client-id",
       "GMAIL_CLIENT_SECRET": "your-client-secret",
       "GMAIL_REFRESH_TOKEN": "your-refresh-token",
       "FIREBASE_ADMIN_PROJECT_ID": "gccrmapp"
     }
   }
   ```

2. Run locally:
   ```bash
   cd api/fetchEmails
   func start
   ```

3. Test:
   ```bash
   curl -X POST http://localhost:7071/api/fetchEmails
   ```

## Next Steps

After configuring environment variables:
1. Save the configuration in Azure Portal
2. Wait for the app to restart
3. Manually trigger the GitHub Actions workflow to test
4. Check the function logs for any remaining errors

