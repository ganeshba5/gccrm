# Gmail API Setup Guide

This guide explains how to set up Gmail API access to fetch emails from `crm@infogloballink.com`.

## Prerequisites

1. Google Workspace account with admin access
2. Google Cloud Project
3. Node.js and npm installed

## Option 1: OAuth2 Setup (Recommended for single user)

### Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Gmail API" and click **Enable**

### Step 2: Create OAuth2 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **Internal** (for Google Workspace) or **External**
   - Fill in required fields
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly`
4. For Application type, choose **Desktop app** or **Web application**
5. Click **Create**
6. Save the **Client ID** and **Client Secret**

### Step 3: Get Refresh Token

1. Install the Google OAuth2 Playground tool or use a script
2. Authorize with these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
3. Exchange authorization code for refresh token
4. Save the **Refresh Token**

### Step 4: Set Environment Variables

Add to your `.env` file:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
GMAIL_USER_EMAIL=crm@infogloballink.com
```

## Option 2: Service Account with Domain-Wide Delegation (Recommended for production)

### Step 1: Enable Gmail API

Same as Option 1, Step 1.

### Step 2: Create Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in name and description
4. Click **Create and Continue**
5. Skip role assignment (or assign as needed)
6. Click **Done**

### Step 3: Enable Domain-Wide Delegation

1. Click on the created service account
2. Go to **Details** tab
3. Check **Enable Google Workspace Domain-wide Delegation**
4. Note the **Client ID**

### Step 4: Authorize in Google Workspace Admin

1. Go to [Google Admin Console](https://admin.google.com/)
2. Navigate to **Security** > **API Controls** > **Domain-wide Delegation**
3. Click **Add new**
4. Enter the service account **Client ID** from Step 3
5. Add OAuth scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
6. Click **Authorize**

### Step 5: Download Service Account Key

1. Go back to Google Cloud Console
2. Click on your service account
3. Go to **Keys** tab
4. Click **Add Key** > **Create new key**
5. Choose **JSON** format
6. Save the key file as `scripts/serviceAccountKey.json`
7. Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the key file path

### Step 6: Set Environment Variable

Add to your `.env` file:

```env
GMAIL_USER_EMAIL=crm@infogloballink.com
GOOGLE_APPLICATION_CREDENTIALS=scripts/serviceAccountKey.json
```

## Running the Email Fetch Script

Once set up, run:

```bash
npm run fetch:emails
```

Or directly:

```bash
npx tsx scripts/fetch-gmail-emails.ts
```

## Setting Up Automated Email Fetching

### Option A: Cron Job (Linux/Mac)

Add to crontab (`crontab -e`):

```bash
# Fetch emails every 15 minutes
*/15 * * * * cd /path/to/gccrmapp && npm run fetch:emails >> logs/email-fetch.log 2>&1
```

### Option B: Systemd Timer (Linux)

Create `/etc/systemd/system/fetch-emails.service`:

```ini
[Unit]
Description=Fetch Gmail Emails for CRM

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/gccrmapp
ExecStart=/usr/bin/npm run fetch:emails
```

Create `/etc/systemd/system/fetch-emails.timer`:

```ini
[Unit]
Description=Timer for Fetch Gmail Emails

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable fetch-emails.timer
sudo systemctl start fetch-emails.timer
```

### Option C: Node.js Cron Library

Install `node-cron`:

```bash
npm install node-cron
```

Create a script that runs continuously:

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';

// Run every 15 minutes
cron.schedule('*/15 * * * *', () => {
  exec('npm run fetch:emails', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(stdout);
  });
});
```

## Troubleshooting

### Error: "No Gmail authentication credentials found"

- Ensure environment variables are set correctly
- Check that service account key file exists (if using service account)
- Verify OAuth2 credentials are correct (if using OAuth2)

### Error: "Insufficient Permission"

- Verify Gmail API is enabled
- Check that correct scopes are authorized
- For service account: ensure domain-wide delegation is set up correctly

### Error: "User not found"

- Verify `GMAIL_USER_EMAIL` is correct
- For service account: ensure the email address is authorized for domain-wide delegation

## Security Notes

1. **Never commit credentials to version control**
   - Add `.env` to `.gitignore`
   - Add `serviceAccountKey.json` to `.gitignore`

2. **Use environment variables** for sensitive data

3. **Rotate credentials** periodically

4. **Limit scopes** to only what's needed (`gmail.readonly`)

5. **Monitor API usage** in Google Cloud Console

