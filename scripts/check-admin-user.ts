/**
 * Check which project the admin user exists in
 * 
 * Usage:
 *   npx tsx scripts/check-admin-user.ts
 */

import 'dotenv/config';
import { db } from './firebase-admin.js';
import { getApps } from 'firebase-admin/app';

async function checkAdminUser() {
  try {
    const email = 'ganeshb@infoglobaltech.com';
    
    console.log('\n🔍 Checking for admin user...\n');
    
    // Get the project ID from the service account or environment
    const apps = getApps();
    const projectId = apps.length > 0 ? apps[0].options.projectId : 'unknown';
    
    console.log(`📦 Firebase Project: ${projectId}\n`);
    
    // Check if user exists
    const usersRef = db.collection('users');
    const userQuery = await usersRef.where('email', '==', email).limit(1).get();
    
    if (userQuery.empty) {
      console.log(`❌ User with email ${email} NOT FOUND in project: ${projectId}`);
      console.log(`\n💡 To create the admin user, run:`);
      console.log(`   npx tsx scripts/insert-admin-user.ts\n`);
    } else {
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      console.log(`✅ Admin user FOUND in project: ${projectId}`);
      console.log(`   User ID: ${userDoc.id}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Display Name: ${userData.displayName || 'N/A'}`);
      console.log(`   Role: ${userData.role || 'N/A'}`);
      console.log(`   Is Active: ${userData.isActive !== false ? 'Yes' : 'No'}`);
      console.log(`   Has Password: ${userData.password ? 'Yes' : 'No'}`);
      console.log(`   Created At: ${userData.createdAt?.toDate?.() || userData.createdAt || 'N/A'}`);
      console.log(`\n`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error checking admin user:', error.message);
    throw error;
  }
}

checkAdminUser()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

