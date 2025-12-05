/**
 * Update opportunity descriptions from DemandFactor CSV file
 * 
 * This script processes the CSV file and updates the description field of existing opportunities
 * with the new format that includes company details and CQ responses.
 * 
 * Usage:
 *   npx tsx scripts/update-opportunity-descriptions.ts [csv-file-path]
 * 
 * Example:
 *   npx tsx scripts/update-opportunity-descriptions.ts "data/InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv"
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';

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
 * Get string value from CSV cell, handling numbers and other types
 */
function getStringValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

/**
 * Get optional string value (returns undefined if empty)
 */
function getOptionalStringValue(value: any): string | undefined {
  const str = getStringValue(value);
  return str.length > 0 ? str : undefined;
}

/**
 * Build the new description format
 */
function buildDescription(
  company: string,
  companySize: string,
  companyRevenue: string,
  industry: string,
  cq1Response: string,
  cq2Response: string,
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
 * Find opportunity by account name
 */
async function findOpportunityByAccountName(accountName: string): Promise<Array<{ id: string; name: string }>> {
  try {
    // First, find the account by name
    const accountsRef = db.collection('accounts');
    const accountQuery = await accountsRef
      .where('name', '==', accountName.trim())
      .limit(1)
      .get();
    
    if (accountQuery.empty) {
      return [];
    }
    
    const accountId = accountQuery.docs[0].id;
    
    // Then find opportunities linked to this account
    const opportunitiesRef = db.collection('opportunities');
    const oppQuery = await opportunitiesRef
      .where('accountId', '==', accountId)
      .get();
    
    return oppQuery.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unnamed Opportunity'
    }));
  } catch (error: any) {
    console.error(`Error finding opportunity for account "${accountName}":`, error.message);
    return [];
  }
}

/**
 * Update opportunity description
 */
async function updateOpportunityDescription(
  opportunityId: string,
  newDescription: string
): Promise<boolean> {
  try {
    const opportunitiesRef = db.collection('opportunities');
    const oppRef = opportunitiesRef.doc(opportunityId);
    
    await oppRef.update({
      description: newDescription,
      updatedAt: Timestamp.now()
    });
    
    return true;
  } catch (error: any) {
    console.error(`Error updating opportunity ${opportunityId}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function updateOpportunityDescriptions() {
  try {
    // Get CSV file path from command line or use default
    const csvPath = process.argv[2] || 'data/InfoGlobalTech Delivery Report 12.02.2025 DF69125-16LD.csv';
    const fullPath = join(process.cwd(), csvPath);
    
    if (!existsSync(fullPath)) {
      console.error(`❌ CSV file not found: ${fullPath}`);
      process.exit(1);
    }
    
    console.log(`\n📄 Reading CSV file: ${fullPath}\n`);
    
    // Read and parse CSV
    const workbook = XLSX.readFile(fullPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: CSVRow[] = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${rows.length} rows in CSV\n`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const company = getStringValue(row['Company']);
      const companySize = getOptionalStringValue(row['Company Size']);
      const companyRevenue = getOptionalStringValue(row['Company Revenue ']);
      const industry = getOptionalStringValue(row['Industry']);
      const cq1Response = getOptionalStringValue(row['CQ 1 response']);
      const cq2Response = getOptionalStringValue(row['CQ 2 response']);
      const cq3Response = getOptionalStringValue(row['CQ 3 response']);
      
      if (!company) {
        console.log(`⚠️  Row ${i + 2}: Skipping - no company name`);
        continue;
      }
      
      processedCount++;
      
      // Find opportunities for this account
      const opportunities = await findOpportunityByAccountName(company);
      
      if (opportunities.length === 0) {
        console.log(`⚠️  Row ${i + 2}: No opportunities found for account "${company}"`);
        notFoundCount++;
        continue;
      }
      
      // Build new description
      const newDescription = buildDescription(
        company,
        companySize || '',
        companyRevenue || '',
        industry || '',
        cq1Response || '',
        cq2Response || '',
        cq3Response || ''
      );
      
      // Update each opportunity
      for (const opp of opportunities) {
        const success = await updateOpportunityDescription(opp.id, newDescription);
        if (success) {
          console.log(`✅ Updated: ${opp.name} (ID: ${opp.id}) for account "${company}"`);
          updatedCount++;
        } else {
          console.error(`❌ Failed to update: ${opp.name} (ID: ${opp.id})`);
          errorCount++;
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Update Summary:');
    console.log(`   📄 Rows processed: ${processedCount}`);
    console.log(`   ✅ Opportunities updated: ${updatedCount}`);
    console.log(`   ⚠️  Accounts not found: ${notFoundCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error: any) {
    console.error('\n❌ Error updating opportunity descriptions:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
updateOpportunityDescriptions()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

