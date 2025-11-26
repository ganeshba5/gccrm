#!/usr/bin/env node

/**
 * Helper script to set Firebase project from environment variable
 * Usage: node scripts/set-firebase-project.js [project-id]
 */

const fs = require('fs');
const path = require('path');

// Get project ID from command line arg or environment variable
const projectId = process.argv[2] || process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ Error: No project ID provided');
  console.log('\nUsage:');
  console.log('  node scripts/set-firebase-project.js <project-id>');
  console.log('  OR set VITE_FIREBASE_PROJECT_ID environment variable');
  console.log('\nExample:');
  console.log('  node scripts/set-firebase-project.js my-firebase-project');
  process.exit(1);
}

const firebasercPath = path.join(__dirname, '..', '.firebaserc');
const firebaserc = {
  projects: {
    default: projectId
  }
};

try {
  fs.writeFileSync(firebasercPath, JSON.stringify(firebaserc, null, 2));
  console.log('✅ Successfully set Firebase project to:', projectId);
  console.log('📝 Created/updated .firebaserc file');
} catch (error) {
  console.error('❌ Error writing .firebaserc file:', error.message);
  process.exit(1);
}

