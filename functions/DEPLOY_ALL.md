# Deploy Firebase Cloud Functions

## Prerequisites

1. **Firebase CLI installed** (or use `npx firebase-tools`)
2. **Logged into Firebase:**
   ```bash
   npm run firebase:login
   # Or
   npx firebase-tools login
   ```

3. **Project configured:**
   - Check `.firebaserc` to ensure correct project ID
   - Your project ID: `gccrmapp`

## Step-by-Step Deployment

### Step 1: Install Dependencies

```bash
cd functions
npm install
cd ..
```

### Step 2: Build Functions

The build will happen automatically during deployment (via `predeploy` hook), but you can test it manually:

```bash
cd functions
npm run build
cd ..
```

This compiles TypeScript to JavaScript in the `functions/lib/` directory.

### Step 3: Deploy All Functions

**Option A: Deploy all functions at once (Recommended)**
```bash
npm run firebase:deploy:functions
# Or
npx firebase-tools deploy --only functions
```

**Option B: Deploy specific functions**
```bash
# Deploy only fetchEmails
npm run firebase:deploy:fetchEmails

# Deploy only processEmails
npx firebase-tools deploy --only functions:processEmails

# Deploy only addRole
npx firebase-tools deploy --only functions:addRole
```

### Step 4: Verify Deployment

After deployment, Firebase will show you the function URLs. You can also list all functions:

```bash
npm run firebase:functions:list
# Or
npx firebase-tools functions:list
```

## Function URLs

After deployment, your functions will be available at:

1. **fetchEmails:**
   ```
   https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails
   ```

2. **processEmails:**
   ```
   https://us-central1-gccrmapp.cloudfunctions.net/processEmails
   ```

3. **addRole:**
   ```
   https://us-central1-gccrmapp.cloudfunctions.net/addRole
   ```

## Environment Variables

Make sure these environment variables are set in Firebase Functions:

1. **Go to Firebase Console:**
   - Functions → Configuration
   - Or use Google Cloud Console: Cloud Functions → Configuration

2. **Set these variables:**
   - `GMAIL_USER_EMAIL` - Email address to fetch from (default: `crm@infogloballink.com`)
   - `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account key JSON (recommended)
   - OR `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (OAuth2)

### Setting Environment Variables via CLI

```bash
# Set GMAIL_USER_EMAIL
npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"

# Set service account key (as JSON string)
npx firebase-tools functions:config:set google.service_account_key='{"type":"service_account",...}'
```

**Note:** For v1 functions, you may need to set these in Google Cloud Console instead of Firebase CLI.

## Testing After Deployment

### Test fetchEmails:
```bash
npm run test:fetch-emails
```

### Test processEmails:
```bash
curl https://us-central1-gccrmapp.cloudfunctions.net/processEmails
```

Or use the test script:
```bash
# Create a test script if needed
tsx scripts/test-process-emails-function.ts
```

## Troubleshooting

### "Function not found (404)"
- Function hasn't been deployed yet
- Wrong region in URL (check your Firebase project region)
- Wrong project ID in URL

### "Permission denied"
- Make sure you're logged in: `npm run firebase:login`
- Check you have deploy permissions for the project

### "Missing dependencies"
- Run `npm install` in the `functions` directory
- Make sure `googleapis` is installed

### "TypeScript compilation errors"
- Check `functions/tsconfig.json` is configured correctly
- Run `npm run build` in `functions/` directory to see errors

### "Missing environment variables"
- Set environment variables in Firebase Console or Google Cloud Console
- For v1 functions, you may need to set them in Google Cloud Console

### "Runtime error: Cannot find module"
- Make sure `functions/package.json` has all required dependencies
- Run `npm install` in `functions/` directory

## Deployment Checklist

- [ ] Firebase CLI installed or using `npx firebase-tools`
- [ ] Logged into Firebase (`npm run firebase:login`)
- [ ] Dependencies installed (`cd functions && npm install`)
- [ ] TypeScript compiles successfully (`cd functions && npm run build`)
- [ ] Environment variables set in Firebase/Google Cloud Console
- [ ] Functions deployed (`npm run firebase:deploy:functions`)
- [ ] Functions listed and verified (`npm run firebase:functions:list`)
- [ ] Functions tested (call the URLs or use test scripts)

## Quick Reference Commands

```bash
# Login
npm run firebase:login

# Install dependencies
cd functions && npm install && cd ..

# Build
cd functions && npm run build && cd ..

# Deploy all functions
npm run firebase:deploy:functions

# Deploy specific function
npm run firebase:deploy:fetchEmails
npx firebase-tools deploy --only functions:processEmails

# List functions
npm run firebase:functions:list

# View logs
cd functions && npm run logs
# Or
npx firebase-tools functions:log
```

