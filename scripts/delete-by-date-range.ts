#!/usr/bin/env tsx
/**
 * Script to delete documents from multiple collections (notes, opportunities, accounts, inboundEmails)
 * based on createdAt timestamp range and optional conditions
 * 
 * Usage:
 *   npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections notes,opportunities
 *   npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections notes --where source==email
 *   npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections opportunities --where routingMethod==metadata
 *   npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections all --where source==email --dry-run
 */

import { db } from './firebase-admin';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as readline from 'readline';

// Parse command line arguments manually (no external dependency)
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {
    from: '',
    to: '',
    collections: 'all',
    where: '',
    dryRun: false,
    limit: '1000',
    yes: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--from' || arg === '-f') {
      options.from = args[++i] || '';
    } else if (arg === '--to' || arg === '-t') {
      options.to = args[++i] || '';
    } else if (arg === '--collections' || arg === '-c') {
      options.collections = args[++i] || 'all';
    } else if (arg === '--where' || arg === '-w') {
      options.where = args[++i] || '';
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = args[++i] || '1000';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run delete:by-date-range -- --from <date> --to <date> [options]

Options:
  -f, --from <date>              Start date (YYYY-MM-DD or ISO format) (required)
  -t, --to <date>                End date (YYYY-MM-DD or ISO format) (required)
  -c, --collections <list>       Comma-separated collections or "all" (default: all)
                                 Valid: notes, opportunities, accounts, emails, inboundEmails
  -w, --where <condition>        Additional where condition (e.g., source==email, routingMethod==metadata)
  -d, --dry-run                  Show what would be deleted without actually deleting
  -l, --limit <number>           Limit results per collection (default: 1000)
  -y, --yes                      Skip confirmation prompt
  -h, --help                     Show this help message

Examples:
  # Dry run: Show all documents from date range
  npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --dry-run

  # Delete notes with source=email from date range
  npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections notes --where source==email

  # Delete opportunities with routingMethod=metadata
  npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections opportunities --where routingMethod==metadata

  # Delete from multiple collections
  npm run delete:by-date-range -- --from "2025-01-01" --to "2025-12-31" --collections notes,opportunities,accounts
`);
      process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();

interface WhereCondition {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=';
  value: any;
}

const VALID_COLLECTIONS = ['notes', 'opportunities', 'accounts', 'inboundEmails', 'emails'];
const COLLECTION_ALIASES: Record<string, string> = {
  'emails': 'inboundEmails',
};

function parseWhereCondition(condition: string): WhereCondition | null {
  if (!condition) return null;
  
  // Support ==, !=, <, <=, >, >=
  const patterns = [
    { regex: /^(.+?)==(.+)$/, operator: '==' as const },
    { regex: /^(.+?)!=(.+)$/, operator: '!=' as const },
    { regex: /^(.+?)<=(.+)$/, operator: '<=' as const },
    { regex: /^(.+?)>=(.+)$/, operator: '>=' as const },
    { regex: /^(.+?)<(.+)$/, operator: '<' as const },
    { regex: /^(.+?)>(.+)$/, operator: '>' as const },
  ];
  
  for (const pattern of patterns) {
    const match = condition.match(pattern.regex);
    if (match) {
      let value: any = match[2].trim();
      
      // Try to convert to number or boolean
      if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
        value = Number(value);
      } else if (value.toLowerCase() === 'true') {
        value = true;
      } else if (value.toLowerCase() === 'false') {
        value = false;
      }
      
      return {
        field: match[1].trim(),
        operator: pattern.operator,
        value,
      };
    }
  }
  
  return null;
}

function parseDate(dateStr: string): Date {
  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or ISO format.`);
}

async function deleteFromCollection(
  db: admin.firestore.Firestore,
  collectionName: string,
  fromDate: Date,
  toDate: Date,
  whereCondition: WhereCondition | null,
  limit: number,
  dryRun: boolean
): Promise<{ count: number; preview: any[]; docs?: admin.firestore.QueryDocumentSnapshot[] }> {
  const collectionRef = db.collection(collectionName);
  
  console.log(`\n🔍 Querying ${collectionName}...`);
  console.log(`   Date range: ${fromDate.toISOString()} to ${toDate.toISOString()}`);
  if (whereCondition) {
    console.log(`   Additional condition: ${whereCondition.field} ${whereCondition.operator} ${JSON.stringify(whereCondition.value)}`);
  }
  
  let snapshot: admin.firestore.QuerySnapshot;
  let docs: admin.firestore.QueryDocumentSnapshot[] = [];
  
  // Try query with all conditions first
  try {
    let query: admin.firestore.Query = collectionRef
      .where('createdAt', '>=', Timestamp.fromDate(fromDate))
      .where('createdAt', '<=', Timestamp.fromDate(toDate));
    
    // Add additional where condition if provided
    if (whereCondition) {
      query = query.where(whereCondition.field, whereCondition.operator, whereCondition.value);
    }
    
    // Add limit
    if (limit > 0) {
      query = query.limit(limit);
    }
    
    snapshot = await query.get();
    docs = snapshot.docs;
  } catch (error: any) {
    // If query fails due to missing index, fall back to filtering in memory
    if (error.message && error.message.includes('index')) {
      console.log(`   ⚠️  Query requires composite index. Falling back to in-memory filtering...`);
      
      try {
        // Query without the additional where condition
        let query: admin.firestore.Query = collectionRef
          .where('createdAt', '>=', Timestamp.fromDate(fromDate))
          .where('createdAt', '<=', Timestamp.fromDate(toDate));
        
        // Get all documents in date range (may be large, but avoids index requirement)
        snapshot = await query.get();
        docs = snapshot.docs;
        
        // Filter in memory by the where condition
        if (whereCondition) {
          docs = docs.filter(doc => {
            const data = doc.data();
            const fieldValue = data[whereCondition.field];
            
            switch (whereCondition.operator) {
              case '==':
                return fieldValue === whereCondition.value;
              case '!=':
                return fieldValue !== whereCondition.value;
              case '<':
                return fieldValue < whereCondition.value;
              case '<=':
                return fieldValue <= whereCondition.value;
              case '>':
                return fieldValue > whereCondition.value;
              case '>=':
                return fieldValue >= whereCondition.value;
              default:
                return false;
            }
          });
          
          // Apply limit after filtering
          if (limit > 0 && docs.length > limit) {
            docs = docs.slice(0, limit);
          }
        }
      } catch (fallbackError: any) {
        console.error(`   ❌ Error with fallback query: ${fallbackError.message}`);
        throw fallbackError;
      }
    } else {
      // Re-throw if it's not an index error
      throw error;
    }
  }
  
  if (docs.length === 0) {
    console.log(`   ✅ No documents found in ${collectionName}`);
    return { count: 0, preview: [] };
  }
  
  console.log(`   📋 Found ${docs.length} document(s) to ${dryRun ? 'show' : 'delete'}`);
  
  // Preview first 5 documents
  const preview = docs.slice(0, 5).map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || 'N/A',
      ...(data.name && { name: data.name }),
      ...(data.subject && { subject: data.subject }),
      ...(data.source && { source: data.source }),
      ...(data.routingMethod && { routingMethod: data.routingMethod }),
    };
  });
  
  // Return docs array for deletion later (only if we need it for in-memory filtering)
  const result: { count: number; preview: any[]; docs?: admin.firestore.QueryDocumentSnapshot[] } = {
    count: docs.length,
    preview,
  };
  
  // Store docs if we did in-memory filtering (so we don't need to re-query)
  if (whereCondition) {
    result.docs = docs;
  }
  
  return result;
}

async function deleteDocuments() {
  if (!options.from || !options.to) {
    console.error('❌ Error: Both --from and --to dates are required');
    console.error('   Use --help to see usage examples');
    process.exit(1);
  }
  
  // db is already initialized from firebase-admin import
  
  // Parse dates
  let fromDate: Date;
  let toDate: Date;
  try {
    fromDate = parseDate(options.from);
    toDate = parseDate(options.to);
    
    // Set toDate to end of day
    toDate.setHours(23, 59, 59, 999);
  } catch (error: any) {
    console.error(`❌ Error parsing dates: ${error.message}`);
    process.exit(1);
  }
  
  // Parse collections
  let collections: string[];
  if (options.collections.toLowerCase() === 'all') {
    // For "all", use the base collections (exclude aliases)
    collections = ['notes', 'opportunities', 'accounts', 'inboundEmails'];
  } else {
    collections = options.collections.split(',').map(c => c.trim());
    // Resolve aliases
    collections = collections.map(c => COLLECTION_ALIASES[c] || c);
    
    // Remove duplicates
    collections = Array.from(new Set(collections));
    
    // Validate collections
    const invalid = collections.filter(c => !VALID_COLLECTIONS.includes(c));
    if (invalid.length > 0) {
      console.error(`❌ Error: Invalid collection(s): ${invalid.join(', ')}`);
      console.error(`   Valid collections: ${VALID_COLLECTIONS.join(', ')}`);
      process.exit(1);
    }
  }
  
  // Parse where condition
  const whereCondition = parseWhereCondition(options.where);
  if (options.where && !whereCondition) {
    console.error(`❌ Error: Invalid where condition format: ${options.where}`);
    console.error('   Use format: field==value, field!=value, field<value, etc.');
    process.exit(1);
  }
  
  const limit = parseInt(options.limit, 10);
  const dryRun = options.dryRun;
  
  console.log('\n📊 DELETE OPERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Date Range: ${fromDate.toISOString()} to ${toDate.toISOString()}`);
  console.log(`Collections: ${collections.join(', ')}`);
  if (whereCondition) {
    console.log(`Additional Condition: ${whereCondition.field} ${whereCondition.operator} ${JSON.stringify(whereCondition.value)}`);
  }
  console.log(`Limit per collection: ${limit > 0 ? limit : 'unlimited'}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletion)' : 'LIVE (will delete)'}`);
  console.log('='.repeat(60));
  
  // Query all collections
  const results: Record<string, { count: number; preview: any[]; docs?: admin.firestore.QueryDocumentSnapshot[] }> = {};
  let totalCount = 0;
  
  for (const collectionName of collections) {
    try {
      const result = await deleteFromCollection(
        db,
        collectionName,
        fromDate,
        toDate,
        whereCondition,
        limit,
        dryRun
      );
      results[collectionName] = result;
      totalCount += result.count;
    } catch (error: any) {
      console.error(`❌ Error querying ${collectionName}: ${error.message}`);
      if (error.message.includes('index')) {
        console.error(`   💡 You may need to create a Firestore index for this query.`);
      }
      results[collectionName] = { count: 0, preview: [] };
    }
  }
  
  // Show summary
  console.log('\n📋 SUMMARY');
  console.log('='.repeat(60));
  for (const [collection, result] of Object.entries(results)) {
    if (result.count > 0) {
      console.log(`\n${collection}: ${result.count} document(s)`);
      if (result.preview.length > 0) {
        console.log('   Preview:');
        result.preview.forEach((doc, idx) => {
          console.log(`   ${idx + 1}. ID: ${doc.id}`);
          Object.entries(doc).filter(([k]) => k !== 'id').forEach(([key, value]) => {
            console.log(`      ${key}: ${value}`);
          });
        });
        if (result.count > result.preview.length) {
          console.log(`   ... and ${result.count - result.preview.length} more`);
        }
      }
    }
  }
  console.log(`\n📊 Total: ${totalCount} document(s) across all collections`);
  console.log('='.repeat(60));
  
  if (dryRun) {
    console.log('\n✅ This was a dry run. No documents were deleted.');
    return;
  }
  
  if (totalCount === 0) {
    console.log('\n✅ No documents to delete.');
    return;
  }
  
  // Confirmation
  if (!options.yes) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise<void>(resolve => {
      rl.question(`\n⚠️  WARNING: This will delete ${totalCount} document(s) from ${collections.length} collection(s). This action cannot be undone!\nType "yes" to confirm deletion: `, async (answer) => {
        if (answer.toLowerCase() !== 'yes') {
          console.log('\n❌ Deletion cancelled.');
          rl.close();
          resolve();
          return;
        }
        
        rl.close();
        console.log('\n⏳ Proceeding with deletion in 5 seconds... Press Ctrl+C to cancel.');
        await new Promise(r => setTimeout(r, 5000));
        resolve();
      });
    });
  }
  
  // Perform deletion
  console.log('\n🗑️  Starting deletion...');
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const collectionName of collections) {
    const result = results[collectionName];
    if (result.count === 0) continue;
    
    try {
      // Use the docs array from the query result if available (for in-memory filtered results)
      // Otherwise, rebuild the query
      let docs: admin.firestore.QueryDocumentSnapshot[];
      
      if (result.docs && result.docs.length > 0) {
        // Use pre-filtered docs from query
        docs = result.docs;
      } else {
        // Rebuild query (should work if no index was needed)
        const collectionRef = db.collection(collectionName);
        let query: admin.firestore.Query = collectionRef
          .where('createdAt', '>=', Timestamp.fromDate(fromDate))
          .where('createdAt', '<=', Timestamp.fromDate(toDate));
        
        if (whereCondition) {
          query = query.where(whereCondition.field, whereCondition.operator, whereCondition.value);
        }
        
        if (limit > 0) {
          query = query.limit(limit);
        }
        
        const snapshot = await query.get();
        docs = snapshot.docs;
      }
      
      // Delete in batches (Firestore batch limit is 500)
      const batchSize = 500;
      
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = docs.slice(i, i + batchSize);
        
        for (const doc of batchDocs) {
          batch.delete(doc.ref);
        }
        
        await batch.commit();
        deletedCount += batchDocs.length;
        console.log(`   ✅ Deleted ${batchDocs.length} document(s) from ${collectionName} (${deletedCount}/${totalCount})`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error deleting from ${collectionName}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (errorCount === 0) {
    console.log(`✅ Successfully deleted ${deletedCount} document(s) from ${collections.length} collection(s).`);
  } else {
    console.log(`⚠️  Deleted ${deletedCount} document(s), but encountered ${errorCount} error(s).`);
  }
  console.log('='.repeat(60));
}

deleteDocuments().catch(console.error);

