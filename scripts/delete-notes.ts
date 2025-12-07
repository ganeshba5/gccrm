/**
 * Script to delete notes from Firestore with where conditions
 * 
 * Usage:
 *   npx tsx scripts/delete-notes.ts --field <field> --operator <operator> --value <value> [--dry-run]
 * 
 * Examples:
 *   # Dry run: Show notes that would be deleted (source = 'email')
 *   npx tsx scripts/delete-notes.ts --field source --operator == --value email --dry-run
 * 
 *   # Delete notes created by a specific user
 *   npx tsx scripts/delete-notes.ts --field createdBy --operator == --value "userId123"
 * 
 *   # Delete notes for a specific opportunity
 *   npx tsx scripts/delete-notes.ts --field opportunityId --operator == --value "oppId123"
 * 
 *   # Delete notes older than a date (requires timestamp comparison)
 *   npx tsx scripts/delete-notes.ts --field createdAt --operator "<" --value "2024-01-01"
 */

import 'dotenv/config';
import { db } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Parse command line arguments manually (no external dependency)
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    field: '',
    operator: '==',
    value: '',
    dryRun: false,
    limit: '100',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--field' || arg === '-f') {
      options.field = args[++i] || '';
    } else if (arg === '--operator' || arg === '-o') {
      options.operator = args[++i] || '==';
    } else if (arg === '--value' || arg === '-v') {
      options.value = args[++i] || '';
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = args[++i] || '100';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx scripts/delete-notes.ts --field <field> --operator <operator> --value <value> [options]

Options:
  -f, --field <field>        Field name to filter by (e.g., source, createdBy, opportunityId)
  -o, --operator <operator>  Comparison operator (==, !=, <, <=, >, >=, array-contains) [default: ==]
  -v, --value <value>        Value to compare against
  -d, --dry-run              Show what would be deleted without actually deleting
  -l, --limit <limit>        Limit the number of results (for safety) [default: 100]
  -h, --help                 Show this help message

Examples:
  # Dry run: Show notes that would be deleted (source = 'email')
  npx tsx scripts/delete-notes.ts --field source --operator == --value email --dry-run

  # Delete notes created by a specific user
  npx tsx scripts/delete-notes.ts --field createdBy --operator == --value "userId123"

  # Delete notes for a specific opportunity
  npx tsx scripts/delete-notes.ts --field opportunityId --operator == --value "oppId123"

  # Delete notes older than a date
  npx tsx scripts/delete-notes.ts --field createdAt --operator "<" --value "2024-01-01"
`);
      process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();
const field = options.field;
const operator = options.operator;
const value = options.value;
const dryRun = options.dryRun;
const limit = parseInt(options.limit, 10);

if (!field || !value) {
  console.error('❌ Error: --field and --value are required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/delete-notes.ts --field <field> --operator <operator> --value <value> [--dry-run]');
  console.log('\nExamples:');
  console.log('  npx tsx scripts/delete-notes.ts --field source --operator == --value email --dry-run');
  console.log('  npx tsx scripts/delete-notes.ts --field createdBy --operator == --value "userId123"');
  process.exit(1);
}

async function deleteNotes() {
  try {
    console.log(`\n🔍 Querying notes with condition: ${field} ${operator} ${value}`);
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No notes will be deleted\n');
    } else {
      console.log('⚠️  DELETION MODE - Notes will be permanently deleted\n');
    }

    const notesRef = db.collection('notes');
    let query: any = notesRef;

    // Build query based on operator
    switch (operator) {
      case '==':
        query = query.where(field, '==', value);
        break;
      case '!=':
        query = query.where(field, '!=', value);
        break;
      case '<':
        // Handle date strings
        const dateValue = value.includes('-') ? Timestamp.fromDate(new Date(value)) : value;
        query = query.where(field, '<', dateValue);
        break;
      case '<=':
        const dateValueLte = value.includes('-') ? Timestamp.fromDate(new Date(value)) : value;
        query = query.where(field, '<=', dateValueLte);
        break;
      case '>':
        const dateValueGt = value.includes('-') ? Timestamp.fromDate(new Date(value)) : value;
        query = query.where(field, '>', dateValueGt);
        break;
      case '>=':
        const dateValueGte = value.includes('-') ? Timestamp.fromDate(new Date(value)) : value;
        query = query.where(field, '>=', dateValueGte);
        break;
      case 'array-contains':
        query = query.where(field, 'array-contains', value);
        break;
      default:
        console.error(`❌ Unsupported operator: ${operator}`);
        console.log('Supported operators: ==, !=, <, <=, >, >=, array-contains');
        process.exit(1);
    }

    // Apply limit
    query = query.limit(limit);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('✅ No notes found matching the criteria.');
      return;
    }

    console.log(`\n📋 Found ${snapshot.size} note(s) matching criteria:\n`);
    console.log('─'.repeat(80));

    // Display notes that will be deleted
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate 
        ? data.createdAt.toDate().toLocaleString()
        : data.createdAt 
        ? new Date(data.createdAt.seconds * 1000).toLocaleString()
        : 'N/A';
      
      const contentPreview = data.content 
        ? (data.content.length > 100 ? data.content.substring(0, 100) + '...' : data.content)
        : 'No content';
      
      console.log(`\n${index + 1}. Note ID: ${doc.id}`);
      console.log(`   Content: ${contentPreview}`);
      console.log(`   Created By: ${data.createdBy || 'N/A'}`);
      console.log(`   Source: ${data.source || 'N/A'}`);
      console.log(`   Account ID: ${data.accountId || 'N/A'}`);
      console.log(`   Opportunity ID: ${data.opportunityId || 'N/A'}`);
      console.log(`   Contact ID: ${data.contactId || 'N/A'}`);
      console.log(`   Created At: ${createdAt}`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\nTotal: ${snapshot.size} note(s)`);

    if (dryRun) {
      console.log('\n✅ DRY RUN complete - No notes were deleted.');
      console.log('   Remove --dry-run flag to actually delete these notes.');
    } else {
      // Confirm deletion
      console.log('\n⚠️  WARNING: This will permanently delete the above notes!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Delete notes
      const batch = db.batch();
      let deletedCount = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();

      console.log(`\n✅ Successfully deleted ${deletedCount} note(s).`);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('index')) {
      console.error('\n💡 Tip: You may need to create a Firestore index for this query.');
      console.error('   Check the error message for the index creation URL.');
    }
    process.exit(1);
  }
}

deleteNotes().catch(console.error);

