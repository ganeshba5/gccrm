#!/usr/bin/env tsx
/**
 * Script to query and display items created by email processing
 * 
 * Usage:
 *   npm run query:email-items
 *   npm run query:email-items -- --type accounts
 *   npm run query:email-items -- --type opportunities
 *   npm run query:email-items -- --type notes
 */

import { initializeFirebaseAdmin } from './firebase-admin';
import * as admin from 'firebase-admin';

interface QueryOptions {
  type?: 'accounts' | 'opportunities' | 'notes' | 'all';
  limit?: number;
}

async function queryEmailCreatedItems(options: QueryOptions = {}) {
  const { type = 'all', limit = 100 } = options;
  
  await initializeFirebaseAdmin();
  const db = admin.firestore();
  
  console.log(`\n🔍 Querying items created by email processing (source: 'email')...\n`);
  
  const results: {
    accounts: any[];
    opportunities: any[];
    notes: any[];
  } = {
    accounts: [],
    opportunities: [],
    notes: [],
  };
  
  try {
    // Query Accounts
    if (type === 'all' || type === 'accounts') {
      console.log('📊 Querying Accounts...');
      const accountsSnapshot = await db.collection('accounts')
        .where('source', '==', 'email')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      results.accounts = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log(`   Found ${results.accounts.length} account(s)\n`);
    }
    
    // Query Opportunities
    if (type === 'all' || type === 'opportunities') {
      console.log('📊 Querying Opportunities...');
      const opportunitiesSnapshot = await db.collection('opportunities')
        .where('source', '==', 'email')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      results.opportunities = opportunitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log(`   Found ${results.opportunities.length} opportunity/ies\n`);
    }
    
    // Query Notes
    if (type === 'all' || type === 'notes') {
      console.log('📊 Querying Notes...');
      const notesSnapshot = await db.collection('notes')
        .where('source', '==', 'email')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      results.notes = notesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log(`   Found ${results.notes.length} note(s)\n`);
    }
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Accounts: ${results.accounts.length}`);
    console.log(`Opportunities: ${results.opportunities.length}`);
    console.log(`Notes: ${results.notes.length}`);
    console.log(`Total: ${results.accounts.length + results.opportunities.length + results.notes.length}`);
    
    if (results.accounts.length > 0) {
      console.log('\n📁 ACCOUNTS:');
      results.accounts.forEach((account, idx) => {
        const createdAt = account.createdAt?.toDate?.() || account.createdAt;
        console.log(`  ${idx + 1}. ${account.name} (ID: ${account.id})`);
        console.log(`     Created: ${createdAt}`);
        console.log(`     Status: ${account.status}`);
        console.log('');
      });
    }
    
    if (results.opportunities.length > 0) {
      console.log('\n💼 OPPORTUNITIES:');
      results.opportunities.forEach((opp, idx) => {
        const createdAt = opp.createdAt?.toDate?.() || opp.createdAt;
        console.log(`  ${idx + 1}. ${opp.name} (ID: ${opp.id})`);
        console.log(`     Account ID: ${opp.accountId || 'N/A'}`);
        console.log(`     Stage: ${opp.stage}`);
        console.log(`     Created: ${createdAt}`);
        console.log('');
      });
    }
    
    if (results.notes.length > 0) {
      console.log('\n📝 NOTES:');
      results.notes.forEach((note, idx) => {
        const createdAt = note.createdAt?.toDate?.() || note.createdAt;
        const contentPreview = note.content?.substring(0, 100) || '';
        console.log(`  ${idx + 1}. Note ID: ${note.id}`);
        console.log(`     Opportunity ID: ${note.opportunityId || 'N/A'}`);
        console.log(`     Account ID: ${note.accountId || 'N/A'}`);
        console.log(`     Content preview: ${contentPreview}...`);
        console.log(`     Created: ${createdAt}`);
        console.log('');
      });
    }
    
    console.log('='.repeat(80) + '\n');
    
  } catch (error: any) {
    console.error('❌ Error querying items:', error.message);
    
    if (error.message?.includes('index')) {
      console.error('\n💡 Tip: You may need to create a Firestore index for the "source" field.');
      console.error('   The error message should include a link to create the index automatically.');
    }
    
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: QueryOptions = {};

if (args.includes('--type')) {
  const typeIndex = args.indexOf('--type');
  const typeValue = args[typeIndex + 1];
  if (['accounts', 'opportunities', 'notes', 'all'].includes(typeValue)) {
    options.type = typeValue as any;
  }
}

if (args.includes('--limit')) {
  const limitIndex = args.indexOf('--limit');
  const limitValue = parseInt(args[limitIndex + 1], 10);
  if (!isNaN(limitValue)) {
    options.limit = limitValue;
  }
}

// Run the query
queryEmailCreatedItems(options)
  .then(() => {
    console.log('✅ Query complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

