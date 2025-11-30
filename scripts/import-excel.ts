/**
 * Import data from Excel workbook to Firestore
 * 
 * Usage:
 *   npx tsx scripts/import-excel.ts [excel-file-path]
 * 
 * Example:
 *   npx tsx scripts/import-excel.ts "data/Opportunities 03-12-2024.xlsx"
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import bcrypt from 'bcryptjs';

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
  createdBy?: string;
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
  closeDate: ['Close Date', 'Expected Close Date', 'Close', 'Expected Close', 'Created Date'],
  description: ['Description', 'Notes', 'Comments'],
  nextStep: ['Next Step', 'Next Steps', 'Next Action', 'Action Item'],
  createdDate: ['Created Date', 'Created', 'Date Created', 'Creation Date'],
  
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

/**
 * Find existing opportunity by name (case-insensitive)
 */
async function findOpportunityByName(name: string): Promise<string | null> {
  try {
    const opportunitiesRef = db.collection('opportunities');
    const snapshot = await opportunitiesRef.where('name', '==', name).get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error finding opportunity "${name}":`, error);
    return null;
  }
}

/**
 * Find or create user by owner name/email
 * Returns user ID
 */
async function findOrCreateUser(ownerName: string): Promise<string> {
  try {
    const usersRef = db.collection('users');
    
    // Try to find by email first (if ownerName looks like an email)
    if (ownerName.includes('@')) {
      const emailSnapshot = await usersRef.where('email', '==', ownerName.toLowerCase().trim()).get();
      if (!emailSnapshot.empty) {
        return emailSnapshot.docs[0].id;
      }
    }
    
    // Try to find by displayName or firstName/lastName
    const allUsersSnapshot = await usersRef.get();
    for (const doc of allUsersSnapshot.docs) {
      const userData = doc.data();
      const displayName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      if (displayName.toLowerCase().trim() === ownerName.toLowerCase().trim()) {
        return doc.id;
      }
    }
    
    // User doesn't exist, create one
    console.log(`   Creating user for owner: ${ownerName}`);
    
    // Parse name into first and last name
    let firstName = '';
    let lastName = '';
    let displayName = ownerName;
    
    if (ownerName.includes(' ')) {
      const parts = ownerName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '';
      displayName = ownerName;
    } else if (ownerName.includes('.')) {
      const parts = ownerName.split('.');
      firstName = parts[0];
      lastName = parts.slice(1).join('.') || '';
      displayName = `${firstName} ${lastName}`;
    } else if (ownerName.includes('_')) {
      const parts = ownerName.split('_');
      firstName = parts[0];
      lastName = parts.slice(1).join('_') || '';
      displayName = `${firstName} ${lastName}`;
    } else {
      firstName = ownerName;
      lastName = '';
      displayName = ownerName;
    }
    
    // Generate email
    let email = '';
    if (ownerName.includes('@')) {
      email = ownerName.toLowerCase().trim();
    } else {
      const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase() || 'user'}`;
      email = `${emailBase}@infoglobaltech.com`;
      
      // Check if email already exists
      const existingEmails = new Set<string>();
      allUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          existingEmails.add(userData.email.toLowerCase());
        }
      });
      
      let emailCounter = 1;
      while (existingEmails.has(email.toLowerCase())) {
        email = `${emailBase}${emailCounter}@infoglobaltech.com`;
        emailCounter++;
      }
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash('Welcome@123', 10);
    const now = Timestamp.now();
    const userData = {
      email: email.toLowerCase(),
      displayName: displayName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      role: 'sales_rep',
      isActive: true,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await usersRef.add(userData);
    console.log(`   ✅ Created user: ${email} (${displayName})`);
    return docRef.id;
  } catch (error: any) {
    console.error(`Error finding/creating user for "${ownerName}":`, error.message);
    // Return a default system user ID if creation fails
    return 'system';
  }
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
  const opportunities: Array<ImportedOpportunity & { rowIndex: number; nextStep?: string; nextStepDate?: Date }> = [];
  
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
      const nextStep = findColumnValue(row, COLUMN_MAPPING.nextStep);
      const nextStepDate = parseDate(findColumnValue(row, COLUMN_MAPPING.createdDate));
      
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
      
      opportunities.push({
        ...opportunityData,
        rowIndex: i,
        nextStep: nextStep ? String(nextStep) : undefined,
        nextStepDate: nextStepDate,
      });
      
    } catch (error: any) {
      console.error(`❌ Error processing row ${i + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Processed ${rows.length} rows`);
  console.log(`   📦 Accounts to create: ${accountsMap.size}`);
  console.log(`   💼 Opportunities to process: ${opportunities.length}\n`);
  
  // Import accounts
  console.log('📤 Importing accounts...');
  const accountRefs = db.collection('accounts');
  let accountsCreated = 0;
  
  for (const [key, accountInfo] of accountsMap.entries()) {
    try {
      // Check if account already exists
      const existingSnapshot = await accountRefs.where('name', '==', accountInfo.data.name).get();
      if (!existingSnapshot.empty) {
        accountInfo.id = existingSnapshot.docs[0].id;
        // Update existing account
        await accountRefs.doc(accountInfo.id).update({
          ...accountInfo.data,
          updatedAt: now,
        });
      } else {
        const docRef = await accountRefs.add(accountInfo.data);
        accountInfo.id = docRef.id;
        accountsCreated++;
      }
      if (accountsCreated % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error: any) {
      console.error(`\n❌ Error creating/updating account "${accountInfo.data.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Processed ${accountsMap.size} accounts (${accountsCreated} created)\n`);
  
  // Import opportunities (link to accounts and update/create)
  console.log('📤 Importing opportunities...');
  const opportunityRefs = db.collection('opportunities');
  const notesRef = db.collection('notes');
  let opportunitiesCreated = 0;
  let opportunitiesUpdated = 0;
  let notesCreated = 0;
  
  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    const row = rows[opp.rowIndex];
    
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
      
      // Find or create user for owner
      const ownerUserId = await findOrCreateUser(opp.owner);
      opp.owner = ownerUserId;
      if (!opp.createdBy) {
        opp.createdBy = ownerUserId;
      }
      
      // Extract nextStep data before saving opportunity (not part of opportunity schema)
      const nextStep = opp.nextStep;
      const nextStepDate = opp.nextStepDate;
      
      // Remove nextStep and nextStepDate from opportunity data
      const { nextStep: _, nextStepDate: __, rowIndex: ___, ...opportunityData } = opp;
      
      // Check if opportunity already exists
      const existingOppId = await findOpportunityByName(opp.name);
      
      let opportunityId: string;
      if (existingOppId) {
        // Update existing opportunity
        const updateData: any = {
          updatedAt: now,
        };
        
        if (opportunityData.accountId !== undefined) updateData.accountId = opportunityData.accountId;
        if (opportunityData.amount !== undefined) updateData.amount = opportunityData.amount;
        if (opportunityData.stage !== undefined) updateData.stage = opportunityData.stage;
        if (opportunityData.probability !== undefined) updateData.probability = opportunityData.probability;
        if (opportunityData.expectedCloseDate !== undefined) updateData.expectedCloseDate = opportunityData.expectedCloseDate;
        if (opportunityData.description !== undefined) updateData.description = opportunityData.description;
        if (opportunityData.owner !== undefined) updateData.owner = opportunityData.owner;
        
        await opportunityRefs.doc(existingOppId).update(updateData);
        opportunityId = existingOppId;
        opportunitiesUpdated++;
      } else {
        // Create new opportunity (remove undefined fields)
        const cleanOpportunityData: any = {
          name: opportunityData.name,
          stage: opportunityData.stage,
          owner: opportunityData.owner,
          createdAt: opportunityData.createdAt,
          updatedAt: opportunityData.updatedAt,
        };
        
        if (opportunityData.accountId) cleanOpportunityData.accountId = opportunityData.accountId;
        if (opportunityData.amount !== undefined) cleanOpportunityData.amount = opportunityData.amount;
        if (opportunityData.probability !== undefined) cleanOpportunityData.probability = opportunityData.probability;
        if (opportunityData.expectedCloseDate) cleanOpportunityData.expectedCloseDate = opportunityData.expectedCloseDate;
        if (opportunityData.description) cleanOpportunityData.description = opportunityData.description;
        if (opportunityData.createdBy) cleanOpportunityData.createdBy = opportunityData.createdBy;
        
        const docRef = await opportunityRefs.add(cleanOpportunityData);
        opportunityId = docRef.id;
        opportunitiesCreated++;
      }
      
      // Create note from Next Step if it exists
      if (nextStep) {
        const noteContent = `Next Step: ${nextStep}`;
        const noteCreatedDate = nextStepDate ? Timestamp.fromDate(nextStepDate) : now;
        
        const noteData = {
          content: noteContent,
          opportunityId: opportunityId,
          isPrivate: false, // Public note
          createdBy: opportunityData.owner || ownerUserId,
          createdAt: noteCreatedDate,
          updatedAt: noteCreatedDate,
        };
        
        await notesRef.add(noteData);
        notesCreated++;
      }
      
      if ((opportunitiesCreated + opportunitiesUpdated) % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error: any) {
      console.error(`\n❌ Error processing opportunity "${opp.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Processed ${opportunities.length} opportunities`);
  console.log(`   Created: ${opportunitiesCreated}`);
  console.log(`   Updated: ${opportunitiesUpdated}`);
  console.log(`   Notes created: ${notesCreated}\n`);
  
  console.log('\n🎉 Import complete!');
  console.log(`   📦 Accounts: ${accountsMap.size}`);
  console.log(`   💼 Opportunities: ${opportunitiesCreated} created, ${opportunitiesUpdated} updated`);
  console.log(`   📝 Notes: ${notesCreated} created\n`);
}

// Main execution
const filePath = process.argv[2] || join(process.cwd(), 'data', 'Opportunities 03-12-2024.xlsx');
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
