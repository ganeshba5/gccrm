import 'dotenv/config';
import { db } from './firebase-admin.js';

async function listAllLeads() {
  try {
    console.log('Querying all leads...\n');
    
    // Get all leads
    const leadsRef = db.collection('leads');
    const querySnapshot = await leadsRef
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log(`Found ${querySnapshot.size} total leads\n`);
    
    if (querySnapshot.size === 0) {
      console.log('No leads found in the database.');
      console.log('Create leads through the web app at: http://localhost:5173/dashboard');
      return;
    }
    
    // Group by status
    const byStatus: Record<string, any[]> = {};
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = [];
      }
      byStatus[status].push({
        id: doc.id,
        ...data
      });
    });
    
    // Display by status
    Object.keys(byStatus).sort().forEach(status => {
      console.log(`\n${status} (${byStatus[status].length}):`);
      console.log('─'.repeat(50));
      byStatus[status].forEach((lead, index) => {
        const createdAt = lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleString() : 
                          (lead.createdAt ? new Date(lead.createdAt.seconds * 1000).toLocaleString() : 'N/A');
        console.log(`  ${index + 1}. ${lead.name || 'Unnamed'}`);
        console.log(`     Company: ${lead.company || 'N/A'}`);
        console.log(`     Email: ${lead.email || 'N/A'}`);
        console.log(`     Owner: ${lead.owner || 'Unassigned'}`);
        console.log(`     Created: ${createdAt}`);
        console.log('');
      });
    });
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    Object.keys(byStatus).forEach(status => {
      console.log(`  ${status}: ${byStatus[status].length}`);
    });
    console.log(`  Total: ${querySnapshot.size}`);
    
  } catch (error: any) {
    console.error('\n❌ Error fetching leads:', error.message || error);
    throw error;
  }
}

listAllLeads()
  .then(() => {
    console.log('\n✅ Query completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

