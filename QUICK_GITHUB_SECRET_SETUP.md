# Quick Setup: Add Service Account Key to GitHub Secrets

Since your service account key works locally, you just need to add it to GitHub Secrets.

## Steps

1. **Open your service account key file:**
   ```bash
   cat scripts/serviceAccountKey.json
   ```

2. **Copy the entire JSON content** (all of it, including the curly braces)

3. **Go to GitHub:**
   - Navigate to: `https://github.com/ganeshba5/gccrm`
   - Click **Settings** (top right of repository)
   - Click **Secrets and variables** > **Actions** (left sidebar)

4. **Add the secret:**
   - Click **New repository secret**
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_KEY`
   - **Value:** Paste the entire JSON content from step 1
   - Click **Add secret**

5. **Verify other required secrets are set:**
   - `GMAIL_USER_EMAIL` = `crm@infogloballink.com`
   - `FIREBASE_ADMIN_PROJECT_ID` = Your Firebase project ID
   - `VITE_FIREBASE_PROJECT_ID` = Your Firebase project ID (same as above)

## Important Notes

- The JSON can be pasted as-is (with formatting/newlines) or as a single line
- GitHub Secrets are encrypted and only visible during workflow runs
- Never commit the service account key file to git (it should be in `.gitignore`)

## Test

After adding the secret, you can manually trigger the workflow:
1. Go to **Actions** tab
2. Select **Schedule Email Fetch** workflow
3. Click **Run workflow** > **Run workflow**
4. Check the logs to verify authentication succeeds

