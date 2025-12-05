# Scripts Directory

This directory contains utility scripts for working with the CRM application.

## Setup

### 1. Install dotenv (optional, for .env file support)

```bash
npm install -D dotenv
```

### 2. Set Environment Variables

You have two options:

**Option A: Create a `.env` file in the project root**

```bash
# .env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Option B: Export environment variables before running**

```bash
export VITE_FIREBASE_API_KEY=your-api-key
export VITE_FIREBASE_PROJECT_ID=your-project-id
# ... etc
```

## Running Scripts

### Query Leads by Status

**Use `tsx` instead of `ts-node` for better ES module support:**

```bash
# Install tsx (one time, or use npx)
npm install -D tsx

# Get "New" leads (default)
npx tsx scripts/leadsbystatus.ts

# Get leads with specific status
npx tsx scripts/leadsbystatus.ts Contacted
npx tsx scripts/leadsbystatus.ts Qualified
npx tsx scripts/leadsbystatus.ts Converted
```

**Note:** If you get permission errors, you may need to:
1. Use Firebase Admin SDK (requires service account key)
2. Or temporarily adjust Firestore rules for testing
3. Or authenticate in the script (more complex)

### Example Output

```
Found 5 leads with status: New

1. John Doe
   Company: Acme Corp
   Email: john@acme.com
   Phone: 555-1234
   Owner: user123
   Created: 1/15/2025, 10:30:00 AM

2. Jane Smith
   Company: Tech Inc
   Email: jane@tech.com
   Phone: 555-5678
   Owner: user456
   Created: 1/14/2025, 2:15:00 PM
```

## Available Scripts

### Test Firebase Cloud Function

- `test-fetch-emails-function.ts` - Test the fetchEmails Firebase Cloud Function
  ```bash
  npm run test:fetch-emails
  # Or with custom URL:
  FUNCTION_URL=https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails npm run test:fetch-emails
  ```

## Available Scripts

### Query Scripts

- `leadsbystatus.ts` - Query and display leads filtered by status
  ```bash
  npx tsx scripts/leadsbystatus.ts New
  npx tsx scripts/leadsbystatus.ts Contacted
  ```

- `listallleads.ts` - List all leads grouped by status
  ```bash
  npx tsx scripts/listallleads.ts
  ```

### Insert Scripts

- `insert-sample-lead.ts` - Insert a single sample lead
  ```bash
  npx tsx scripts/insert-sample-lead.ts
  ```

- `insert-multiple-leads.ts` - Insert multiple sample leads (batch insert)
  ```bash
  npx tsx scripts/insert-multiple-leads.ts
  ```

### Utility Files

- `firebase-admin.ts` - Firebase Admin SDK initialization for scripts
- `firebase-node.ts` - Firebase client SDK initialization (for reference)

## Creating New Scripts

When creating new scripts:

1. Import Firebase from `./firebase-node.js` (not from `../src/lib/firebase.js`)
2. Use async/await for Firestore operations
3. Handle errors appropriately
4. Use `process.exit()` to properly terminate the script

### Template

```typescript
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './firebase-node.js';

async function myScript() {
  try {
    // Your code here
    const leadsRef = collection(db, 'leads');
    const snapshot = await getDocs(leadsRef);
    console.log(`Found ${snapshot.size} leads`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

myScript()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
```

## Troubleshooting

### "Missing Firebase configuration"

Make sure your environment variables are set. Check:
- `.env` file exists in project root
- Environment variables are exported
- Variable names start with `VITE_FIREBASE_`

### "Permission denied"

Make sure you're authenticated in Firebase. The script uses the same Firebase config as the app, so you need proper permissions.

### "Cannot find module"

Make sure you're running from the project root:
```bash
cd /path/to/gccrmapp
npx ts-node --esm scripts/your-script.ts
```

