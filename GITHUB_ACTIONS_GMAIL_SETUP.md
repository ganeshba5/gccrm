# Setting Up Gmail Authentication for GitHub Actions

The email fetch workflow needs Gmail API credentials. You have two options:

## Option 1: Service Account (Recommended)

Service Account authentication is more reliable and doesn't expire like OAuth2 refresh tokens.

### Step 1: Create Service Account in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **Service Account**
5. Fill in name (e.g., "CRM Email Fetcher") and description
6. Click **Create and Continue**
7. Skip role assignment (or assign as needed)
8. Click **Done**

### Step 2: Enable Domain-Wide Delegation

1. Click on the created service account
2. Go to **Details** tab
3. Check **Enable Google Workspace Domain-wide Delegation**
4. **Note the Client ID** (you'll need this in Step 3)

### Step 3: Authorize in Google Workspace Admin Console

1. Go to [Google Admin Console](https://admin.google.com/)
2. Navigate to **Security** > **API Controls** > **Domain-wide Delegation**
3. Click **Add new**
4. Enter the service account **Client ID** from Step 2
5. Add OAuth scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click **Authorize**

### Step 4: Download Service Account Key

1. Go back to Google Cloud Console
2. Click on your service account
3. Go to **Keys** tab
4. Click **Add Key** > **Create new key**
5. Choose **JSON** format
6. Download the JSON file

### Step 5: Add to GitHub Secrets

1. Open the downloaded JSON file
2. Copy the **entire JSON content**
3. Go to your GitHub repository
4. Navigate to **Settings** > **Secrets and variables** > **Actions**
5. Click **New repository secret**
6. Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
7. Value: Paste the entire JSON content (all on one line, or preserve formatting)
8. Click **Add secret**

### Step 6: Add Other Required Secrets

Also ensure these secrets are set:

- `GMAIL_USER_EMAIL`: `crm@infogloballink.com`
- `FIREBASE_ADMIN_PROJECT_ID`: Your Firebase project ID
- `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID (same as above)

**Note:** You can **remove** these OAuth2 secrets if using Service Account:
- `GMAIL_CLIENT_ID` (not needed with Service Account)
- `GMAIL_CLIENT_SECRET` (not needed with Service Account)
- `GMAIL_REFRESH_TOKEN` (not needed with Service Account)

## Option 2: Fix OAuth2 Refresh Token

If you prefer to use OAuth2, you need to generate a new refresh token:

### Step 1: Generate New Refresh Token

1. Go to [Google OAuth2 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon ⚙️ (top right)
3. Check **Use your own OAuth credentials**
4. Enter your `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`
5. In the left panel, find **Gmail API v1**
6. Select `https://www.googleapis.com/auth/gmail.readonly`
7. Click **Authorize APIs**
8. Sign in with `crm@infogloballink.com`
9. Click **Allow**
10. Click **Exchange authorization code for tokens**
11. Copy the **Refresh token**

### Step 2: Update GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Find `GMAIL_REFRESH_TOKEN`
4. Click **Update**
5. Paste the new refresh token
6. Click **Update secret**

## Verification

After setting up either method:

1. Go to **Actions** tab in your GitHub repository
2. Find the "Schedule Email Fetch" workflow
3. Click **Run workflow** (manual trigger)
4. Check the logs to verify authentication succeeds

## Troubleshooting

### "invalid_grant" Error

- **OAuth2**: Your refresh token is expired or invalid. Generate a new one (Option 2 above).
- **Service Account**: Check that domain-wide delegation is properly set up in Google Workspace Admin.

### "Missing or insufficient permissions"

- Ensure the service account has domain-wide delegation enabled
- Verify the OAuth scopes are correctly authorized in Google Workspace Admin
- Check that the service account key JSON is valid

### "No Gmail authentication credentials found"

- Ensure `GOOGLE_SERVICE_ACCOUNT_KEY` secret is set (for Service Account)
- OR ensure `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` are set (for OAuth2)

