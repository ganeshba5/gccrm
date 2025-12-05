# Debug: Service Account Key Not Detected

The workflow is still using OAuth2, which means `GOOGLE_SERVICE_ACCOUNT_KEY` is not set in GitHub Secrets.

## Quick Check

1. **Verify the secret exists:**
   - Go to: https://github.com/ganeshba5/gccrm/settings/secrets/actions
   - Look for `GOOGLE_SERVICE_ACCOUNT_KEY`
   - If it doesn't exist, you need to add it (see below)

2. **If the secret exists but still not working:**
   - The JSON might be malformed
   - Check that it's the complete JSON (starts with `{` and ends with `}`)
   - Ensure there are no extra spaces or characters

## How to Add the Secret

1. **Get your service account key content:**
   ```bash
   cat scripts/serviceAccountKey.json
   ```

2. **Copy the entire JSON** (everything from `{` to `}`)

3. **Add to GitHub:**
   - Go to: https://github.com/ganeshba5/gccrm/settings/secrets/actions
   - Click **New repository secret**
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: Paste the entire JSON content
   - Click **Add secret**

## Important Notes

- The JSON should be valid JSON (can be formatted or minified)
- GitHub Secrets are case-sensitive
- The secret name must be exactly: `GOOGLE_SERVICE_ACCOUNT_KEY`
- After adding, trigger the workflow manually to test

## Test After Adding

1. Go to **Actions** tab
2. Select **Schedule Email Fetch**
3. Click **Run workflow** > **Run workflow**
4. Check logs - you should see: "Using service account from environment variable..."

If you still see "Using OAuth2 credentials...", the secret is not set correctly.

