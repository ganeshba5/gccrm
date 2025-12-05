/**
 * Test client script for fetchEmails Firebase Cloud Function
 * 
 * Usage:
 *   npx tsx scripts/test-fetch-emails-function.ts
 * 
 * Or with custom URL:
 *   FUNCTION_URL=https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails npx tsx scripts/test-fetch-emails-function.ts
 * 
 * Environment variables:
 *   FUNCTION_URL: Full URL to the fetchEmails function (required)
 *   FUNCTION_SECRET: Optional secret for authentication (if function requires it)
 */

import 'dotenv/config';

const FUNCTION_URL = process.env.FUNCTION_URL || 
  process.env.FIREBASE_FUNCTION_URL ||
  'https://us-central1-gccrmapp.cloudfunctions.net/fetchEmails';

const FUNCTION_SECRET = process.env.FUNCTION_SECRET;

interface FetchEmailsResponse {
  success: boolean;
  message?: string;
  stored?: number;
  skipped?: number;
  error?: string;
  timestamp?: string;
}

async function testFetchEmails() {
  console.log('🧪 Testing fetchEmails Firebase Cloud Function\n');
  console.log(`📍 Function URL: ${FUNCTION_URL}\n`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication header if secret is provided
    if (FUNCTION_SECRET) {
      headers['Authorization'] = `Bearer ${FUNCTION_SECRET}`;
      console.log('🔐 Using authentication token\n');
    }

    console.log('📤 Sending request...\n');

    const startTime = Date.now();
    const response = await fetch(FUNCTION_URL, {
      method: 'GET',
      headers: headers,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📥 Response received (${duration}ms)\n`);
    console.log(`Status: ${response.status} ${response.statusText}\n`);

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let data: FetchEmailsResponse;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Handle HTML responses (like 404 pages)
      const text = await response.text();
      console.log('⚠️  Received non-JSON response (likely HTML error page)\n');
      
      if (response.status === 404) {
        console.log('❌ Function not found (404)\n');
        console.log('Possible reasons:');
        console.log('  1. Function has not been deployed yet');
        console.log('  2. Function URL is incorrect');
        console.log('  3. Function is in a different region\n');
        console.log('💡 To find the correct URL:');
        console.log('  1. Deploy the function: firebase deploy --only functions:fetchEmails');
        console.log('  2. Check Firebase Console > Functions for the exact URL');
        console.log('  3. Or run: firebase functions:list\n');
        console.log('💡 To get the function URL after deployment:');
        console.log('   firebase functions:config:get\n');
        process.exit(1);
      } else {
        console.log('Response body (first 500 chars):');
        console.log(text.substring(0, 500));
        console.log('');
        throw new Error(`Unexpected response format: ${contentType}`);
      }
    }

    if (response.ok && data.success) {
      console.log('✅ SUCCESS!\n');
      console.log('Results:');
      console.log(`  - Stored: ${data.stored || 0} emails`);
      console.log(`  - Skipped: ${data.skipped || 0} emails`);
      console.log(`  - Message: ${data.message || 'N/A'}`);
      if (data.timestamp) {
        console.log(`  - Timestamp: ${data.timestamp}`);
      }
      console.log('');
    } else {
      console.log('❌ FAILED!\n');
      console.log('Error Details:');
      console.log(`  - Error: ${data.error || 'Unknown error'}`);
      if (data.timestamp) {
        console.log(`  - Timestamp: ${data.timestamp}`);
      }
      console.log('');
      
      if (response.status === 401) {
        console.log('💡 Tip: This function may require authentication.');
        console.log('   Set FUNCTION_SECRET environment variable if needed.\n');
      } else if (response.status === 500) {
        console.log('💡 Tip: Check Firebase Functions logs for more details:');
        console.log('   firebase functions:log --only fetchEmails\n');
      }
      
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ ERROR!\n');
    console.error('Failed to call function:');
    console.error(`  ${error.message}\n`);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Check that:');
      console.error('   1. The FUNCTION_URL is correct');
      console.error('   2. The function is deployed');
      console.error('   3. Your network connection is working\n');
    } else if (error.message.includes('fetch')) {
      console.error('💡 Tip: If using Node.js < 18, install node-fetch:');
      console.error('   npm install node-fetch\n');
    } else if (error.message.includes('Unexpected token')) {
      console.error('💡 Tip: The function returned HTML instead of JSON.');
      console.error('   This usually means the function is not deployed or the URL is incorrect.\n');
      console.error('   To deploy the function:');
      console.error('   1. cd functions && npm install');
      console.error('   2. firebase deploy --only functions:fetchEmails\n');
      console.error('   To find the correct URL after deployment:');
      console.error('   - Check Firebase Console > Functions');
      console.error('   - Or run: firebase functions:list\n');
    }
    
    process.exit(1);
  }
}

// Run the test
testFetchEmails();

