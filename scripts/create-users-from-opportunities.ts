/**
 * Create user records for all current owners of opportunities
 * 
 * Usage:
 *   npx tsx scripts/create-users-from-opportunities.ts
 */

import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'Welcome@123';

async function createUsersFromOpportunities() {
  try {
    console.log('\n🔍 Finding all unique owners from opportunities...\n');
    
    // Get all opportunities
    const opportunitiesRef = db.collection('opportunities');
    const opportunitiesSnapshot = await opportunitiesRef.get();
    
    if (opportunitiesSnapshot.empty) {
      console.log('No opportunities found.');
      return;
    }
    
    // Extract unique owner IDs
    const ownerIds = new Set<string>();
    opportunitiesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.owner && typeof data.owner === 'string') {
        ownerIds.add(data.owner);
      }
    });
    
    console.log(`Found ${ownerIds.size} unique owner(s):`);
    ownerIds.forEach(id => console.log(`  - ${id}`));
    console.log('');
    
    // Get existing users
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    const existingUserIds = new Set<string>();
    const existingEmails = new Set<string>();
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      existingUserIds.add(doc.id);
      if (data.email) {
        existingEmails.add(data.email.toLowerCase());
      }
    });
    
    // Filter out owners that already have user records
    const ownersToCreate = Array.from(ownerIds).filter(id => !existingUserIds.has(id));
    
    if (ownersToCreate.length === 0) {
      console.log('✅ All owners already have user records.\n');
      return;
    }
    
    console.log(`Creating user records for ${ownersToCreate.length} owner(s)...\n`);
    
    // Hash the default password once
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    
    let created = 0;
    let skipped = 0;
    
    for (const ownerId of ownersToCreate) {
      // Try to parse owner ID as a name (format: "FirstName LastName" or similar)
      // If it's already a user ID format, we'll use it as-is for email generation
      let firstName = '';
      let lastName = '';
      let displayName = ownerId;
      
      // Try to split owner ID into first and last name
      // Common formats: "FirstName LastName", "firstname.lastname", "FirstName_LastName", etc.
      if (ownerId.includes(' ')) {
        const parts = ownerId.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || '';
        displayName = ownerId;
      } else if (ownerId.includes('.')) {
        const parts = ownerId.split('.');
        firstName = parts[0];
        lastName = parts.slice(1).join('.') || '';
        displayName = `${firstName} ${lastName}`;
      } else if (ownerId.includes('_')) {
        const parts = ownerId.split('_');
        firstName = parts[0];
        lastName = parts.slice(1).join('_') || '';
        displayName = `${firstName} ${lastName}`;
      } else {
        // If no separator, use the whole string as first name
        firstName = ownerId;
        lastName = '';
        displayName = ownerId;
      }
      
      // Generate email: firstname.lastname@infoglobaltech.com
      const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase() || 'user'}`;
      let email = `${emailBase}@infoglobaltech.com`;
      
      // If email already exists, add a number
      let emailCounter = 1;
      while (existingEmails.has(email.toLowerCase())) {
        email = `${emailBase}${emailCounter}@infoglobaltech.com`;
        emailCounter++;
      }
      
      // Create user record
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
      
      try {
        await usersRef.add(userData);
        existingEmails.add(email.toLowerCase());
        created++;
        console.log(`✅ Created user: ${email} (${displayName})`);
      } catch (error: any) {
        console.error(`❌ Failed to create user for ${ownerId}:`, error.message);
        skipped++;
      }
    }
    
    console.log(`\n✨ Done!`);
    console.log(`   Created: ${created} user(s)`);
    console.log(`   Skipped: ${skipped} user(s)`);
    console.log(`   Default password: ${DEFAULT_PASSWORD}`);
    console.log(`   ⚠️  Users should change their password after first login\n`);
    
  } catch (error: any) {
    console.error('\n❌ Error creating users from opportunities:', error.message);
    throw error;
  }
}

createUsersFromOpportunities()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

