# Set the service account key as a secret
cat scripts/serviceAccountKey.json | npx firebase-tools functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY

# Set the Gmail user email
npx firebase-tools functions:config:set gmail.user_email="crm@infogloballink.com"

# Redeploy the function
npm run firebase:deploy:fetchEmails
