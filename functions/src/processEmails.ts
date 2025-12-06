/**
 * Process emails and attach them to notes at opportunity level
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

interface EmailProcessingResult {
  processed: number;
  skipped: number;
  errors: number;
}

/**
 * Clean email content - remove signatures, logos, thread history
 */
function cleanEmailContent(text: string): string {
  if (!text) return '';
  
  // Common signature patterns
  const signaturePatterns = [
    /^--\s*$/m,  // Standard signature delimiter
    /^Best regards,?$/mi,
    /^Sincerely,?$/mi,
    /^Regards,?$/mi,
    /^Sent from .+$/mi,
    /^This email was sent from .+$/mi,
    /^\[cid:.+\]$/mi,  // Embedded images
    /<img[^>]+>/gi,  // HTML images
    /https?:\/\/[^\s]+/gi,  // URLs (may be logos)
  ];
  
  let cleaned = text;
  
  // Split by common delimiters and take the first meaningful part
  const parts = cleaned.split(/^--\s*$/m);
  if (parts.length > 1) {
    cleaned = parts[0].trim();
  }
  
  // Remove common signature lines
  const lines = cleaned.split('\n');
  const meaningfulLines: string[] = [];
  let foundSignature = false;
  
  for (const line of lines) {
    // Check if this line starts a signature
    if (line.match(/^(Best regards|Sincerely|Regards|Thanks|Thank you),?$/i)) {
      foundSignature = true;
      break;
    }
    
    // Skip lines that look like signatures
    if (foundSignature || line.match(/^Sent from|^This email was sent from/i)) {
      continue;
    }
    
    // Skip embedded image references
    if (line.match(/^\[cid:|<img/i)) {
      continue;
    }
    
    meaningfulLines.push(line);
  }
  
  return meaningfulLines.join('\n').trim();
}

/**
 * Extract HTML text content (strip HTML tags)
 */
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  return text.trim();
}

/**
 * Check if email content has already been processed (in thread history)
 */
async function isContentAlreadyProcessed(content: string, threadId?: string): Promise<boolean> {
  if (!threadId || !content) return false;
  
  try {
    // Get all emails in this thread
    const emailsSnapshot = await db.collection('inboundEmails')
      .where('threadId', '==', threadId)
      .where('processed', '==', true)
      .get();
    
    // Get all notes from linked opportunities
    const noteIds: string[] = [];
    for (const emailDoc of emailsSnapshot.docs) {
      const emailData = emailDoc.data();
      if (emailData.linkedTo?.noteId) {
        noteIds.push(emailData.linkedTo.noteId);
      }
    }
    
    if (noteIds.length === 0) return false;
    
    // Check if any note has similar content
    // Firestore "in" query has a limit of 10 items, so we need to batch
    const batchSize = 10;
    for (let i = 0; i < noteIds.length; i += batchSize) {
      const batch = noteIds.slice(i, i + batchSize);
      const notesSnapshot = await db.collection('notes')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      for (const noteDoc of notesSnapshot.docs) {
        const noteContent = noteDoc.data().content || '';
        // Simple similarity check - if content is very similar, consider it processed
        const similarity = calculateSimilarity(content, noteContent);
        if (similarity > 0.8) {  // 80% similarity threshold
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    functions.logger.error('Error checking if content already processed:', error);
    return false;
  }
}

/**
 * Simple similarity calculation (Jaccard similarity on words)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Parse explicit routing pattern: "Account: <name>, Opportunity: <name>"
 * Looks for keywords Account: and Opportunity: only in the Content field
 * Extracts all content following Account: and Opportunity:, trimming left spaces
 */
function parseRoutingPattern(content: string): { accountName?: string; opportunityName?: string } | null {
  if (!content) return null;
  
  let accountName: string | undefined;
  let opportunityName: string | undefined;
  
  // Look for Account: pattern - capture everything after "Account:" until comma, newline, or end
  const accountPattern = /Account:\s*([^,\n]+)/i;
  const accountMatch = content.match(accountPattern);
  if (accountMatch && accountMatch[1]) {
    accountName = accountMatch[1].trim();
  }
  
  // Look for Opportunity: pattern - capture everything after "Opportunity:" until newline or end
  const opportunityPattern = /Opportunity:\s*([^\n]+)/i;
  const opportunityMatch = content.match(opportunityPattern);
  if (opportunityMatch && opportunityMatch[1]) {
    opportunityName = opportunityMatch[1].trim();
  }
  
  // Return result if at least account name was found
  if (accountName) {
    return {
      accountName,
      opportunityName,
    };
  }
  
  return null;
}

/**
 * Find or create account by name
 */
async function findOrCreateAccount(accountName: string, createdBy: string): Promise<string> {
  try {
    const accountsRef = db.collection('accounts');
    
    // Try to find existing account
    const existingQuery = await accountsRef
      .where('name', '==', accountName.trim())
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      return existingQuery.docs[0].id;
    }
    
    // Create new account
    const accountData = {
      name: accountName.trim(),
      status: 'active',
      createdBy,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    const docRef = await accountsRef.add(accountData);
    functions.logger.info(`✅ Created account: ${accountName}`);
    return docRef.id;
  } catch (error: any) {
    functions.logger.error(`Error finding/creating account "${accountName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create opportunity by name and account
 */
async function findOrCreateOpportunity(
  opportunityName: string,
  accountId: string,
  createdBy: string
): Promise<string> {
  try {
    const opportunitiesRef = db.collection('opportunities');
    
    // Try to find existing opportunity
    const existingQuery = await opportunitiesRef
      .where('accountId', '==', accountId)
      .where('name', '==', opportunityName.trim())
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      return existingQuery.docs[0].id;
    }
    
    // Create new opportunity
    const opportunityData = {
      name: opportunityName.trim(),
      accountId,
      stage: 'New',
      owner: createdBy,
      createdBy,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    const docRef = await opportunitiesRef.add(opportunityData);
    functions.logger.info(`✅ Created opportunity: ${opportunityName} for account ${accountId}`);
    return docRef.id;
  } catch (error: any) {
    functions.logger.error(`Error finding/creating opportunity "${opportunityName}":`, error.message);
    throw error;
  }
}

/**
 * Extract account/opportunity from email metadata (sender email domain, subject, etc.)
 */
async function extractFromMetadata(
  email: any,
  createdBy: string
): Promise<{ accountId?: string; opportunityId?: string } | null> {
  try {
    const fromEmail = email.from?.email || '';
    const subject = email.subject || '';
    const domain = fromEmail.split('@')[1];
    
    if (!domain) return null;
    
    // Try to find account by email domain or company name in subject
    const accountsRef = db.collection('accounts');
    
    // Search by email domain
    let accountQuery = await accountsRef
      .where('email', '==', fromEmail)
      .limit(1)
      .get();
    
    if (accountQuery.empty) {
      // Try to find by domain in email field
      const allAccounts = await accountsRef.get();
      for (const doc of allAccounts.docs) {
        const accountData = doc.data();
        if (accountData.email && accountData.email.includes(domain)) {
          accountQuery = { docs: [doc], empty: false } as any;
          break;
        }
      }
    }
    
    if (accountQuery.empty) {
      // Try to extract company name from subject or create from domain
      const companyName = extractCompanyName(subject, domain);
      const accountId = await findOrCreateAccount(companyName, createdBy);
      
      // Create a default opportunity
      const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
      const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy);
      
      return { accountId, opportunityId };
    }
    
    const accountId = accountQuery.docs[0].id;
    
    // Try to find or create opportunity for this account
    const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
    const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy);
    
    return { accountId, opportunityId };
  } catch (error: any) {
    functions.logger.error('Error extracting from metadata:', error.message);
    return null;
  }
}

/**
 * Extract company name from subject or use domain
 */
function extractCompanyName(subject: string, domain: string): string {
  // Try to extract company name from subject
  const subjectMatch = subject.match(/\[(.+?)\]/) || subject.match(/^(.+?):/);
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1].trim();
  }
  
  // Use domain name as fallback
  return domain.split('.')[0]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Process a single email
 */
async function processEmail(emailDoc: admin.firestore.DocumentSnapshot, createdBy: string): Promise<boolean> {
  try {
    const email = emailDoc.data();
    if (!email) return false;
    
    // Skip if already processed
    if (email.processed) {
      return false;
    }
    
    // Skip if subject contains "testing"
    const subject = (email.subject || '').toLowerCase();
    if (subject.includes('testing')) {
      functions.logger.info(`⏭️  Skipping email with "testing" in subject: ${email.subject}`);
      await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
      return false;
    }
    
    // Get email content
    const htmlContent = email.body?.html || '';
    const textContent = email.body?.text || '';
    let content = textContent || extractTextFromHtml(htmlContent);
    
    // Clean content
    content = cleanEmailContent(content);
    
    if (!content || content.trim().length < 10) {
      functions.logger.info(`⏭️  Skipping email with insufficient content: ${email.subject}`);
      return false;
    }
    
    // Check if content already processed in thread
    if (await isContentAlreadyProcessed(content, email.threadId)) {
      functions.logger.info(`⏭️  Skipping email - content already processed in thread: ${email.subject}`);
      await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
      return false;
    }
    
    // Try to parse explicit routing pattern from content only
    let accountId: string | undefined;
    let opportunityId: string | undefined;
    
    const routing = parseRoutingPattern(content);
    if (routing?.accountName) {
      accountId = await findOrCreateAccount(routing.accountName, createdBy);
      if (routing.opportunityName) {
        opportunityId = await findOrCreateOpportunity(routing.opportunityName, accountId, createdBy);
      } else {
        // Create default opportunity if not specified
        const opportunityName = `Email Opportunity - ${email.subject?.substring(0, 50) || 'New'}`;
        opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy);
      }
    }
    
    // Metadata-based routing is disabled for now
    // if (!routing?.accountName) {
    //   const metadataResult = await extractFromMetadata(email, createdBy);
    //   if (metadataResult) {
    //     accountId = metadataResult.accountId;
    //     opportunityId = metadataResult.opportunityId;
    //   }
    // }
    
    if (!opportunityId) {
      functions.logger.info(`⏭️  Skipping email - could not determine opportunity (no routing pattern found): ${email.subject}`);
      return false;
    }
    
    // Create note with email content
    const noteContent = `Email from ${email.from?.name || email.from?.email || 'Unknown'}\n\n${content}`;
    
    const noteData = {
      content: noteContent,
      opportunityId,
      accountId,
      createdBy,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    const noteRef = await db.collection('notes').add(noteData);
    const noteId = noteRef.id;
    
    // Update email record
    await emailDoc.ref.update({
      processed: true,
      linkedTo: {
        accountId,
        opportunityId,
        noteId,
        parentType: 'opportunity',
      },
      updatedAt: admin.firestore.Timestamp.now(),
    });
    
    functions.logger.info(`✅ Processed email: ${email.subject} -> Opportunity ${opportunityId}, Note ${noteId}`);
    return true;
  } catch (error: any) {
    functions.logger.error(`Error processing email ${emailDoc.id}:`, error.message);
    return false;
  }
}

/**
 * Process unprocessed emails
 */
export async function processUnprocessedEmails(createdBy?: string): Promise<EmailProcessingResult> {
  try {
    // Get admin user ID if not provided
    let adminUserId = createdBy;
    if (!adminUserId) {
      const usersRef = db.collection('users');
      const adminQuery = await usersRef
        .where('role', '==', 'admin')
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      if (adminQuery.empty) {
        throw new Error('No admin user found');
      }
      
      adminUserId = adminQuery.docs[0].id;
    }
    
    // Get unprocessed emails
    const emailsRef = db.collection('inboundEmails');
    const unprocessedQuery = await emailsRef
      .where('processed', '==', false)
      .orderBy('receivedAt', 'desc')
      .limit(100)  // Process in batches
      .get();
    
    functions.logger.info(`Found ${unprocessedQuery.size} unprocessed emails`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const emailDoc of unprocessedQuery.docs) {
      try {
        const success = await processEmail(emailDoc, adminUserId);
        if (success) {
          processed++;
        } else {
          skipped++;
        }
      } catch (error: any) {
        functions.logger.error(`Error processing email ${emailDoc.id}:`, error.message);
        errors++;
      }
    }
    
    functions.logger.info(`✅ Email processing complete! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    
    return { processed, skipped, errors };
  } catch (error: any) {
    functions.logger.error('❌ Error processing emails:', error.message);
    throw error;
  }
}

// Export processEmail for use in fetchEmails
export { processEmail };

