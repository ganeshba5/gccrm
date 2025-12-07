/**
 * Test script to manually trigger processEmails Firebase Cloud Function
 * 
 * This will process all unprocessed emails in the database.
 */

const FUNCTION_URL = process.env.FUNCTION_URL || 'https://us-central1-gccrmapp.cloudfunctions.net/processEmails';

async function testProcessEmails() {
  console.log('🧪 Testing processEmails Firebase Cloud Function\n');
  console.log(`📍 Function URL: ${FUNCTION_URL}\n`);
  
  try {
    console.log('📤 Sending request...\n');
    
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = Date.now();
    const data = await response.json();
    
    console.log(`📥 Response received (${responseTime}ms)\n`);
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    if (response.ok) {
      console.log('✅ SUCCESS!\n');
      console.log('Result:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ FAILED!\n');
      console.log('Error Details:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ ERROR!\n');
    console.error('Failed to call function:');
    console.error(error.message);
    process.exit(1);
  }
}

testProcessEmails();

