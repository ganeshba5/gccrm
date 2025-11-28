/**
 * Insert an admin user into Firestore
 * 
 * Usage:
 *   npx tsx scripts/insert-admin-user.ts
 */

import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import bcrypt from 'bcryptjs';

async function insertAdminUser() {
  try {
    const email = 'ganeshb@infoglobaltech.com';
    const password = 'Welcome@123'; // Default password - user should change this
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const usersRef = db.collection('users');
    const existingUser = await usersRef.where('email', '==', email).limit(1).get();
    
    if (!existingUser.empty) {
      console.log(`\n⚠️  User with email ${email} already exists`);
      const userId = existingUser.docs[0].id;
      console.log(`   User ID: ${userId}`);
      
      // Update to admin role and set password if not set
      const userDoc = existingUser.docs[0];
      const userData = userDoc.data();
      
      const updateData: any = {
        role: 'admin',
        isActive: true,
        updatedAt: Timestamp.now(),
      };
      
      // Only update password if it's not already set
      if (!userData.password) {
        updateData.password = hashedPassword;
        console.log(`   ✅ Set password and updated user to admin role`);
      } else {
        console.log(`   ✅ Updated user to admin role (password already set)`);
      }
      
      await usersRef.doc(userId).update(updateData);
      console.log(`\n`);
      return;
    }
    
    // Create new admin user
    const now = Timestamp.now();
    const userData = {
      email,
      password: hashedPassword,
      displayName: 'Ganesh B',
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await usersRef.add(userData);
    
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`   User ID: ${docRef.id}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: admin`);
    console.log(`   Default Password: ${password}`);
    console.log(`   ⚠️  Please change the password after first login\n`);
    
  } catch (error: any) {
    console.error('\n❌ Error creating admin user:', error.message);
    throw error;
  }
}

insertAdminUser()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
