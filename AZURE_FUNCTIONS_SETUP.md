# Azure Functions Setup for Email Fetching

This guide explains how to set up and deploy the Azure Function for automatically fetching emails from Gmail.

## Overview

The `fetchEmails` function runs on a schedule (every 15 minutes by default) and fetches new emails from Gmail, storing them in Firestore.

## Function Structure

```
api/
  fetchEmails/
    function.json    # Timer trigger configuration
    index.ts         # Function code
    package.json    # Dependencies
    tsconfig.json   # TypeScript configuration
  host.json         # Azure Functions host configuration
```

## Schedule Configuration

The function runs every 15 minutes by default. To change the schedule, edit `api/fetchEmails/function.json`:

```json
{
  "schedule": "0 */15 * * * *"  // Every 15 minutes
}
```

### Cron Expression Format

Azure Functions uses a 6-field cron expression:
```
{second} {minute} {hour} {day} {month} {day-of-week}
```

Examples:
- `0 */15 * * * *` - Every 15 minutes
- `0 0 * * * *` - Every hour
- `0 0 */6 * * *` - Every 6 hours
- `0 0 9 * * *` - Every day at 9 AM
- `0 0 9 * * 1-5` - Weekdays at 9 AM

## Environment Variables

Set these in Azure Portal > Static Web App > Configuration > Application settings:

### Required:
- `GMAIL_USER_EMAIL` - Email address to fetch from (e.g., `crm@infogloballink.com`)

### For Service Account (Recommended):
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key JSON (or use default location)
- Or upload `serviceAccountKey.json` to the function directory

### For OAuth2 (Alternative):
- `GMAIL_CLIENT_ID` - OAuth2 client ID
- `GMAIL_CLIENT_SECRET` - OAuth2 client secret
- `GMAIL_REFRESH_TOKEN` - OAuth2 refresh token

### Firebase Configuration:
The function uses the same Firebase configuration as your main app. Ensure:
- Firebase Admin SDK is properly configured
- Service account key has access to Firestore
- Firestore rules allow writes to `inboundEmails` collection

## Local Development

### Prerequisites
1. [Azure Functions Core Tools](https://docs.microsoft.com/azure/azure-functions/functions-run-local) installed
2. Node.js and npm

### Running Locally

1. Install dependencies:
```bash
cd api/fetchEmails
npm install
```

2. Build the function:
```bash
npm run build
```

3. Set environment variables in `local.settings.json` (create if it doesn't exist):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "GMAIL_USER_EMAIL": "crm@infogloballink.com",
    "GOOGLE_APPLICATION_CREDENTIALS": "../scripts/serviceAccountKey.json"
  }
}
```

4. Run the function:
```bash
func start
```

## Deployment

### Option 1: Automatic Deployment with Static Web App

If your Azure Static Web App is connected to GitHub/Azure DevOps, the function will be deployed automatically when you push to the repository.

### Option 2: Manual Deployment

1. Build the function:
```bash
cd api/fetchEmails
npm install
npm run build
```

2. Deploy using Azure Functions Core Tools:
```bash
func azure functionapp publish <your-function-app-name>
```

Or use Azure CLI:
```bash
az functionapp deployment source config-zip \
  --resource-group <resource-group> \
  --name <function-app-name> \
  --src api.zip
```

### Option 3: Via Azure Portal

1. Go to Azure Portal > Your Static Web App
2. Navigate to Functions
3. Upload the function files or connect to your repository

## Setting Environment Variables in Azure

1. Go to Azure Portal > Your Static Web App
2. Navigate to Configuration > Application settings
3. Add each environment variable:
   - `GMAIL_USER_EMAIL`
   - `GOOGLE_APPLICATION_CREDENTIALS` (or upload service account key)
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (if using OAuth2)

## Uploading Service Account Key

If using service account authentication:

1. Go to Azure Portal > Your Static Web App > Functions
2. Navigate to the `fetchEmails` function
3. Go to Files > Upload
4. Upload `serviceAccountKey.json` to the function directory
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path (e.g., `./serviceAccountKey.json`)

**⚠️ Security Note**: Never commit service account keys to version control. Use Azure Key Vault or secure environment variables for production.

## Monitoring

### View Logs

1. Azure Portal > Your Static Web App > Functions
2. Select `fetchEmails` function
3. Click "Monitor" to view execution history and logs

### Application Insights (Recommended)

Enable Application Insights for detailed monitoring:
1. Azure Portal > Your Static Web App
2. Settings > Application Insights
3. Enable and configure

## Troubleshooting

### Function Not Running

1. Check the schedule in `function.json`
2. Verify the function is deployed
3. Check function logs in Azure Portal

### Authentication Errors

1. Verify environment variables are set correctly
2. Check service account key is uploaded (if using service account)
3. Verify domain-wide delegation is set up (if using service account)
4. Check OAuth2 credentials are valid (if using OAuth2)

### Firestore Permission Errors

1. Verify Firestore rules allow writes to `inboundEmails` collection
2. Check service account has Firestore access
3. Verify Firebase project configuration

### Function Timeout

The default timeout is 5 minutes. For large email batches:
1. Increase timeout in `host.json`:
```json
{
  "functionTimeout": "00:10:00"
}
```

2. Or reduce `maxResults` in the function code

## Testing the Function

### Manual Trigger

You can manually trigger the function:
1. Azure Portal > Your Static Web App > Functions
2. Select `fetchEmails`
3. Click "Test/Run"
4. Click "Run"

### HTTP Trigger (Optional)

To add an HTTP endpoint for manual triggering, create `api/fetchEmailsHttp/`:

```typescript
// api/fetchEmailsHttp/index.ts
import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { fetchNewEmails } from "../fetchEmails/index";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    try {
        const result = await fetchNewEmails();
        context.res = {
            status: 200,
            body: {
                success: true,
                stored: result.stored,
                skipped: result.skipped
            }
        };
    } catch (error: any) {
        context.res = {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};

export default httpTrigger;
```

## Cost Considerations

- Azure Functions consumption plan: First 1 million executions per month are free
- Timer triggers are very cost-effective
- Monitor usage in Azure Portal > Cost Management

## Security Best Practices

1. **Never commit secrets**: Use Azure Key Vault or secure environment variables
2. **Use service account**: More secure than OAuth2 for server-to-server communication
3. **Limit permissions**: Service account should only have `gmail.readonly` scope
4. **Monitor access**: Regularly review function execution logs
5. **Rotate credentials**: Periodically rotate service account keys and OAuth2 tokens

## Next Steps

1. Set up environment variables in Azure Portal
2. Upload service account key (if using service account)
3. Deploy the function
4. Monitor the first execution
5. Verify emails are being stored in Firestore

