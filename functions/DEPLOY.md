# Deploy fetchEmails Firebase Cloud Function

## Quick Deploy

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Build the function:**
   ```bash
   npm run build
   ```
   (If you have a build script, otherwise TypeScript will compile automatically)

3. **Deploy:**
   ```bash
   # From project root
   npm run firebase:deploy:fetchEmails
   
   # Or directly
   npx firebase-tools deploy --only functions:fetchEmails
   ```

4. **Get the function URL:**
   After deployment, Firebase will show you the function URL, or check:
   ```bash
   npm run firebase:functions:list
   # Or
   npx firebase-tools functions:list
   ```

## Find Your Function URL

After deployment, the function URL will be:
```
https://<region>-<project-id>.cloudfunctions.net/fetchEmails
```

Common regions:
- `us-central1` (default)
- `us-east1`
- `europe-west1`
- `asia-northeast1`

Your project ID is: `gccrmapp` (from `.firebaserc`)

So the URL should be:
```
https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails
```

## Test After Deployment

```bash
npm run test:fetch-emails
```

Or with the specific URL:
```bash
FUNCTION_URL=https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails npm run test:fetch-emails
```

## Troubleshooting

### "Function not found (404)"

- Function hasn't been deployed yet
- Wrong region in URL
- Wrong project ID in URL
- Function name mismatch

### "Permission denied"

- Make sure you're logged in: `npm run firebase:login` or `npx firebase-tools login`
- Check you have deploy permissions for the project

### "command not found: firebase"

- Use `npx firebase-tools` instead of `firebase`
- Or use the npm scripts: `npm run firebase:deploy:fetchEmails`

### "Missing dependencies"

- Run `npm install` in the `functions` directory
- Make sure `googleapis` is installed

