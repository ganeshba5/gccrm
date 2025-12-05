/**
 * Import Accounts, Contacts, and Opportunities from DemandFactor CSV file
 * 
 * Usage:
 *   npx tsx scripts/import-demandfactor-csv.ts [csv-file-path]
 * 
 * Example:
 *   npx tsx scripts/import-demandfactor-csv.ts "data/InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv"
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';

interface SharedUser {
  userId: string;
  permission: 'view' | 'edit';
}

interface CSVRow {
  'First Name': string;
  'Last Name': string;
  'Email': string;
  'Phone Number': string;
  'Title': string;
  'Company': string;
  'Company Size': string;
  'Company Revenue ': string;
  'Country': string;
  'Industry': string;
  'LinkedIN': string;
  'Content Downloaded': string;
  'CQ 1 response': string;
  'CQ 2 response': string;
  'CQ 3 response': string;
}

/**
 * Find user by name (displayName, firstName/lastName, or email)
 * Returns user ID or null
 */
async function findUserByName(userName: string): Promise<string | null> {
  try {
    const usersRef = db.collection('users');
    const allUsersSnapshot = await usersRef.get();
    
    for (const doc of allUsersSnapshot.docs) {
      const userData = doc.data();
      const displayName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      const email = userData.email || '';
      
      // Try exact match
      if (displayName.toLowerCase().trim() === userName.toLowerCase().trim()) {
        return doc.id;
      }
      
      // Try partial match (e.g., "Ganesh B" matches "Ganesh" or contains "Ganesh")
      const nameParts = userName.toLowerCase().trim().split(/\s+/);
      const displayNameLower = displayName.toLowerCase();
      if (nameParts.every(part => displayNameLower.includes(part))) {
        return doc.id;
      }
      
      // Try email match
      if (email && email.toLowerCase().includes(userName.toLowerCase().trim())) {
        return doc.id;
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`Error finding user "${userName}":`, error.message);
    return null;
  }
}

/**
 * Find or get admin user for createdBy
 */
async function getAdminUser(): Promise<string> {
  try {
    const usersRef = db.collection('users');
    const adminSnapshot = await usersRef.where('role', '==', 'admin').where('isActive', '==', true).limit(1).get();
    
    if (!adminSnapshot.empty) {
      return adminSnapshot.docs[0].id;
    }
    
    // If no admin, get first active user
    const activeSnapshot = await usersRef.where('isActive', '==', true).limit(1).get();
    if (!activeSnapshot.empty) {
      return activeSnapshot.docs[0].id;
    }
    
    throw new Error('No active users found');
  } catch (error: any) {
    console.error('Error getting admin user:', error.message);
    throw error;
  }
}

/**
 * Find or create account by name
 * Returns { accountId, wasCreated }
 */
async function findOrCreateAccount(
  accountName: string,
  createdBy: string,
  industry?: string,
  country?: string,
  companySize?: string,
  companyRevenue?: string
): Promise<{ accountId: string; wasCreated: boolean }> {
  try {
    const accountsRef = db.collection('accounts');
    
    // Try to find existing account (case-insensitive)
    const allAccountsSnapshot = await accountsRef.get();
    for (const doc of allAccountsSnapshot.docs) {
      const accountData = doc.data();
      if (accountData.name && accountData.name.toLowerCase().trim() === accountName.toLowerCase().trim()) {
        return { accountId: doc.id, wasCreated: false };
      }
    }
    
    // Account doesn't exist, create one
    const now = Timestamp.now();
    const accountData: any = {
      name: accountName.trim(),
      status: 'prospect',
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    if (industry) accountData.industry = industry.trim();
    if (country) {
      accountData.billingAddress = { country: country.trim() };
      accountData.shippingAddress = { country: country.trim() };
    }
    if (companySize || companyRevenue) {
      let description = '';
      if (companySize) description += `Company Size: ${companySize.trim()}\n`;
      if (companyRevenue) description += `Company Revenue: ${companyRevenue.trim()}\n`;
      accountData.description = description.trim();
    }
    
    const docRef = await accountsRef.add(accountData);
    return { accountId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating account "${accountName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create contact
 * Returns { contactId, wasCreated }
 */
async function findOrCreateContact(
  firstName: string,
  lastName: string,
  accountId: string,
  email?: string,
  phone?: string,
  title?: string,
  createdBy: string
): Promise<{ contactId: string; wasCreated: boolean }> {
  try {
    const contactsRef = db.collection('contacts');
    
    // Try to find existing contact by email (if provided) or by name + account
    if (email) {
      const emailQuery = await contactsRef
        .where('accountId', '==', accountId)
        .where('email', '==', email.trim().toLowerCase())
        .limit(1)
        .get();
      
      if (!emailQuery.empty) {
        return { contactId: emailQuery.docs[0].id, wasCreated: false };
      }
    }
    
    // Try to find by name + account
    const nameQuery = await contactsRef
      .where('accountId', '==', accountId)
      .where('firstName', '==', firstName.trim())
      .where('lastName', '==', lastName.trim())
      .limit(1)
      .get();
    
    if (!nameQuery.empty) {
      return { contactId: nameQuery.docs[0].id, wasCreated: false };
    }
    
    // Contact doesn't exist, create one
    const now = Timestamp.now();
    
    const contactData: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      accountId: accountId,
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    if (email) contactData.email = email.trim();
    if (phone) contactData.phone = phone.trim();
    if (title) contactData.title = title.trim();
    
    const docRef = await contactsRef.add(contactData);
    return { contactId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating contact "${firstName} ${lastName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create task for opportunity
 * Returns { taskId, wasCreated }
 */
async function findOrCreateTaskForOpportunity(
  opportunityId: string,
  contactId: string,
  accountId: string,
  contactName: string,
  createdByUserIds: string[]
): Promise<{ taskId: string; wasCreated: boolean }> {
  try {
    const tasksRef = db.collection('tasks');
    const taskTitle = `Contact ${contactName}`;
    
    // Try to find existing task by opportunity and title
    const existingQuery = await tasksRef
      .where('opportunityId', '==', opportunityId)
      .where('title', '==', taskTitle)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      return { taskId: existingQuery.docs[0].id, wasCreated: false };
    }
    
    const now = Timestamp.now();
    
    // Randomly select priority
    const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    // Randomly select status
    const statuses: ('not_started' | 'in_progress' | 'completed' | 'cancelled')[] = [
      'not_started',
      'in_progress',
      'completed',
      'cancelled'
    ];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Randomly select createdBy from the provided user IDs
    const createdBy = createdByUserIds[Math.floor(Math.random() * createdByUserIds.length)];
    
    // Set due date to 12/15/2025
    const dueDate = new Date('2025-12-15');
    dueDate.setHours(23, 59, 59, 999); // End of day
    
    const taskData: any = {
      title: taskTitle,
      description: `Lead from DemandFactor. Contact ${contactName} regarding the opportunity.`,
      status: status,
      priority: priority,
      dueDate: Timestamp.fromDate(dueDate),
      accountId: accountId,
      contactId: contactId,
      opportunityId: opportunityId,
      // assignedTo is undefined (unassigned)
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    // If status is completed, set completedAt
    if (status === 'completed') {
      taskData.completedAt = now;
    }
    
    const docRef = await tasksRef.add(taskData);
    return { taskId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating task:`, error.message);
    throw error;
  }
}

/**
 * Build opportunity description with new format
 */
function buildOpportunityDescription(
  company: string,
  companySize: string | undefined,
  companyRevenue: string | undefined,
  industry: string | undefined,
  cq1Response: string | undefined,
  cq2Response: string | undefined,
  cq3Response: string
): string {
  // Start with the base description (keep the CQ3 response as the first line)
  let description = `Lead from DemandFactor. ${getStringValue(cq3Response)}`;
  
  // Build Company details
  const companyParts: string[] = [];
  if (company) companyParts.push(getStringValue(company));
  if (companySize) companyParts.push(getStringValue(companySize));
  if (companyRevenue) companyParts.push(getStringValue(companyRevenue));
  if (industry) companyParts.push(getStringValue(industry));
  
  if (companyParts.length > 0) {
    description += `\n\nCompany: ${companyParts.join(', ')}`;
  }
  
  // CQ1 Response
  if (cq1Response) {
    description += `\nCQ1: ${getStringValue(cq1Response)}`;
  }
  
  // CQ2 Response
  if (cq2Response) {
    description += `\nCQ2: ${getStringValue(cq2Response)}`;
  }
  
  // CQ3 Response
  if (cq3Response) {
    description += `\nCQ3: ${getStringValue(cq3Response)}`;
  }
  
  return description;
}

/**
 * Find or create opportunity if budget is approved
 * Returns { opportunityId, wasCreated } or null if budget not approved
 */
async function findOrCreateOpportunity(
  accountId: string,
  contactName: string,
  company: string,
  companySize: string | undefined,
  companyRevenue: string | undefined,
  industry: string | undefined,
  cq1Response: string | undefined,
  cq2Response: string | undefined,
  cq3Response: string,
  owner: string,
  createdBy: string
): Promise<{ opportunityId: string; wasCreated: boolean } | null> {
  try {
    // Check if budget is approved (CQ 3 response contains "Budget approved")
    if (!cq3Response || !cq3Response.toLowerCase().includes('budget approved')) {
      return null;
    }
    
    const opportunitiesRef = db.collection('opportunities');
    const opportunityName = `Cloud Services - ${contactName}`;
    
    // Try to find existing opportunity by name + account
    const existingQuery = await opportunitiesRef
      .where('accountId', '==', accountId)
      .where('name', '==', opportunityName)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      return { opportunityId: existingQuery.docs[0].id, wasCreated: false };
    }
    
    // Extract timeline from response (e.g., "6-9 months", "9-12 months")
    let expectedCloseDate: Date | undefined;
    const monthsMatch = cq3Response.match(/(\d+)-(\d+)\s+months?/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[2] || monthsMatch[1]);
      expectedCloseDate = new Date();
      expectedCloseDate.setMonth(expectedCloseDate.getMonth() + months);
    } else {
      // Default to 6 months if no timeline found
      expectedCloseDate = new Date();
      expectedCloseDate.setMonth(expectedCloseDate.getMonth() + 6);
    }
    
    const now = Timestamp.now();
    
    // Build description with new format
    const description = buildOpportunityDescription(
      company,
      companySize,
      companyRevenue,
      industry,
      cq1Response,
      cq2Response,
      cq3Response
    );
    
    const opportunityData: any = {
      name: opportunityName,
      accountId: accountId,
      stage: 'New',
      owner: owner,
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
      description: description,
    };
    
    if (expectedCloseDate) {
      opportunityData.expectedCloseDate = Timestamp.fromDate(expectedCloseDate);
    }
    
    const docRef = await opportunitiesRef.add(opportunityData);
    return { opportunityId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating opportunity:`, error.message);
    return null;
  }
}

/**
 * Add shared users to account
 */
async function addSharedUsersToAccount(accountId: string, sharedUserIds: string[]): Promise<void> {
  try {
    const accountRef = db.collection('accounts').doc(accountId);
    const accountDoc = await accountRef.get();
    
    if (!accountDoc.exists) {
      return;
    }
    
    const accountData = accountDoc.data();
    const existingSharedUsers: SharedUser[] = accountData?.sharedUsers || [];
    
    // Create set of existing user IDs
    const existingUserIds = new Set(existingSharedUsers.map(su => su.userId));
    
    // Add new shared users with edit permission
    const newSharedUsers: SharedUser[] = sharedUserIds
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => ({ userId, permission: 'edit' as const }));
    
    if (newSharedUsers.length > 0) {
      const updatedSharedUsers = [...existingSharedUsers, ...newSharedUsers];
      await accountRef.update({
        sharedUsers: updatedSharedUsers,
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error: any) {
    console.error(`Error adding shared users to account:`, error.message);
  }
}

/**
 * Add shared users to opportunity
 */
async function addSharedUsersToOpportunity(opportunityId: string, sharedUserIds: string[]): Promise<void> {
  try {
    const oppRef = db.collection('opportunities').doc(opportunityId);
    const oppDoc = await oppRef.get();
    
    if (!oppDoc.exists) {
      return;
    }
    
    const oppData = oppDoc.data();
    const existingSharedUsers: SharedUser[] = oppData?.sharedUsers || [];
    
    // Create set of existing user IDs
    const existingUserIds = new Set(existingSharedUsers.map(su => su.userId));
    
    // Add new shared users with edit permission
    const newSharedUsers: SharedUser[] = sharedUserIds
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => ({ userId, permission: 'edit' as const }));
    
    if (newSharedUsers.length > 0) {
      const updatedSharedUsers = [...existingSharedUsers, ...newSharedUsers];
      await oppRef.update({
        sharedUsers: updatedSharedUsers,
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error: any) {
    console.error(`Error adding shared users to opportunity:`, error.message);
  }
}

/**
 * Add note to account
 */
async function addNoteToAccount(accountId: string, content: string, createdBy: string): Promise<void> {
  try {
    const notesRef = db.collection('notes');
    const now = Timestamp.now();
    
    const noteData = {
      content: content,
      accountId: accountId,
      createdBy: createdBy,
      isPrivate: false,
      createdAt: now,
      updatedAt: now,
    };
    
    await notesRef.add(noteData);
  } catch (error: any) {
    console.error(`Error adding note to account:`, error.message);
  }
}

/**
 * Create task for opportunity
 */
async function createTaskForOpportunity(
  opportunityId: string,
  contactId: string,
  accountId: string,
  contactName: string,
  availableUserIds: string[]
): Promise<void> {
  try {
    const tasksRef = db.collection('tasks');
    const now = Timestamp.now();
    
    // Randomly select priority
    const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    // Randomly select status
    const statuses: ('not_started' | 'in_progress' | 'completed' | 'cancelled')[] = [
      'not_started',
      'in_progress',
      'completed',
      'cancelled'
    ];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Randomly select createdBy from available users
    const createdBy = availableUserIds[Math.floor(Math.random() * availableUserIds.length)];
    
    // Set due date to 12/15/2025
    const dueDate = new Date('2025-12-15');
    dueDate.setHours(23, 59, 59, 999); // End of day
    
    const taskData: any = {
      title: `Contact ${contactName}`,
      description: `Lead from DemandFactor. Contact ${contactName} regarding the opportunity.`,
      status: status,
      priority: priority,
      dueDate: Timestamp.fromDate(dueDate),
      opportunityId: opportunityId,
      contactId: contactId,
      accountId: accountId,
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    // If status is completed, set completedAt
    if (status === 'completed') {
      taskData.completedAt = now;
    }
    
    await tasksRef.add(taskData);
  } catch (error: any) {
    console.error(`Error creating task for opportunity:`, error.message);
    throw error;
  }
}

// Helper function to safely get string value from CSV row
function getStringValue(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// Helper function to safely get optional string value from CSV row
function getOptionalStringValue(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str || undefined;
}

async function importDemandFactorCSV(filePath: string) {
  console.log(`\n📊 Reading CSV file: ${filePath}\n`);
  
  // Find shared users
  console.log('👤 Finding shared users...');
  const sharedUserNames = ['Anil Joshi', 'Arjun Joshi', 'Ganesh B'];
  const sharedUserIds: string[] = [];
  
  for (const userName of sharedUserNames) {
    const userId = await findUserByName(userName);
    if (userId) {
      console.log(`   ✅ Found user: ${userName} (${userId})`);
      sharedUserIds.push(userId);
    } else {
      console.log(`   ⚠️  User not found: ${userName}`);
    }
  }
  
  if (sharedUserIds.length === 0) {
    console.log('   ⚠️  Warning: No shared users found. Accounts and Opportunities will not have shared users.');
  }
  
  // Get admin user for createdBy
  console.log('\n👤 Getting admin user...');
  const adminUserId = await getAdminUser();
  console.log(`   ✅ Using user ID: ${adminUserId}\n`);
  
  // Read the CSV file (XLSX can read CSV)
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log(`📄 Processing sheet: "${sheetName}"`);
  
  // Convert to JSON
  const rows: CSVRow[] = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📋 Found ${rows.length} rows\n`);
  
  if (rows.length === 0) {
    console.log('❌ No data found in CSV file');
    return;
  }
  
  let accountsCreated = 0;
  let accountsUpdated = 0;
  let contactsCreated = 0;
  let opportunitiesCreated = 0;
  let tasksCreated = 0;
  let notesAdded = 0;
  let rowsSkipped = 0;
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // Skip empty rows
      if (!row['First Name'] && !row['Last Name'] && !row['Company']) {
        continue;
      }
      
      const firstName = getStringValue(row['First Name']);
      const lastName = getStringValue(row['Last Name']);
      const email = getOptionalStringValue(row['Email']);
      const phone = getOptionalStringValue(row['Phone Number']);
      const title = getOptionalStringValue(row['Title']);
      const company = getStringValue(row['Company']);
      const industry = getOptionalStringValue(row['Industry']);
      const country = getOptionalStringValue(row['Country']);
      const companySize = getOptionalStringValue(row['Company Size']);
      const companyRevenue = getOptionalStringValue(row['Company Revenue ']);
      const cq3Response = getOptionalStringValue(row['CQ 3 response']);
      
      if (!company) {
        console.log(`⚠️  Row ${i + 2}: Skipping - no company name`);
        rowsSkipped++;
        continue;
      }
      
      if (!firstName && !lastName) {
        console.log(`⚠️  Row ${i + 2}: Skipping - no contact name`);
        rowsSkipped++;
        continue;
      }
      
      // Find or create account
      const accountResult = await findOrCreateAccount(
        company,
        adminUserId,
        industry,
        country,
        companySize,
        companyRevenue
      );
      
      if (accountResult.wasCreated) {
        accountsCreated++;
        // Add note to newly created account
        await addNoteToAccount(accountResult.accountId, 'Leads from DemandFactor', adminUserId);
        notesAdded++;
      } else {
        accountsUpdated++;
      }
      
      // Add shared users to account
      if (sharedUserIds.length > 0) {
        await addSharedUsersToAccount(accountResult.accountId, sharedUserIds);
      }
      
      // Find or create contact
      const contactResult = await findOrCreateContact(
        firstName || 'Unknown',
        lastName || '',
        accountResult.accountId,
        email,
        phone,
        title,
        adminUserId
      );
      if (contactResult.wasCreated) {
        contactsCreated++;
      }
      
      // Find or create opportunity if budget approved
      const contactName = `${firstName} ${lastName}`.trim() || 'Contact';
      const cq1Response = getOptionalStringValue(row['CQ 1 response']);
      const cq2Response = getOptionalStringValue(row['CQ 2 response']);
      const opportunityResult = await findOrCreateOpportunity(
        accountResult.accountId,
        contactName,
        company,
        companySize,
        companyRevenue,
        industry,
        cq1Response,
        cq2Response,
        cq3Response || '',
        adminUserId,
        adminUserId
      );
      
      if (opportunityResult) {
        if (opportunityResult.wasCreated) {
          opportunitiesCreated++;
        }
        // Add shared users to opportunity
        if (sharedUserIds.length > 0) {
          await addSharedUsersToOpportunity(opportunityResult.opportunityId, sharedUserIds);
        }
        
        // Find or create task for the opportunity
        // Use sharedUserIds if available, otherwise use adminUserId
        const taskCreatedByUsers = sharedUserIds.length > 0 ? sharedUserIds : [adminUserId];
        const taskResult = await findOrCreateTaskForOpportunity(
          opportunityResult.opportunityId,
          contactResult.contactId,
          accountResult.accountId,
          contactName,
          taskCreatedByUsers
        );
        if (taskResult.wasCreated) {
          tasksCreated++;
        }
      }
      
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
      
    } catch (error: any) {
      console.error(`\n❌ Error processing row ${i + 2}:`, error.message);
      rowsSkipped++;
    }
  }
  
  console.log(`\n\n✅ Import complete!`);
  console.log(`   📦 Accounts created: ${accountsCreated}`);
  console.log(`   📦 Accounts found (existing): ${accountsUpdated}`);
  console.log(`   👥 Contacts created: ${contactsCreated}`);
  console.log(`   💼 Opportunities created: ${opportunitiesCreated}`);
  console.log(`   ✅ Tasks created: ${tasksCreated}`);
  console.log(`   📝 Notes added: ${notesAdded}`);
  console.log(`   ⚠️  Rows skipped: ${rowsSkipped}`);
  console.log(`\n   ℹ️  Note: Duplicate records are automatically skipped.\n`);
}

// Main execution
const filePath = process.argv[2] || join(process.cwd(), 'data', 'InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv');

if (!existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

importDemandFactorCSV(filePath)
  .then(() => {
    console.log('\n✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

