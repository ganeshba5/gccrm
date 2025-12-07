#!/usr/bin/env tsx
/**
 * Interactive Firestore Query CLI
 * 
 * Usage:
 *   npx tsx scripts/firestore-query.ts
 *   npm run query:firestore
 * 
 * Examples:
 *   # Query notes collection
 *   > collection: notes
 *   > where: source == email
 *   > limit: 10
 *   > run
 * 
 *   # Query opportunities
 *   > collection: opportunities
 *   > where: accountId == abc123
 *   > orderBy: createdAt desc
 *   > limit: 20
 *   > run
 */

import 'dotenv/config';
import { db } from './firebase-admin';
import * as readline from 'readline';
import { Timestamp } from 'firebase-admin/firestore';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

interface QueryBuilder {
  collection: string;
  whereClauses: Array<{ field: string; operator: string; value: any }>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

let queryBuilder: QueryBuilder = {
  collection: '',
  whereClauses: [],
};

function showHelp() {
  console.log(`
📋 Firestore Query CLI

Commands:
  collection: <name>     Set collection name (e.g., notes, opportunities, accounts)
  where: <field> <op> <value>  Add where clause (e.g., "source == email")
  orderBy: <field> [asc|desc]  Add ordering (e.g., "createdAt desc")
  limit: <number>        Set result limit (default: 50)
  clear                 Clear current query
  show                   Show current query
  run                    Execute query (read only)
  delete                 Delete documents matching current query
  help                   Show this help
  exit                   Exit CLI

Operators: ==, !=, <, <=, >, >=, array-contains, in

Examples:
  > collection: notes
  > where: source == email
  > limit: 10
  > run

  > collection: opportunities
  > where: accountId == abc123
  > orderBy: createdAt desc
  > run

  # Delete documents (shows preview first)
  > collection: notes
  > where: source == email
  > delete
`);
}

function parseWhereClause(input: string): { field: string; operator: string; value: any } | null {
  // Parse: "field == value" or "field != value" etc.
  const match = input.match(/^(\w+)\s*(==|!=|<|<=|>|>=|array-contains|in)\s*(.+)$/);
  if (!match) return null;

  const [, field, operator, valueStr] = match;
  let value: any = valueStr.trim();

  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  // Convert to number if numeric
  if (!isNaN(Number(value)) && value !== '') {
    value = Number(value);
  }

  // Convert to boolean
  if (value === 'true') value = true;
  if (value === 'false') value = false;

  // Convert date strings to Timestamp
  if (value.includes('-') && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    value = Timestamp.fromDate(new Date(value));
  }

  return { field, operator, value };
}

function showQuery() {
  console.log('\n📋 Current Query:');
  console.log(`   Collection: ${queryBuilder.collection || '(not set)'}`);
  if (queryBuilder.whereClauses.length > 0) {
    console.log('   Where:');
    queryBuilder.whereClauses.forEach((clause, i) => {
      console.log(`     ${i + 1}. ${clause.field} ${clause.operator} ${clause.value}`);
    });
  }
  if (queryBuilder.orderBy) {
    console.log(`   Order By: ${queryBuilder.orderBy.field} ${queryBuilder.orderBy.direction}`);
  }
  console.log(`   Limit: ${queryBuilder.limit || 50}`);
  console.log();
}

async function buildQuery() {
  if (!queryBuilder.collection) {
    throw new Error('Collection not set');
  }

  let query: any = db.collection(queryBuilder.collection);

  // Apply where clauses
  for (const clause of queryBuilder.whereClauses) {
    switch (clause.operator) {
      case '==':
        query = query.where(clause.field, '==', clause.value);
        break;
      case '!=':
        query = query.where(clause.field, '!=', clause.value);
        break;
      case '<':
        query = query.where(clause.field, '<', clause.value);
        break;
      case '<=':
        query = query.where(clause.field, '<=', clause.value);
        break;
      case '>':
        query = query.where(clause.field, '>', clause.value);
        break;
      case '>=':
        query = query.where(clause.field, '>=', clause.value);
        break;
      case 'array-contains':
        query = query.where(clause.field, 'array-contains', clause.value);
        break;
      case 'in':
        const values = Array.isArray(clause.value) ? clause.value : [clause.value];
        query = query.where(clause.field, 'in', values);
        break;
      default:
        throw new Error(`Unsupported operator: ${clause.operator}`);
    }
  }

  // Apply orderBy
  if (queryBuilder.orderBy) {
    query = query.orderBy(
      queryBuilder.orderBy.field,
      queryBuilder.orderBy.direction
    );
  }

  // Apply limit
  const limit = queryBuilder.limit || 50;
  query = query.limit(limit);

  return query;
}

async function runQuery() {
  if (!queryBuilder.collection) {
    console.log('❌ Error: Collection not set. Use "collection: <name>" first.');
    return;
  }

  try {
    console.log('\n🔍 Executing query...\n');

    const query = await buildQuery();
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('✅ No documents found.\n');
      return;
    }

    console.log(`📊 Found ${snapshot.size} document(s):\n`);
    console.log('─'.repeat(80));

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Document ID: ${doc.id}`);
      
      // Show key fields
      const keys = Object.keys(data).slice(0, 10); // Show first 10 fields
      keys.forEach(key => {
        let value = data[key];
        
        // Format timestamps
        if (value && typeof value === 'object' && 'toDate' in value) {
          value = value.toDate().toLocaleString();
        } else if (value && typeof value === 'object' && 'seconds' in value) {
          value = new Date(value.seconds * 1000).toLocaleString();
        } else if (typeof value === 'string' && value.length > 100) {
          value = value.substring(0, 100) + '...';
        } else if (typeof value === 'object') {
          value = JSON.stringify(value).substring(0, 100);
        }
        
        console.log(`   ${key}: ${value}`);
      });
      
      if (Object.keys(data).length > 10) {
        console.log(`   ... (${Object.keys(data).length - 10} more fields)`);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n✅ Query complete. Found ${snapshot.size} document(s).\n`);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('index')) {
      console.error('\n💡 Tip: You may need to create a Firestore index for this query.');
      console.error('   Check the error message for the index creation URL.');
    }
    console.log();
  }
}

async function deleteDocuments() {
  if (!queryBuilder.collection) {
    console.log('❌ Error: Collection not set. Use "collection: <name>" first.');
    return;
  }

  try {
    console.log('\n🔍 Finding documents to delete...\n');

    const query = await buildQuery();
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('✅ No documents found matching the criteria.\n');
      return;
    }

    console.log(`⚠️  WARNING: This will delete ${snapshot.size} document(s) from "${queryBuilder.collection}" collection!\n`);
    console.log('📋 Documents to be deleted:\n');
    console.log('─'.repeat(80));

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Document ID: ${doc.id}`);
      
      // Show key fields
      const keys = Object.keys(data).slice(0, 5);
      keys.forEach(key => {
        let value = data[key];
        if (value && typeof value === 'object' && 'toDate' in value) {
          value = value.toDate().toLocaleString();
        } else if (value && typeof value === 'object' && 'seconds' in value) {
          value = new Date(value.seconds * 1000).toLocaleString();
        } else if (typeof value === 'string' && value.length > 50) {
          value = value.substring(0, 50) + '...';
        }
        console.log(`   ${key}: ${value}`);
      });
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n⚠️  This action cannot be undone!`);
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete in batches (Firestore batch limit is 500)
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const docsBatch = snapshot.docs.slice(i, i + batchSize);

      docsBatch.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
      console.log(`   Deleted batch: ${deletedCount}/${snapshot.size}...`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} document(s) from "${queryBuilder.collection}" collection.\n`);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('index')) {
      console.error('\n💡 Tip: You may need to create a Firestore index for this query.');
      console.error('   Check the error message for the index creation URL.');
    }
    console.log();
  }
}

function processCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const [command, ...args] = trimmed.split(':').map(s => s.trim());
  const fullCommand = trimmed.toLowerCase();

  if (fullCommand === 'help' || fullCommand === 'h') {
    showHelp();
  } else if (fullCommand === 'exit' || fullCommand === 'quit' || fullCommand === 'q') {
    console.log('\n👋 Goodbye!\n');
    rl.close();
    process.exit(0);
  } else if (fullCommand === 'clear') {
    queryBuilder = { collection: '', whereClauses: [] };
    console.log('✅ Query cleared.\n');
  } else if (fullCommand === 'show') {
    showQuery();
  } else if (fullCommand === 'run' || fullCommand === 'r') {
    runQuery();
  } else if (fullCommand === 'delete' || fullCommand === 'del' || fullCommand === 'd') {
    deleteDocuments();
  } else if (command === 'collection') {
    queryBuilder.collection = args.join(':').trim();
    console.log(`✅ Collection set to: ${queryBuilder.collection}\n`);
  } else if (command === 'where') {
    const whereInput = args.join(':').trim();
    const clause = parseWhereClause(whereInput);
    if (clause) {
      queryBuilder.whereClauses.push(clause);
      console.log(`✅ Added where clause: ${clause.field} ${clause.operator} ${clause.value}\n`);
    } else {
      console.log('❌ Invalid where clause format. Use: "field operator value"');
      console.log('   Example: "source == email" or "createdAt > 2024-01-01"\n');
    }
  } else if (command === 'orderby' || command === 'order') {
    const orderInput = args.join(':').trim();
    const parts = orderInput.split(/\s+/);
    if (parts.length >= 1) {
      const field = parts[0];
      const direction = (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
      queryBuilder.orderBy = { field, direction };
      console.log(`✅ Order by: ${field} ${direction}\n`);
    } else {
      console.log('❌ Invalid orderBy format. Use: "field [asc|desc]"');
      console.log('   Example: "createdAt desc"\n');
    }
  } else if (command === 'limit') {
    const limitValue = parseInt(args.join(':').trim(), 10);
    if (!isNaN(limitValue) && limitValue > 0) {
      queryBuilder.limit = limitValue;
      console.log(`✅ Limit set to: ${limitValue}\n`);
    } else {
      console.log('❌ Invalid limit. Must be a positive number.\n');
    }
  } else {
    console.log(`❌ Unknown command: "${trimmed}"`);
    console.log('   Type "help" for available commands.\n');
  }
}

console.log('\n🔥 Firestore Query CLI');
console.log('   Type "help" for commands, "exit" to quit\n');
showQuery();

rl.prompt();

rl.on('line', (input) => {
  processCommand(input);
  rl.prompt();
}).on('close', () => {
  console.log('\n👋 Goodbye!\n');
  process.exit(0);
});

