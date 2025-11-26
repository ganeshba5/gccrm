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
}

// Sample leads data
const sampleLeads: SampleLead[] = [
  {
    name: 'John Walsh',
    company: 'Eagles',
    email: 'jw@eagles.com',
    phone: '111-222-3333',
    status: 'New',
    owner: 'system',
  },
  {
    name: 'Alice Johnson',
    company: 'Acme Corp',
    email: 'alice@acme.com',
    phone: '555-0101',
    status: 'Contacted',
    owner: 'system',
  },
  {
    name: 'Bob Smith',
    company: 'Tech Solutions',
    email: 'bob@tech.com',
    phone: '555-0202',
    status: 'Qualified',
    owner: 'system',
  },
  {
    name: 'Carol Williams',
    company: 'Global Inc',
    email: 'carol@global.com',
    phone: '555-0303',
    status: 'New',
    owner: 'system',
  },
  {
    name: 'David Brown',
    company: 'StartupXYZ',
    email: 'david@startup.com',
    phone: '555-0404',
    status: 'Converted',
    owner: 'system',
  },
];

async function insertMultipleLeads() {
  try {
    console.log(`Inserting ${sampleLeads.length} sample leads...\n`);

    const leadsRef = db.collection('leads');
    const batch = db.batch();
    const now = Timestamp.now();

    sampleLeads.forEach((lead, index) => {
      const docRef = leadsRef.doc(); // Auto-generate document ID
      batch.set(docRef, {
        ...lead,
        createdAt: now, // All leads get the same timestamp for batch insert
      });
      console.log(`  Prepared lead ${index + 1}: ${lead.name} (${lead.status})`);
    });

    // Commit the batch
    await batch.commit();

    console.log(`\n✅ Successfully inserted ${sampleLeads.length} leads!`);
    console.log('   All leads have been added to the database.\n');

    return sampleLeads.length;
  } catch (error: any) {
    console.error('❌ Error inserting leads:', error.message || error);
    console.error('   Error code:', error.code);
    throw error;
  }
}

// Run the function
insertMultipleLeads()
  .then((count) => {
    console.log(`✅ ${count} leads created successfully`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

