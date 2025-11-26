import 'dotenv/config';
import { db } from './firebase-admin.js';
import { Timestamp } from 'firebase-admin/firestore';

interface SampleLead {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted';
  owner: string;
  createdAt: any; // Timestamp
}

async function insertSampleLead() {
  try {
    console.log('Inserting sample lead...\n');

    // Sample lead data
    const sampleLead: SampleLead = {
      name: 'John Walsh',
      company: 'Eagles',
      email: 'jw@eagles.com',
      phone: '111-222-3333',
      status: 'New',
      owner: 'system', // or use a specific user UID
      createdAt: new Date(), // Will be converted to Firestore Timestamp
    };

    // Add to Firestore using Admin SDK
    const leadsRef = db.collection('leads');
    const docRef = await leadsRef.add({
      ...sampleLead,
      createdAt: Timestamp.fromDate(sampleLead.createdAt),
    });

    console.log('✅ Sample lead inserted successfully!');
    console.log(`   Document ID: ${docRef.id}`);
    console.log(`   Name: ${sampleLead.name}`);
    console.log(`   Company: ${sampleLead.company}`);
    console.log(`   Email: ${sampleLead.email}`);
    console.log(`   Status: ${sampleLead.status}\n`);

    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error inserting sample lead:', error.message || error);
    console.error('   Error code:', error.code);
    throw error;
  }
}

// Run the function
insertSampleLead()
  .then((docId) => {
    console.log(`✅ Lead created with ID: ${docId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

