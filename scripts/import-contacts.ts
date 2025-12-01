/**
 * Import contacts from Excel workbook to Firestore
 * 
 * Usage:
 *   npx tsx scripts/import-contacts.ts [excel-file-path]
 * 
 * Example:
 *   npx tsx scripts/import-contacts.ts "data/Sebastian Contacts.xlsx"
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

interface ImportedContact {
  firstName: string;
  lastName: string;
  accountId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  department?: string;
  mailingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  notes?: string;
  opportunityId?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ImportedAccount {
  name: string;
  status: 'active' | 'inactive' | 'prospect';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ImportedOpportunity {
  name: string;
  accountId?: string;
  stage: 'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  owner: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Column mapping - adjust these based on your Excel file structure
const COLUMN_MAPPING = {
  firstName: ['First Name', 'FirstName', 'First', 'FName'],
  lastName: ['Last Name', 'LastName', 'Last', 'LName'],
  fullName: ["Contact's Name", "Contact´s Name", 'Contact Name', 'Name', 'Full Name'],
  company: ['Company', 'Account', 'Account Name', 'Company Name', 'Customer Name'],
  opportunity: ['Opportunity', 'Opportunity Name', 'Deal Name', 'Deal'],
  email: ['Email', 'Email Address', 'E-mail'],
  phone: ['Phone', 'Phone Number', 'Telephone', 'Tel'],
  mobile: ['Mobile', 'Mobile Number', 'Cell', 'Cell Phone'],
  title: ['Title', 'Job Title', 'Position', "Contact's role", "Contact´s role", 'Role'],
  department: ['Department', 'Dept'],
  street: ['Street', 'Address', 'Street Address', 'Address Line 1'],
  city: ['City'],
  state: ['State', 'Province', 'Region'],
  zipCode: ['Zip Code', 'Zip', 'Postal Code', 'Postcode'],
  country: ['Country'],
  notes: ['Notes', 'Comments', 'Description'],
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

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  // Check if it looks like a phone number (contains digits, may have formatting)
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Find or create user by name/email
 * Returns user ID
 */
async function findOrCreateUser(userName: string, userEmail?: string): Promise<string> {
  try {
    const usersRef = db.collection('users');
    
    // Try to find by email first
    if (userEmail) {
      const emailSnapshot = await usersRef.where('email', '==', userEmail.toLowerCase().trim()).get();
      if (!emailSnapshot.empty) {
        return emailSnapshot.docs[0].id;
      }
    }
    
    // Try to find by displayName or firstName/lastName
    const allUsersSnapshot = await usersRef.get();
    for (const doc of allUsersSnapshot.docs) {
      const userData = doc.data();
      const displayName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      if (displayName.toLowerCase().trim() === userName.toLowerCase().trim()) {
        return doc.id;
      }
    }
    
    // User doesn't exist, create one
    console.log(`   Creating user: ${userName}`);
    
    // Parse name into first and last name
    let firstName = '';
    let lastName = '';
    let displayName = userName;
    
    if (userName.includes(' ')) {
      const parts = userName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '';
      displayName = userName;
    } else {
      firstName = userName;
      lastName = '';
      displayName = userName;
    }
    
    // Generate email if not provided
    let email = userEmail || '';
    if (!email) {
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
    console.error(`Error finding/creating user for "${userName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create account by name
 * Returns { accountId, wasCreated }
 */
async function findOrCreateAccount(accountName: string, createdBy: string): Promise<{ accountId: string; wasCreated: boolean }> {
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
    const accountData: ImportedAccount = {
      name: accountName.trim(),
      status: 'prospect',
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await accountsRef.add(accountData);
    console.log(`   ✅ Created account: ${accountName}`);
    return { accountId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating account "${accountName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create opportunity by name
 * Returns { opportunityId, wasCreated }
 */
async function findOrCreateOpportunity(
  opportunityName: string,
  accountId: string | undefined,
  owner: string,
  createdBy: string
): Promise<{ opportunityId: string; wasCreated: boolean }> {
  try {
    const opportunitiesRef = db.collection('opportunities');
    
    // Try to find existing opportunity (case-insensitive)
    const allOpportunitiesSnapshot = await opportunitiesRef.get();
    for (const doc of allOpportunitiesSnapshot.docs) {
      const oppData = doc.data();
      if (oppData.name && oppData.name.toLowerCase().trim() === opportunityName.toLowerCase().trim()) {
        return { opportunityId: doc.id, wasCreated: false };
      }
    }
    
    // Opportunity doesn't exist, create one
    const now = Timestamp.now();
    const opportunityData: any = {
      name: opportunityName.trim(),
      stage: 'New',
      owner: owner,
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };
    
    if (accountId) {
      opportunityData.accountId = accountId;
    }
    
    const docRef = await opportunitiesRef.add(opportunityData);
    console.log(`   ✅ Created opportunity: ${opportunityName}`);
    return { opportunityId: docRef.id, wasCreated: true };
  } catch (error: any) {
    console.error(`Error finding/creating opportunity "${opportunityName}":`, error.message);
    throw error;
  }
}

async function importContacts(filePath: string) {
  console.log(`\n📊 Reading Excel file: ${filePath}\n`);
  
  // Find or create Sebastian Cordova user
  console.log('👤 Finding or creating user: Sebastian Cordova...');
  const sebastianUserId = await findOrCreateUser('Sebastian Cordova', 'sebastian.cordova@infoglobaltech.com');
  console.log(`   ✅ Using user ID: ${sebastianUserId}\n`);
  
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
  
  const now = Timestamp.now();
  let contactsCreated = 0;
  let contactsSkipped = 0;
  let accountsCreated = 0;
  let opportunitiesCreated = 0;
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // Extract contact information
      let firstName = findColumnValue(row, COLUMN_MAPPING.firstName);
      let lastName = findColumnValue(row, COLUMN_MAPPING.lastName);
      
      // If firstName and lastName are not found separately, try to get from fullName
      if ((!firstName && !lastName) || (!firstName || !lastName)) {
        const fullName = findColumnValue(row, COLUMN_MAPPING.fullName);
        if (fullName) {
          const nameParts = String(fullName).trim().split(/\s+/);
          if (nameParts.length > 0) {
            if (!firstName) {
              firstName = nameParts[0];
            }
            if (!lastName && nameParts.length > 1) {
              lastName = nameParts.slice(1).join(' ');
            }
          }
        }
      }
      
      // At least firstName is required
      if (!firstName) {
        console.log(`⚠️  Row ${i + 1}: Skipping - no first name found`);
        contactsSkipped++;
        continue;
      }
      
      // Ensure lastName is at least an empty string if not provided
      if (!lastName) {
        lastName = '';
      }
      
      // Extract company/account
      const companyName = findColumnValue(row, COLUMN_MAPPING.company);
      if (!companyName) {
        console.log(`⚠️  Row ${i + 1}: Skipping - no company/account name found`);
        contactsSkipped++;
        continue;
      }
      
      // Find or create account
      const accountResult = await findOrCreateAccount(String(companyName), sebastianUserId);
      if (!accountResult.accountId) {
        console.log(`❌ Row ${i + 1}: Failed to create/find account`);
        contactsSkipped++;
        continue;
      }
      const accountId = accountResult.accountId;
      if (accountResult.wasCreated) {
        accountsCreated++;
      }
      
      // Extract opportunity (optional)
      let opportunityId: string | undefined;
      const opportunityName = findColumnValue(row, COLUMN_MAPPING.opportunity);
      if (opportunityName) {
        const oppResult = await findOrCreateOpportunity(
          String(opportunityName).trim(),
          accountId,
          sebastianUserId,
          sebastianUserId
        );
        opportunityId = oppResult.opportunityId;
        if (oppResult.wasCreated) {
          opportunitiesCreated++;
        }
      }
      
      // Extract email/phone field - may contain email or phone
      const emailOrPhone = findColumnValue(row, COLUMN_MAPPING.email);
      let email: string | undefined;
      let phone: string | undefined;
      let mobile: string | undefined;
      
      if (emailOrPhone) {
        const value = String(emailOrPhone).trim();
        if (isEmail(value)) {
          email = value;
        } else if (isPhone(value)) {
          phone = value;
        }
      }
      
      // Extract phone if separate
      const phoneValue = findColumnValue(row, COLUMN_MAPPING.phone);
      if (phoneValue && !phone) {
        phone = String(phoneValue).trim();
      }
      
      // Extract mobile if separate
      const mobileValue = findColumnValue(row, COLUMN_MAPPING.mobile);
      if (mobileValue) {
        mobile = String(mobileValue).trim();
      }
      
      // Extract mailing address
      const street = findColumnValue(row, COLUMN_MAPPING.street);
      const city = findColumnValue(row, COLUMN_MAPPING.city);
      const state = findColumnValue(row, COLUMN_MAPPING.state);
      const zipCode = findColumnValue(row, COLUMN_MAPPING.zipCode);
      const country = findColumnValue(row, COLUMN_MAPPING.country);
      
      let mailingAddress: ImportedContact['mailingAddress'] | undefined;
      if (street || city || state || zipCode || country) {
        mailingAddress = {};
        if (street) mailingAddress.street = String(street);
        if (city) mailingAddress.city = String(city);
        if (state) mailingAddress.state = String(state);
        if (zipCode) mailingAddress.zipCode = String(zipCode);
        if (country) mailingAddress.country = String(country);
      }
      
      // Extract other fields
      const title = findColumnValue(row, COLUMN_MAPPING.title);
      const department = findColumnValue(row, COLUMN_MAPPING.department);
      const notes = findColumnValue(row, COLUMN_MAPPING.notes);
      
      // Create contact
      const contactData: any = {
        firstName: firstName ? String(firstName).trim() : '',
        lastName: lastName ? String(lastName).trim() : '',
        accountId: accountId,
        createdBy: sebastianUserId,
        createdAt: now,
        updatedAt: now,
      };
      
      if (email) contactData.email = email;
      if (phone) contactData.phone = phone;
      if (mobile) contactData.mobile = mobile;
      if (title) contactData.title = String(title).trim();
      if (department) contactData.department = String(department).trim();
      if (mailingAddress) contactData.mailingAddress = mailingAddress;
      if (notes) contactData.notes = String(notes).trim();
      
      // Note: opportunityId is not stored directly in contact, but we can add it to notes if needed
      if (opportunityId && notes) {
        contactData.notes = `${notes}\n\nLinked to Opportunity: ${opportunityName}`;
      } else if (opportunityId) {
        contactData.notes = `Linked to Opportunity: ${opportunityName}`;
      }
      
      const contactsRef = db.collection('contacts');
      await contactsRef.add(contactData);
      contactsCreated++;
      
      if (contactsCreated % 10 === 0) {
        process.stdout.write('.');
      }
      
    } catch (error: any) {
      console.error(`\n❌ Error processing row ${i + 1}:`, error.message);
      contactsSkipped++;
    }
  }
  
  console.log(`\n\n✅ Import complete!`);
  console.log(`   👥 Contacts created: ${contactsCreated}`);
  console.log(`   ⚠️  Contacts skipped: ${contactsSkipped}`);
  console.log(`   📦 Accounts created: ${accountsCreated}`);
  console.log(`   💼 Opportunities created: ${opportunitiesCreated}\n`);
}

// Main execution
const filePath = process.argv[2] || join(process.cwd(), 'data', 'Sebastian Contacts.xlsx');

if (!existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

importContacts(filePath)
  .then(() => {
    console.log('\n✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

