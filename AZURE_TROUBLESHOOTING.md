# Azure Static Web Apps Troubleshooting Guide

## Common Deployment Errors

### "Failure during content distribution" or "app build failed to produce artifact folder: 'build'"

This error typically occurs when:

1. **Build output is empty or missing**
   - Check GitHub Actions logs to verify the build step completed successfully
   - Ensure `dist/index.html` exists after build
   - Verify all environment variables are set in GitHub Secrets
   - Check that the `build` directory was created (workflow copies `dist` to `build`)

2. **Missing or incorrect configuration**
   - Ensure `staticwebapp.config.json` is in the repository root
   - Verify the `output_location` in the workflow is set to `build` (not `dist`)
   - Check Azure Portal → Static Web App → Configuration → Deployment to ensure output location matches

3. **TypeScript compilation errors**
   - Check the build logs for TypeScript errors
   - Ensure all dependencies are installed correctly

### Solutions

#### 1. Verify Build Output Locally

Test the build locally to ensure it works:

```bash
# Install dependencies
npm ci

# Set environment variables (create .env file)
export VITE_FIREBASE_API_KEY=your-key
export VITE_FIREBASE_AUTH_DOMAIN=your-domain
export VITE_FIREBASE_PROJECT_ID=your-project-id
export VITE_FIREBASE_STORAGE_BUCKET=your-bucket
export VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
export VITE_FIREBASE_APP_ID=your-app-id

# Build
npm run build

# Verify dist directory exists and has files
ls -la dist/
```

#### 2. Check GitHub Actions Logs

1. Go to your GitHub repository
2. Click on **Actions** tab
3. Click on the failed workflow run
4. Check each step for errors:
   - **Install dependencies**: Should complete without errors
   - **Build**: Should show successful build output
   - **Verify build output**: Should list files in dist/
   - **Build And Deploy**: Check for specific error messages

#### 3. Verify Environment Variables

Ensure all Firebase environment variables are set in GitHub Secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Verify these secrets exist:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` (automatically added by Azure)

#### 4. Check staticwebapp.config.json

Ensure the file exists in the repository root and has valid JSON:

```bash
# Verify file exists
ls -la staticwebapp.config.json

# Validate JSON syntax
cat staticwebapp.config.json | jq .
```

#### 5. Verify Azure Static Web App Configuration

In Azure Portal:

1. Go to your Static Web App
2. Navigate to **Configuration** → **Application settings**
3. Verify environment variables are set (optional, but recommended)
4. Check **Deployment history** for detailed error messages

#### 6. Check File Size Limits

Azure Static Web Apps has file size limits:
- Individual file: 100 MB
- Total deployment: 100 MB (Free tier) or 250 MB (Standard tier)

If your build output is too large, consider:
- Enabling compression in Vite
- Removing unnecessary files from the build
- Using code splitting

#### 7. TypeScript Build Issues

If TypeScript compilation fails:

```bash
# Check TypeScript errors locally
npm run build

# Or run TypeScript compiler directly
npx tsc -b
```

Common TypeScript issues:
- Missing type definitions
- Strict mode errors
- Import path issues

#### 8. Network/Timeout Issues

If deployment times out:
- Check if build is taking too long
- Consider optimizing build process
- Check Azure service status

## Debugging Steps

### Step 1: Check Build Logs

Look for these in GitHub Actions:

```
✓ built in Xs
dist/index.html
dist/assets/...
```

### Step 2: Verify File Structure

The `dist` directory should contain:
- `index.html`
- `assets/` directory with JS and CSS files
- Any static assets from `public/`

### Step 3: Test Locally

```bash
# Build
npm run build

# Preview build
npm run preview

# Test at http://localhost:4173
```

### Step 4: Check Azure Portal

1. Go to Azure Portal → Your Static Web App
2. Check **Deployment history**
3. Look for detailed error messages
4. Check **Log stream** for runtime errors

## Common Fixes

### Fix 1: Missing Environment Variables

**Error**: Build fails or app doesn't work after deployment

**Solution**: Add all required environment variables to GitHub Secrets

### Fix 2: Build Output Not Found

**Error**: "dist directory does not exist"

**Solution**: 
- Check that `npm run build` completes successfully
- Verify `vite.config.ts` has `outDir: 'dist'`
- Check build logs for errors

### Fix 3: Routing Issues

**Error**: 404 errors on page refresh

**Solution**: 
- Verify `staticwebapp.config.json` has correct `navigationFallback` configuration
- Ensure routes are configured correctly

### Fix 4: CORS or Firebase Errors

**Error**: Firebase connection errors in browser

**Solution**:
- Verify Firebase environment variables are correct
- Check Firebase Console for allowed domains
- Add your Azure Static Web App domain to Firebase authorized domains

## Getting More Help

1. **GitHub Actions Logs**: Check the full logs in the Actions tab
2. **Azure Portal**: Check deployment history and logs
3. **Azure Documentation**: https://docs.microsoft.com/azure/static-web-apps/
4. **GitHub Issues**: https://github.com/azure/static-web-apps/issues

## Prevention

To avoid deployment issues:

1. **Test builds locally** before pushing
2. **Use GitHub Actions** to catch issues early
3. **Monitor deployment history** in Azure Portal
4. **Keep dependencies updated**
5. **Document environment variables** clearly

