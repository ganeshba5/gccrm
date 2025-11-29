# Azure Static Web App Deployment Guide

This guide will help you deploy the GCCRM application to Azure Static Web Apps.

## Prerequisites

1. An Azure account with an active subscription
2. A GitHub account
3. Your Firebase project credentials

## Step 1: Create Azure Static Web App

1. Go to the [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Static Web App" and select it
4. Click "Create"
5. Fill in the details:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `gccrmapp` (or your preferred name)
   - **Plan type**: Free (or Standard if you need custom domains)
   - **Region**: Select the closest region to your users
   - **Source**: GitHub
   - **GitHub account**: Sign in and authorize Azure
   - **Organization**: Select your GitHub organization or username
   - **Repository**: Select `gccrmapp` (or your repository name)
   - **Branch**: `main` (or your default branch)
   - **Build Presets**: Custom
   - **App location**: `/` (root of repository)
   - **Api location**: Leave empty (no API)
   - **Output location**: `dist` (Vite build output)

6. Click "Review + create", then "Create"

## Step 2: Configure GitHub Secrets

After creating the Static Web App, Azure will automatically:
1. Create a GitHub Actions workflow file (if it doesn't exist)
2. Add the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret to your repository

You need to add your Firebase environment variables as GitHub Secrets:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret" and add each of the following:

   - `VITE_FIREBASE_API_KEY`: Your Firebase API key
   - `VITE_FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain (e.g., `gccrmapp.firebaseapp.com`)
   - `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID (e.g., `gccrmapp`)
   - `VITE_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket (e.g., `gccrmapp.appspot.com`)
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID
   - `VITE_FIREBASE_APP_ID`: Your Firebase app ID

## Step 3: Configure Environment Variables in Azure Portal

1. Go to your Static Web App in Azure Portal
2. Navigate to **Configuration** → **Application settings**
3. Add the same Firebase environment variables as application settings:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

**Note**: Azure Static Web Apps uses these at build time. The GitHub Actions workflow will use the GitHub secrets during the build process.

## Step 4: Deploy

### Automatic Deployment (Recommended)

1. Push your code to the `main` branch
2. GitHub Actions will automatically:
   - Build your application
   - Deploy it to Azure Static Web Apps

### Manual Deployment (Alternative)

If you prefer to deploy manually:

1. Build the application locally:
   ```bash
   npm run build
   ```

2. Install Azure Static Web Apps CLI:
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

3. Deploy using the deployment token from Azure Portal:
   ```bash
   swa deploy dist --deployment-token <YOUR_DEPLOYMENT_TOKEN>
   ```

   You can find your deployment token in:
   - Azure Portal → Your Static Web App → **Manage deployment token**

## Step 5: Verify Deployment

1. Go to your Static Web App in Azure Portal
2. Click on the **URL** (e.g., `https://your-app-name.azurestaticapps.net`)
3. Verify the application loads correctly
4. Test authentication and data operations

## Custom Domain (Optional)

1. Go to your Static Web App in Azure Portal
2. Navigate to **Custom domains**
3. Click "Add"
4. Follow the instructions to add your domain

## Troubleshooting

### Build Fails

- Check GitHub Actions logs for errors
- Verify all environment variables are set correctly
- Ensure `package.json` has the correct build script

### Application Doesn't Load

- Check browser console for errors
- Verify Firebase configuration is correct
- Check that `staticwebapp.config.json` is in the root directory

### Routing Issues (404 on refresh)

- Ensure `staticwebapp.config.json` has the correct `navigationFallback` configuration
- Verify the `routes` section includes a catch-all route

### Environment Variables Not Working

- Ensure variables are prefixed with `VITE_` for Vite to expose them
- Check that variables are set in both GitHub Secrets and Azure Application Settings
- Rebuild and redeploy after adding new variables

## File Structure

```
gccrmapp/
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml  # GitHub Actions workflow
├── staticwebapp.config.json            # Azure Static Web App config
├── dist/                               # Build output (generated)
└── ...
```

## Important Notes

1. **Build Output**: Vite builds to the `dist` directory, which is configured in the workflow
2. **SPA Routing**: The `staticwebapp.config.json` ensures all routes serve `index.html` for client-side routing
3. **Environment Variables**: Must be set in both GitHub Secrets (for build) and Azure Application Settings (for runtime)
4. **Firebase Rules**: Make sure your Firestore security rules are deployed separately using Firebase CLI
5. **Firestore Indexes**: Deploy indexes separately using Firebase CLI

## Deploying Firestore Rules and Indexes

Since Azure Static Web Apps only hosts the frontend, you need to deploy Firestore rules and indexes separately:

```bash
# Deploy Firestore rules
npm run firebase:deploy:rules

# Deploy Firestore indexes
npm run firebase:deploy:indexes
```

## Monitoring

- View deployment logs in GitHub Actions
- Monitor application in Azure Portal → **Monitoring**
- Check application logs in Azure Portal → **Log stream**

## Cost

- **Free Tier**: 100 GB storage, 100 GB bandwidth per month
- **Standard Tier**: Custom domains, more storage and bandwidth
- See [Azure Static Web Apps pricing](https://azure.microsoft.com/pricing/details/app-service/static/) for details

