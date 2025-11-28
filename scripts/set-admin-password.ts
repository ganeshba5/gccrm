/**
 * Set password for admin user
 * 
 * Usage:
 *   npx tsx scripts/set-admin-password.ts [email] [password]
 * 
 * Example:
 *   npx tsx scripts/set-admin-password.ts ganeshb@infoglobaltech.com Welcome@123
 */

import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import bcrypt from 'bcryptjs';

async function setAdminPassword() {
  try {
    const email = process.argv[2] || 'ganeshb@infoglobaltech.com';
    const password = process.argv[3] || 'Welcome@123';
    
    if (!password) {
      console.error('\n❌ Password is required');
      process.exit(1);
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Find user by email
    const usersRef = db.collection('users');
    const existingUser = await usersRef.where('email', '==', email).limit(1).get();
    
    if (existingUser.empty) {
      console.error(`\n❌ User with email ${email} not found`);
      process.exit(1);
    }
    
    const userId = existingUser.docs[0].id;
    const userData = existingUser.docs[0].data();
    
    // Update password and ensure admin role
    await usersRef.doc(userId).update({
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      updatedAt: Timestamp.now(),
    });
    
    console.log(`\n✅ Password set successfully!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${userData.role || 'admin'}`);
    console.log(`   Password: ${password} (hashed and stored)\n`);
    
  } catch (error: any) {
    console.error('\n❌ Error setting password:', error.message);
    throw error;
  }
}

setAdminPassword()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

