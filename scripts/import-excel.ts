/**
 * Import data from Excel workbook to Firestore
 * 
 * Usage:
 *   npx tsx scripts/import-excel.ts [excel-file-path]
 * 
 * Example:
 *   npx tsx scripts/import-excel.ts "data/Salesforce pipeline May 17 2023.xlsx"
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';

interface ExcelRow {
  [key: string]: any;
}

interface ImportedAccount {
  name: string;
  website?: string;
  industry?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive' | 'prospect';
  description?: string;
  assignedTo?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ImportedOpportunity {
  name: string;
  accountId?: string;
  amount?: number;
  stage: 'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  probability?: number;
  expectedCloseDate?: Timestamp;
  description?: string;
  owner: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Column mapping - adjust these based on your Excel file structure
const COLUMN_MAPPING = {
  // Account fields
  accountName: ['Account Name', 'Account', 'Company', 'Company Name', 'Customer Name'],
  accountWebsite: ['Website', 'Account Website', 'Company Website'],
  accountIndustry: ['Industry', 'Account Industry'],
  accountPhone: ['Phone', 'Account Phone', 'Company Phone'],
  accountEmail: ['Email', 'Account Email', 'Company Email'],
  
  // Opportunity fields
  opportunityName: ['Opportunity Name', 'Opportunity', 'Deal Name', 'Name', 'Title'],
  amount: ['Amount', 'Value', 'Deal Amount', 'Revenue', 'Sales Amount'],
  stage: ['Stage', 'Status', 'Sales Stage', 'Opportunity Stage'],
  probability: ['Probability', 'Win Probability', '%'],
  closeDate: ['Close Date', 'Expected Close Date', 'Close', 'Expected Close'],
  description: ['Description', 'Notes', 'Comments'],
  
  // Owner/Assigned fields
  owner: ['Owner', 'Assigned To', 'Sales Rep', 'Account Owner', 'Opportunity Owner'],
};

function findColumnValue(row: ExcelRow, possibleNames: string[]): any {
  for (const name of possibleNames) {
    // Try exact match
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
    // Try case-insensitive match
    const found = Object.keys(row).find(key => 
      key.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }
  return null;
}

function parseAmount(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  
  // Handle string values like "$1,234.56" or "1234.56"
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  // Handle number values
  if (typeof value === 'number') {
    return value;
  }
  
  return undefined;
}

function parseProbability(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : Math.min(100, Math.max(0, parsed));
  }
  
  if (typeof value === 'number') {
    return Math.min(100, Math.max(0, value));
  }
  
  return undefined;
}

function parseStage(value: any): 'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost' {
  if (!value) return 'New';
  
  const stageStr = String(value).toLowerCase().trim();
  
  // Map common stage names to our stages
  if (stageStr.includes('new') || stageStr.includes('lead') || stageStr.includes('prospect')) {
    return 'New';
  }
  if (stageStr.includes('qualified') || stageStr.includes('qualify') || stageStr.includes('qualification')) {
    return 'Qualified';
  }
  if (stageStr.includes('proposal') || stageStr.includes('quote') || stageStr.includes('quoting')) {
    return 'Proposal';
  }
  if (stageStr.includes('negotiation') || stageStr.includes('negotiate')) {
    return 'Negotiation';
  }
  if (stageStr.includes('won') || stageStr.includes('closed won') || stageStr.includes('closed-won')) {
    return 'Closed Won';
  }
  if (stageStr.includes('lost') || stageStr.includes('closed lost') || stageStr.includes('closed-lost')) {
    return 'Closed Lost';
  }
  
  return 'New';
}

function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  
  // Handle Excel date serial numbers
  if (typeof value === 'number') {
    // Excel dates are days since 1900-01-01
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? undefined : date;
  }
  
  // Handle string dates
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  
  return undefined;
}

async function importExcel(filePath: string, defaultOwnerId: string = 'system') {
  console.log(`\n📊 Reading Excel file: ${filePath}\n`);
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  
  // Get the first sheet (or you can specify a sheet name)
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log(`📄 Processing sheet: "${sheetName}"`);
  
  // Convert to JSON
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📋 Found ${rows.length} rows\n`);
  
  if (rows.length === 0) {
    console.log('❌ No data found in Excel file');
    return;
  }
  
  // Show first row to help with column mapping
  console.log('📝 Sample row (first row):');
  console.log(JSON.stringify(rows[0], null, 2));
  console.log('\n');
  
  // Create accounts map to avoid duplicates
  const accountsMap = new Map<string, { id: string; data: ImportedAccount }>();
  const opportunities: ImportedOpportunity[] = [];
  
  const now = Timestamp.now();
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // Extract account information
      const accountName = findColumnValue(row, COLUMN_MAPPING.accountName);
      if (!accountName) {
        console.log(`⚠️  Row ${i + 1}: Skipping - no account name found`);
        continue;
      }
      
      // Create or get account
      let accountId: string;
      const accountKey = String(accountName).toLowerCase().trim();
      
      if (!accountsMap.has(accountKey)) {
        const accountData: any = {
          name: String(accountName),
          status: 'prospect' as const,
          createdAt: now,
          updatedAt: now,
        };
        
        // Only add optional fields if they have values
        const website = findColumnValue(row, COLUMN_MAPPING.accountWebsite);
        if (website) accountData.website = String(website);
        
        const industry = findColumnValue(row, COLUMN_MAPPING.accountIndustry);
        if (industry) accountData.industry = String(industry);
        
        const phone = findColumnValue(row, COLUMN_MAPPING.accountPhone);
        if (phone) accountData.phone = String(phone);
        
        const email = findColumnValue(row, COLUMN_MAPPING.accountEmail);
        if (email) accountData.email = String(email);
        
        const description = findColumnValue(row, COLUMN_MAPPING.description);
        if (description) accountData.description = String(description);
        
        const assignedTo = findColumnValue(row, COLUMN_MAPPING.owner);
        if (assignedTo) accountData.assignedTo = String(assignedTo);
        
        accountsMap.set(accountKey, { id: '', data: accountData });
      }
      
      // Extract opportunity information
      const opportunityName = findColumnValue(row, COLUMN_MAPPING.opportunityName) || accountName;
      const amount = parseAmount(findColumnValue(row, COLUMN_MAPPING.amount));
      const stage = parseStage(findColumnValue(row, COLUMN_MAPPING.stage));
      const probability = parseProbability(findColumnValue(row, COLUMN_MAPPING.probability));
      const closeDate = parseDate(findColumnValue(row, COLUMN_MAPPING.closeDate));
      const owner = findColumnValue(row, COLUMN_MAPPING.owner) || defaultOwnerId;
      
      const opportunityData: any = {
        name: String(opportunityName),
        stage,
        owner: String(owner),
        createdAt: now,
        updatedAt: now,
      };
      
      // Only add optional fields if they have values
      if (amount !== undefined) opportunityData.amount = amount;
      if (probability !== undefined) opportunityData.probability = probability;
      if (closeDate) opportunityData.expectedCloseDate = Timestamp.fromDate(closeDate);
      
      const description = findColumnValue(row, COLUMN_MAPPING.description);
      if (description) opportunityData.description = String(description);
      
      opportunities.push(opportunityData);
      
    } catch (error: any) {
      console.error(`❌ Error processing row ${i + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Processed ${rows.length} rows`);
  console.log(`   📦 Accounts to create: ${accountsMap.size}`);
  console.log(`   💼 Opportunities to create: ${opportunities.length}\n`);
  
  // Import accounts
  console.log('📤 Importing accounts...');
  const accountRefs = db.collection('accounts');
  let accountsCreated = 0;
  
  for (const [key, accountInfo] of accountsMap.entries()) {
    try {
      const docRef = await accountRefs.add(accountInfo.data);
      accountInfo.id = docRef.id;
      accountsCreated++;
      if (accountsCreated % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error: any) {
      console.error(`\n❌ Error creating account "${accountInfo.data.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${accountsCreated} accounts\n`);
  
  // Import opportunities (link to accounts)
  console.log('📤 Importing opportunities...');
  const opportunityRefs = db.collection('opportunities');
  let opportunitiesCreated = 0;
  
  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    const row = rows[i];
    
    try {
      // Find the account ID for this opportunity
      const accountName = findColumnValue(row, COLUMN_MAPPING.accountName);
      if (accountName) {
        const accountKey = String(accountName).toLowerCase().trim();
        const accountInfo = accountsMap.get(accountKey);
        if (accountInfo && accountInfo.id) {
          opp.accountId = accountInfo.id;
        }
      }
      
      await opportunityRefs.add(opp);
      opportunitiesCreated++;
      if (opportunitiesCreated % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error: any) {
      console.error(`\n❌ Error creating opportunity "${opp.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${opportunitiesCreated} opportunities\n`);
  
  console.log('\n🎉 Import complete!');
  console.log(`   📦 Accounts: ${accountsCreated}`);
  console.log(`   💼 Opportunities: ${opportunitiesCreated}\n`);
}

// Main execution
const filePath = process.argv[2] || join(process.cwd(), 'data', 'Salesforce pipeline May 17 2023.xlsx');
const defaultOwnerId = process.argv[3] || 'system';

if (!existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

importExcel(filePath, defaultOwnerId)
  .then(() => {
    console.log('\n✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

