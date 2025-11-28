/**
 * Link existing opportunities to user IDs
 * Updates opportunities where owner is a name string to use the actual user ID
 * 
 * Usage:
 *   npx tsx scripts/link-opportunities-to-users.ts
 */

import 'dotenv/config';
import { db } from './firebase-admin.js';

async function linkOpportunitiesToUsers() {
  try {
    console.log('\n🔍 Finding opportunities with owner names (not user IDs)...\n');
    
    // Get all opportunities
    const opportunitiesRef = db.collection('opportunities');
    const opportunitiesSnapshot = await opportunitiesRef.get();
    
    if (opportunitiesSnapshot.empty) {
      console.log('No opportunities found.');
      return;
    }
    
    // Get all users
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    // Create a map of display name / email -> user ID
    const userMap = new Map<string, string>();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const userId = doc.id;
      
      // Map by display name
      if (data.displayName) {
        userMap.set(data.displayName.toLowerCase(), userId);
      }
      
      // Map by firstname lastname
      if (data.firstName && data.lastName) {
        const fullName = `${data.firstName} ${data.lastName}`;
        userMap.set(fullName.toLowerCase(), userId);
      }
      
      // Map by email (without domain)
      if (data.email) {
        const emailLocal = data.email.split('@')[0];
        userMap.set(emailLocal.toLowerCase(), userId);
      }
    });
    
    console.log(`Found ${userMap.size} user mapping(s)`);
    console.log(`Checking ${opportunitiesSnapshot.size} opportunity(ies)...\n`);
    
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    
    opportunitiesSnapshot.forEach(doc => {
      const data = doc.data();
      const owner = data.owner;
      
      // Skip if owner is already a user ID (looks like a Firestore document ID)
      // User IDs are typically 20-28 characters, alphanumeric
      if (owner && /^[a-zA-Z0-9]{20,28}$/.test(owner)) {
        skipped++;
        return;
      }
      
      // Try to find user by owner name
      const ownerLower = owner?.toLowerCase() || '';
      let userId: string | undefined;
      
      // Try exact match
      if (userMap.has(ownerLower)) {
        userId = userMap.get(ownerLower)!;
      } else {
        // Try partial matches
        for (const [key, value] of userMap.entries()) {
          if (key.includes(ownerLower) || ownerLower.includes(key)) {
            userId = value;
            break;
          }
        }
      }
      
      if (userId) {
        const oppRef = opportunitiesRef.doc(doc.id);
        batch.update(oppRef, { owner: userId });
        batchCount++;
        updated++;
        console.log(`✅ Updating opportunity "${data.name}": "${owner}" -> ${userId}`);
        
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          batch.commit();
          batchCount = 0;
        }
      } else {
        notFound++;
        console.log(`⚠️  Could not find user for owner: "${owner}" (opportunity: "${data.name}")`);
      }
    });
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`\n✨ Done!`);
    console.log(`   Updated: ${updated} opportunity(ies)`);
    console.log(`   Skipped: ${skipped} opportunity(ies) (already have user IDs)`);
    console.log(`   Not Found: ${notFound} opportunity(ies) (could not match owner to user)\n`);
    
    if (notFound > 0) {
      console.log(`   ⚠️  Some opportunities could not be linked.`);
      console.log(`   You may need to manually update these or create missing user records.\n`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error linking opportunities to users:', error.message);
    throw error;
  }
}

linkOpportunitiesToUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

