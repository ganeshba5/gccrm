import 'dotenv/config';
// Use Admin SDK for scripts (bypasses security rules)
import { db } from './firebase-admin.js';
// Admin SDK uses different syntax - no need to import collection/query functions

async function getLeadsByStatus(status: string = 'New') {
  try {
    console.log(`Querying leads with status: "${status}"...\n`);
    
    // Get leads filtered by status using Admin SDK
    const leadsRef = db.collection('leads');
    const querySnapshot = await leadsRef
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log(`Found ${querySnapshot.size} leads with status: ${status}\n`);
    
    const leads = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Admin SDK returns Timestamp objects directly
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 
                        (data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'N/A');
      
      return {
        id: doc.id,
        name: data.name,
        company: data.company || 'N/A',
        email: data.email || 'N/A',
        phone: data.phone || 'N/A',
        status: data.status,
        owner: data.owner || 'Unassigned',
        createdAt: createdAt,
      };
    });
    
    // Display results
    leads.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.name}`);
      console.log(`   Company: ${lead.company}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Phone: ${lead.phone}`);
      console.log(`   Owner: ${lead.owner}`);
      console.log(`   Created: ${lead.createdAt}`);
      console.log('');
    });
    
    return leads;
  } catch (error: any) {
    console.error('\n❌ Error fetching leads:', error.message || error);
    
    if (error.code === 'permission-denied') {
      console.error('   → Permission denied. Make sure you are authenticated and have proper permissions.');
    } else if (error.code === 'not-found') {
      console.error('   → Firestore database not found. This usually means:');
      console.error('     1. The Firestore database hasn\'t been created yet');
      console.error('     2. The project ID in your .env file is incorrect');
      console.error('     3. Firestore API is not enabled for this project');
      console.error('\n   To create the database, run:');
      console.error('     npm run firebase:deploy:firestore');
    } else if (error.code === 'unavailable') {
      console.error('   → Firestore is unavailable. Check your internet connection.');
    } else {
      console.error('   → Error code:', error.code);
      console.error('   → Full error:', error);
    }
    
    throw error;
  }
}

// Get status from command line argument or default to 'New'
const status = process.argv[2] || 'New';

// Run the query
getLeadsByStatus(status)
  .then(() => {
    console.log('Query completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
