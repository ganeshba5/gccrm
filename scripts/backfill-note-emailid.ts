/**
 * Migration script to backfill emailId in existing notes that were created from emails
 * 
 * This script:
 * 1. Finds all notes with source === 'email' that don't have emailId
 * 2. Looks up the corresponding email via linkedTo.noteId
 * 3. Updates the note with the emailId for direct lookup
 * 
 * Run with: npm run script scripts/backfill-note-emailid.ts
 * Or: tsx scripts/backfill-note-emailid.ts
 */

import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';

async function backfillNoteEmailIds() {
  try {
    console.log('🔍 Finding notes with source="email" that need emailId backfill...\n');

    // Get all notes with source === 'email' and no emailId
    const notesSnapshot = await db.collection('notes')
      .where('source', '==', 'email')
      .get();

    console.log(`Found ${notesSnapshot.size} email-generated notes\n`);

    if (notesSnapshot.size === 0) {
      console.log('✅ No notes to backfill');
      return;
    }

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Process in batches to avoid overwhelming Firestore
    const batchSize = 10;
    const notes = notesSnapshot.docs;

    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const writeBatch = db.batch();
      let batchWriteCount = 0;

      for (const noteDoc of batch) {
        const noteData = noteDoc.data();
        const noteId = noteDoc.id;

        // Skip if emailId already exists
        if (noteData.emailId) {
          console.log(`⏭️  Note ${noteId} already has emailId: ${noteData.emailId}`);
          continue;
        }

        try {
          // Try to find the email via linkedTo.noteId
          const emailsSnapshot = await db.collection('inboundEmails')
            .where('linkedTo.noteId', '==', noteId)
            .limit(1)
            .get();

          if (emailsSnapshot.empty) {
            console.log(`⚠️  No email found for note ${noteId} (via linkedTo.noteId)`);
            notFound++;
            continue;
          }

          const emailDoc = emailsSnapshot.docs[0];
          const emailId = emailDoc.id;

          // Update the note with emailId
          writeBatch.update(noteDoc.ref, {
            emailId: emailId,
            updatedAt: Timestamp.now(),
          });

          console.log(`✅ Will update note ${noteId} with emailId: ${emailId}`);
          updated++;
          batchWriteCount++;
        } catch (error: any) {
          console.error(`❌ Error processing note ${noteId}:`, error.message);
          errors++;
        }
      }

      // Commit the batch if there are any writes
      if (batchWriteCount > 0) {
        await writeBatch.commit();
        console.log(`\n💾 Committed batch (${batchWriteCount} updates)\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Email not found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total processed: ${notes.length}`);

    if (updated > 0) {
      console.log('\n✅ Backfill completed successfully!');
    } else if (notFound > 0) {
      console.log('\n⚠️  Some notes could not be linked. This might be because:');
      console.log('   - The email was deleted');
      console.log('   - The email was never properly linked to the note');
      console.log('   - The note was created before the linking logic was implemented');
    }
  } catch (error: any) {
    console.error('❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillNoteEmailIds()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

