/**
 * Process emails and attach them to notes at opportunity level
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { compareTwoStrings } from 'string-similarity';

const db = admin.firestore();

// Configuration for fuzzy matching and parsing
// These can be overridden by config settings
const DEFAULT_FUZZY_MATCH_THRESHOLD = 0.8; // 80% similarity required for match
const DEFAULT_CONTEXT_MATCH_THRESHOLD = 0.6; // 60% similarity for context-based matching

/**
 * Get configuration value for email parsing
 * Falls back to defaults if not set
 * Only checks global settings (not user settings)
 */
async function getParsingConfig(key: string, defaultValue: any): Promise<any> {
  try {
    const configKey = `email_parsing.${key}`;
    const configRef = db.collection('configSettings');
    
    // First, let's try to find the document
    const globalQuery = await configRef
      .where('key', '==', configKey)
      .where('scope', '==', 'global')
      .limit(1)
      .get();
    
    functions.logger.info(`🔍 getParsingConfig: Looking for key "${configKey}"`, {
      queryKey: configKey,
      queryResults: globalQuery.size,
    });
    
    if (!globalQuery.empty) {
      const setting = globalQuery.docs[0].data();
      functions.logger.info(`✅ getParsingConfig: Found setting for "${configKey}"`, {
        value: setting.value,
        valueType: typeof setting.value,
        isArray: Array.isArray(setting.value),
        documentId: globalQuery.docs[0].id,
      });
      return setting.value;
    }
    
    // Debug: List all email_parsing configs to see what exists
    functions.logger.warn(`⚠️  getParsingConfig: No setting found for "${configKey}", checking all email_parsing settings...`);
    try {
      const allEmailParsingQuery = await configRef
        .where('key', '>=', 'email_parsing.')
        .where('key', '<', 'email_parsing.\uf8ff')
        .where('scope', '==', 'global')
        .get();
      
      functions.logger.info(`📋 Found ${allEmailParsingQuery.size} email_parsing config(s):`);
      allEmailParsingQuery.docs.forEach(doc => {
        const data = doc.data();
        functions.logger.info(`  - Key: "${data.key}", Scope: "${data.scope}", Value: ${JSON.stringify(data.value)}`);
      });
    } catch (debugError: any) {
      functions.logger.warn(`Could not list email_parsing configs for debugging: ${debugError.message}`);
    }
    
    // Fall back to predefined defaults for known settings
    const predefinedDefaults: Record<string, any> = {
      'apply_routing_methods': ['pattern'], // Default: only pattern matching
      'show_routing_methods': [], // Default: empty (only manual items)
      'parse_settings': {
        subjectTokens: ['Re:', 'Fwd:', 'FW:', 'RE:', 'FWD:'],
        domains: ['infoglobaltech.com'],
        emailAddresses: []
      },
    };
    
    if (predefinedDefaults[key] !== undefined) {
      functions.logger.info(`📋 getParsingConfig: Using predefined default for "${key}"`, {
        defaultValue: predefinedDefaults[key],
      });
      return predefinedDefaults[key];
    }
    
    functions.logger.info(`📋 getParsingConfig: Using provided default for "${key}"`, {
      defaultValue: defaultValue,
    });
    return defaultValue;
  } catch (error: any) {
    functions.logger.warn(`❌ Could not load config for ${key}, using default:`, error.message);
    return defaultValue;
  }
}

/**
 * Get email parse settings from config
 */
async function getEmailParseSettings(): Promise<{
  subjectTokens: string[];
  domains: string[];
  emailAddresses: string[];
}> {
  const parseSettings = await getParsingConfig('parse_settings', {
    subjectTokens: ['Re:', 'Fwd:', 'FW:', 'RE:', 'FWD:'],
    domains: ['infoglobaltech.com'],
    emailAddresses: []
  });
  
  return {
    subjectTokens: Array.isArray(parseSettings?.subjectTokens) ? parseSettings.subjectTokens : [],
    domains: Array.isArray(parseSettings?.domains) ? parseSettings.domains : [],
    emailAddresses: Array.isArray(parseSettings?.emailAddresses) ? parseSettings.emailAddresses : [],
  };
}

/**
 * Clean subject line by removing tokens like Re:, Fwd:, etc.
 * Case-insensitive matching - "Fw:" will match "FW:" token, "Re:" will match "RE:" token
 */
function cleanSubjectLine(subject: string, tokens: string[]): string {
  if (!subject) return '';
  
  let cleaned = subject.trim();
  const subjectLower = cleaned.toLowerCase();
  
  // Remove tokens from the beginning (case-insensitive)
  for (const token of tokens) {
    const tokenLower = token.toLowerCase().trim();
    
    // Check if subject starts with this token (case-insensitive)
    if (subjectLower.startsWith(tokenLower)) {
      // Find the actual position and length of the token in the original subject
      // This handles cases like "Fw:" matching "FW:" token
      const matchIndex = subjectLower.indexOf(tokenLower);
      if (matchIndex === 0) {
        // Remove the token from the beginning
        // Use the actual token length from the original subject by finding where it ends
        // Since we know it starts at position 0, we can use tokenLower.length
        cleaned = cleaned.substring(tokenLower.length).trim();
        // Recursively check for multiple tokens (e.g., "Re: Re: Fwd: ...")
        return cleanSubjectLine(cleaned, tokens);
      }
    }
  }
  
  return cleaned;
}

/**
 * Check if email is a forwarded email to CRM mailbox
 * Conditions:
 * 1. Subject starts with "Fw:" (case-insensitive)
 * 2. Only recipient is crm@infogloballink.com
 */
function isForwardedToCrm(email: any): boolean {
  const subject = (email.subject || '').trim();
  const toRecipients = email.to || [];
  
  functions.logger.info(`🔍 Checking if forwarded to CRM:`, {
    subject: subject,
    subjectLower: subject.toLowerCase(),
    toRecipientsCount: toRecipients.length,
    toRecipients: toRecipients,
  });
  
  // Check if subject starts with "Fw:" (case-insensitive)
  const subjectLower = subject.toLowerCase();
  if (!subjectLower.startsWith('fw:')) {
    functions.logger.info(`   ❌ Subject does not start with "Fw:"`);
    return false;
  }
  
  // Check if only recipient is crm@infogloballink.com
  if (toRecipients.length !== 1) {
    functions.logger.info(`   ❌ Not exactly 1 recipient (found ${toRecipients.length})`);
    return false;
  }
  
  // Handle both string and object recipients
  let recipientEmail: string;
  const firstRecipient = toRecipients[0];
  if (typeof firstRecipient === 'string') {
    recipientEmail = firstRecipient;
  } else if (firstRecipient && typeof firstRecipient === 'object' && firstRecipient.email) {
    recipientEmail = firstRecipient.email;
  } else {
    functions.logger.info(`   ❌ Could not extract recipient email from:`, firstRecipient);
    return false;
  }
  
  const recipient = recipientEmail.toLowerCase().trim();
  functions.logger.info(`   🔍 Checking recipient: "${recipient}" against CRM email patterns`);
  
  // Check for various CRM email formats
  const crmEmailPatterns = [
    'crm@infogloballink.com',
    'crm@infogloballink',
    'crm.infogloballink.com',
    'crm',
  ];
  
  // Check exact match first
  if (recipient === 'crm@infogloballink.com') {
    functions.logger.info(`   ✅ Forwarded email to CRM detected! (exact match)`);
    return true;
  }
  
  // Check if recipient contains "crm" and is from infogloballink domain
  if (recipient.includes('crm') && recipient.includes('infogloballink')) {
    functions.logger.info(`   ✅ Forwarded email to CRM detected! (pattern match)`);
    return true;
  }
  
  // Check if recipient is just "crm" (might be stored without domain)
  if (recipient === 'crm') {
    functions.logger.info(`   ✅ Forwarded email to CRM detected! (crm only)`);
    return true;
  }
  
  functions.logger.info(`   ❌ Recipient "${recipient}" does not match any CRM email pattern`);
  return false;
}

/**
 * Extract original From and To from forwarded email content
 * Also extracts the original email body/content (without forwarding wrapper)
 * Looks for patterns like:
 * - "From: name <email@domain.com>"
 * - "To: email@domain.com"
 * - "-----Original Message-----" followed by From/To headers
 */
function extractForwardedEmailInfo(content: string): { 
  from?: { email: string; name?: string }; 
  to?: string[]; 
  originalContent?: string;
} | null {
  if (!content) {
    functions.logger.warn(`   ⚠️  No content provided to extractForwardedEmailInfo`);
    return null;
  }
  
  functions.logger.info(`   🔍 Extracting forwarded email info from content (first 500 chars):`, {
    contentPreview: content.substring(0, 500),
  });
  
  const result: { from?: { email: string; name?: string }; to?: string[]; originalContent?: string } = {};
  
  // Try to find forwarded email headers
  // Look for patterns like "From:", "To:" in the content
  // Common patterns:
  // 1. "From: name <email@domain.com>"
  // 2. "To: email@domain.com"
  // 3. "-----Original Message-----" followed by headers
  
  // Find the forwarded section - look for common separators
  const separators = [
    /-----Original Message-----/i,
    /-----Forwarded Message-----/i,
    /From:\s/i,
    /^On .* wrote:/m,
  ];
  
  let forwardedSection = content;
  let separatorFound = false;
  for (const separator of separators) {
    const match = content.match(separator);
    if (match && match.index !== undefined) {
      // Extract content after the separator
      forwardedSection = content.substring(match.index);
      separatorFound = true;
      functions.logger.info(`   ✅ Found separator at index ${match.index}: ${separator.toString()}`);
      break;
    }
  }
  
  if (!separatorFound) {
    functions.logger.info(`   ⚠️  No separator found, searching entire content`);
  }
  
  // Extract From field - look for "From:" followed by email
  // Try multiple patterns to handle different email formats
  const fromPatterns = [
    /From:\s*(.+?)(?:\r?\n|$)/i,  // Standard "From: ..." with newline
    /^From:\s*(.+?)$/im,          // "From: ..." at start of line
    /From\s+(.+?)(?:\r?\n|$)/i,    // "From ..." (without colon)
  ];
  
  let fromMatch = null;
  for (const pattern of fromPatterns) {
    fromMatch = forwardedSection.match(pattern);
    if (fromMatch) break;
  }
  
  if (fromMatch) {
    const fromLine = fromMatch[1].trim();
    functions.logger.info(`   🔍 Found From line: "${fromLine}"`);
    
    // Parse "Name <email@domain.com>" or just "email@domain.com"
    const emailMatch = fromLine.match(/(.+?)\s*<(.+?)>/);
    if (emailMatch) {
      result.from = {
        name: emailMatch[1].replace(/"/g, '').trim(),
        email: emailMatch[2].trim(),
      };
      functions.logger.info(`   ✅ Extracted From: ${result.from.email} (${result.from.name})`);
    } else {
      // Just email address - try to find email in the line
      const emailAddress = fromLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailAddress) {
        result.from = {
          email: emailAddress[1].trim(),
        };
        functions.logger.info(`   ✅ Extracted From: ${result.from.email}`);
      } else {
        functions.logger.warn(`   ⚠️  Could not parse From line: "${fromLine}"`);
      }
    }
  } else {
    functions.logger.warn(`   ⚠️  No From: line found in forwarded section`);
  }
  
  // Extract To field - look for "To:" followed by email(s)
  // Try multiple patterns
  const toPatterns = [
    /To:\s*(.+?)(?:\r?\n|$)/i,    // Standard "To: ..." with newline
    /^To:\s*(.+?)$/im,             // "To: ..." at start of line
    /To\s+(.+?)(?:\r?\n|$)/i,      // "To ..." (without colon)
  ];
  
  let toMatch = null;
  for (const pattern of toPatterns) {
    toMatch = forwardedSection.match(pattern);
    if (toMatch) break;
  }
  
  if (toMatch) {
    const toLine = toMatch[1].trim();
    functions.logger.info(`   🔍 Found To line: "${toLine}"`);
    
    // Extract email addresses from the To line
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emails: string[] = [];
    let emailMatch;
    while ((emailMatch = emailRegex.exec(toLine)) !== null) {
      emails.push(emailMatch[1].trim());
    }
    if (emails.length > 0) {
      result.to = emails;
      functions.logger.info(`   ✅ Extracted To: ${emails.join(', ')}`);
    } else {
      functions.logger.warn(`   ⚠️  Could not extract email addresses from To line: "${toLine}"`);
    }
  } else {
    functions.logger.warn(`   ⚠️  No To: line found in forwarded section`);
  }
  
  // Extract original email body/content (everything after the headers)
  // Find where the actual email content starts (after Subject: or Date: or blank line after headers)
  const contentStartPatterns = [
    /Subject:[\s\S]*?\n\n/im,  // After Subject: and blank line (using [\s\S] instead of . with s flag)
    /Date:[\s\S]*?\n\n/im,      // After Date: and blank line
    /\n\n/,                     // Double newline (end of headers)
  ];
  
  let originalContentStart = forwardedSection.length;
  for (const pattern of contentStartPatterns) {
    const match = forwardedSection.match(pattern);
    if (match && match.index !== undefined) {
      const startPos = match.index + match[0].length;
      if (startPos < originalContentStart) {
        originalContentStart = startPos;
      }
    }
  }
  
  if (originalContentStart < forwardedSection.length) {
    result.originalContent = forwardedSection.substring(originalContentStart).trim();
    functions.logger.info(`   ✅ Extracted original email content (${result.originalContent.length} chars)`);
  } else {
    // If we couldn't find a clear separator, try to extract content after the last header
    // Look for content after "Subject:" line
    const subjectMatch = forwardedSection.match(/Subject:[\s\S]*?\n([\s\S]+)/im);
    if (subjectMatch && subjectMatch[1]) {
      result.originalContent = subjectMatch[1].trim();
      functions.logger.info(`   ✅ Extracted original email content after Subject (${result.originalContent.length} chars)`);
    } else {
      // Fallback: use everything after From/To headers (remove header lines)
      const afterHeaders = forwardedSection.replace(/^(From:|To:|Subject:|Date:).*?\n/gm, '').trim();
      if (afterHeaders.length > 50) { // Only if there's substantial content
        result.originalContent = afterHeaders;
        functions.logger.info(`   ✅ Extracted original email content (fallback, ${result.originalContent.length} chars)`);
      }
    }
  }
  
  // If we found at least From or To, return the result
  if (result.from || result.to) {
    functions.logger.info(`   ✅ Successfully extracted forwarded email info:`, {
      from: result.from,
      to: result.to,
      originalContentLength: result.originalContent?.length || 0,
    });
    return result;
  }
  
  functions.logger.warn(`   ❌ Could not extract any forwarded email info`);
  return null;
}

interface EmailProcessingResult {
  processed: number;
  skipped: number;
  errors: number;
}

/**
 * Clean email content - remove signatures, logos, thread history
 * Enhanced version that preserves important structured information
 */
function cleanEmailContent(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove quoted/replied content (lines starting with >)
  cleaned = cleaned.replace(/^>\s+.*$/gm, '');
  
  // Remove "On [date] [person] wrote:" patterns
  cleaned = cleaned.replace(/^On\s+.+\s+wrote:.*$/gmi, '');
  
  // Remove "From:" lines in thread history
  cleaned = cleaned.replace(/^From:\s+.+$/gmi, '');
  
  // Remove "Sent:" lines in thread history
  cleaned = cleaned.replace(/^Sent:\s+.+$/gmi, '');
  
  // Remove "To:" lines in thread history (but keep first occurrence)
  const toMatches = cleaned.match(/^To:\s+.+$/gmi);
  if (toMatches && toMatches.length > 1) {
    // Remove all but the first
    let firstFound = false;
    cleaned = cleaned.replace(/^To:\s+.+$/gmi, (match) => {
      if (!firstFound) {
        firstFound = true;
        return match;
      }
      return '';
    });
  }
  
  // Split by common delimiters and take the first meaningful part
  const parts = cleaned.split(/^--\s*$/m);
  if (parts.length > 1) {
    cleaned = parts[0].trim();
  }
  
  // Split by "---" or "===" delimiters
  const altParts = cleaned.split(/^[-=]{3,}\s*$/m);
  if (altParts.length > 1) {
    cleaned = altParts[0].trim();
  }
  
  // Remove common signature lines
  const lines = cleaned.split('\n');
  const meaningfulLines: string[] = [];
  let foundSignature = false;
  
  const signatureStarters = [
    /^(Best regards|Sincerely|Regards|Thanks|Thank you|Yours|Cheers|Best),?$/i,
    /^(Sent from|This email was sent from)/i,
    /^--\s*$/,
    /^---\s*$/,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a signature
    for (const pattern of signatureStarters) {
      if (pattern.test(line)) {
        foundSignature = true;
        break;
      }
    }
    
    if (foundSignature) {
      // Check if this might be important info (dates, amounts) before skipping
      const hasImportantInfo = /(\$[\d,]+|deadline|due date|meeting|follow up|\d{1,2}[\/\-]\d{1,2})/i.test(line);
      if (!hasImportantInfo) {
        continue;
      }
    }
    
    // Skip lines that look like signatures
    if (line.match(/^Sent from|^This email was sent from|^\[cid:|^<img/i)) {
      continue;
    }
    
    // Skip lines that are just URLs
    if (line.match(/^https?:\/\/[^\s]+$/i)) {
      continue;
    }
    
    // Skip lines that are just email addresses
    if (line.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/)) {
      continue;
    }
    
    meaningfulLines.push(line);
  }
  
  // Remove excessive whitespace
  cleaned = meaningfulLines.join('\n').trim();
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  
  return cleaned;
}

/**
 * Clean HTML email content while preserving HTML structure
 * Removes quoted/replied sections but keeps HTML formatting
 */
function cleanEmailContentHtml(html: string): string {
  if (!html) return '';
  
  let cleaned = html;
  
  // Remove quoted/replied content in blockquote tags
  cleaned = cleaned.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '');
  
  // Remove quoted content in divs with common quote classes
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove "On [date] [person] wrote:" patterns (case-insensitive, multiline)
  cleaned = cleaned.replace(/<p[^>]*>On\s+[\s\S]*?\s+wrote:[\s\S]*?<\/p>/gi, '');
  cleaned = cleaned.replace(/On\s+[\s\S]*?\s+wrote:[\s\S]*?(?=<[^>]+>|$)/gi, '');
  
  // Remove "From:" lines in thread history
  cleaned = cleaned.replace(/<p[^>]*>From:\s+[\s\S]*?<\/p>/gi, '');
  cleaned = cleaned.replace(/From:\s+[\s\S]*?(?=<[^>]+>|$)/gi, '');
  
  // Remove "Sent:" lines in thread history
  cleaned = cleaned.replace(/<p[^>]*>Sent:\s+[\s\S]*?<\/p>/gi, '');
  cleaned = cleaned.replace(/Sent:\s+[\s\S]*?(?=<[^>]+>|$)/gi, '');
  
  // Split by common delimiters and take the first meaningful part
  const parts = cleaned.split(/<hr[^>]*>|<div[^>]*>--\s*<\/div>/i);
  if (parts.length > 1) {
    cleaned = parts[0].trim();
  }
  
  // Remove common signature patterns in HTML
  const signaturePatterns = [
    /<p[^>]*>(Best regards|Sincerely|Regards|Thanks|Thank you|Yours|Cheers|Best),?[\s\S]*$/i,
    /<div[^>]*>(Best regards|Sincerely|Regards|Thanks|Thank you|Yours|Cheers|Best),?[\s\S]*$/i,
  ];
  
  for (const pattern of signaturePatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      cleaned = cleaned.substring(0, match.index).trim();
    }
  }
  
  return cleaned.trim();
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
 * Extract only new content from email thread (content not seen in previous emails)
 */
async function extractNewThreadContent(
  emailContent: string,
  htmlContent: string,
  threadId?: string
): Promise<{ newContent: string; newHtmlContent: string }> {
  if (!threadId || !emailContent) {
    return { newContent: emailContent, newHtmlContent: htmlContent };
  }

  try {
    // Get all processed emails in this thread (excluding current)
    const emailsSnapshot = await db.collection('inboundEmails')
      .where('threadId', '==', threadId)
      .where('processed', '==', true)
      .orderBy('receivedAt', 'desc')
      .get();

    if (emailsSnapshot.empty) {
      return { newContent: emailContent, newHtmlContent: htmlContent };
    }

    // Get all previous email contents from the thread
    const previousContents: string[] = [];
    for (const emailDoc of emailsSnapshot.docs) {
      const emailData = emailDoc.data();
      const prevHtml = emailData.body?.html || '';
      const prevText = emailData.body?.text || '';
      const prevContent = prevText || extractTextFromHtml(prevHtml);
      if (prevContent) {
        previousContents.push(cleanEmailContent(prevContent));
      }
    }

    // Find the longest matching suffix (common thread content)
    let longestMatch = '';
    const emailContentCleaned = cleanEmailContent(emailContent);
    
    for (const prevContent of previousContents) {
      // Check if current content ends with previous content (thread continuation)
      if (emailContentCleaned.length >= prevContent.length) {
        const suffix = emailContentCleaned.substring(emailContentCleaned.length - prevContent.length);
        const similarity = calculateSimilarity(suffix, prevContent);
        if (similarity > 0.85 && prevContent.length > longestMatch.length) {
          longestMatch = prevContent;
        }
      }
    }

    // Extract new content (remove the matching thread portion)
    let newContent = emailContentCleaned;
    let newHtmlContent = htmlContent;

    if (longestMatch.length > 50) {
      // Find where the new content starts
      const matchIndex = emailContentCleaned.lastIndexOf(longestMatch.substring(0, Math.min(100, longestMatch.length)));
      if (matchIndex > 0 && matchIndex < emailContentCleaned.length * 0.7) {
        // Only take the first part (new content)
        newContent = emailContentCleaned.substring(0, matchIndex).trim();
        
        // For HTML, try to extract new content similarly
        if (htmlContent) {
          // Remove quoted/replied sections which typically contain previous thread content
          const cleanedHtml = cleanEmailContentHtml(htmlContent);
          // If cleaned HTML is significantly shorter, use it
          if (cleanedHtml.length < htmlContent.length * 0.8) {
            newHtmlContent = cleanedHtml;
          } else {
            // Try to find and remove the matching portion
            const htmlText = extractTextFromHtml(htmlContent);
            const htmlMatchIndex = htmlText.lastIndexOf(longestMatch.substring(0, Math.min(100, longestMatch.length)));
            if (htmlMatchIndex > 0 && htmlMatchIndex < htmlText.length * 0.7) {
              // Extract HTML up to the match point (approximate)
              newHtmlContent = htmlContent.substring(0, Math.floor(htmlContent.length * (htmlMatchIndex / htmlText.length))).trim();
            }
          }
        }
      }
    }

    // If new content is too short, use original (might be a new thread)
    if (newContent.length < 20) {
      return { newContent: emailContentCleaned, newHtmlContent: htmlContent };
    }

    functions.logger.info(`📧 Extracted new thread content: ${newContent.length} chars (from ${emailContentCleaned.length} total)`);
    return { newContent, newHtmlContent };
  } catch (error) {
    functions.logger.error('Error extracting new thread content:', error);
    return { newContent: emailContent, newHtmlContent: htmlContent };
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
 * Parse explicit routing pattern with enhanced pattern recognition
 * Supports multiple variations: Account/Company/Client/Customer/Organization and Opportunity/Deal/Project/Engagement/Lead
 * Looks in both content and subject line
 */
function parseRoutingPattern(content: string, subject?: string): { accountName?: string; opportunityName?: string } | null {
  if (!content && !subject) {
    functions.logger.info('🔍 parseRoutingPattern: No content or subject provided');
    return null;
  }
  
  // Combine content and subject for pattern matching
  const searchText = `${subject || ''}\n${content || ''}`;
  
  let accountName: string | undefined;
  let opportunityName: string | undefined;
  
  // Account pattern variations (case-insensitive, with/without colon)
  const accountPatterns = [
    /(?:Account|Company|Client|Customer|Organization|Org):\s*([^,\n]+)/i,
    /(?:Account|Company|Client|Customer|Organization|Org)\s+is\s+([^,\n]+)/i,
    /(?:Account|Company|Client|Customer|Organization|Org)\s+=\s+([^,\n]+)/i,
  ];
  
  // Try each account pattern
  for (const pattern of accountPatterns) {
    const match = searchText.match(pattern);
    if (match && match[1]) {
      accountName = match[1].trim();
      functions.logger.info(`🔍 parseRoutingPattern: Found Account pattern - raw: "${match[1]}", trimmed: "${accountName}"`);
      break;
    }
  }
  
  // Opportunity pattern variations (case-insensitive, with/without colon)
  const opportunityPatterns = [
    /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal):\s*([^\n]+)/i,
    /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal)\s+is\s+([^\n]+)/i,
    /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal)\s+=\s+([^\n]+)/i,
    /(?:Opportunity|Deal|Project|Engagement|Lead|Proposal)\s+for\s+([^\n]+)/i, // "Opportunity for Projauto..."
  ];
  
  // Try each opportunity pattern
  for (const pattern of opportunityPatterns) {
    const match = searchText.match(pattern);
    if (match && match[1]) {
      opportunityName = match[1].trim();
      functions.logger.info(`🔍 parseRoutingPattern: Found Opportunity pattern - raw: "${match[1]}", trimmed: "${opportunityName}"`);
      break;
    }
  }
  
  // Return result if at least account name was found
  if (accountName) {
    functions.logger.info(`🔍 parseRoutingPattern: Returning - accountName: "${accountName}", opportunityName: "${opportunityName || 'NOT FOUND'}"`);
    return {
      accountName,
      opportunityName,
    };
  }
  
  functions.logger.info('🔍 parseRoutingPattern: No account name found, returning null');
  return null;
}

/**
 * Find or create account by name with fuzzy matching
 */
async function findOrCreateAccount(
  accountName: string, 
  createdBy: string,
  routingMethod?: 'pattern' | 'metadata' | 'context',
  routingConfidence?: number
): Promise<string> {
  try {
    const accountsRef = db.collection('accounts');
    const trimmedName = accountName.trim();
    
    // Get fuzzy match threshold from config
    const fuzzyThreshold = await getParsingConfig('fuzzy_match_threshold', DEFAULT_FUZZY_MATCH_THRESHOLD);
    
    // First, try exact match
    const exactQuery = await accountsRef
      .where('name', '==', trimmedName)
      .limit(1)
      .get();
    
    if (!exactQuery.empty) {
      functions.logger.info(`✅ Found exact account match: ${trimmedName}`);
      return exactQuery.docs[0].id;
    }
    
    // If no exact match, try fuzzy matching
    const allAccountsSnapshot = await accountsRef.get();
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    
    for (const doc of allAccountsSnapshot.docs) {
      const existingName = doc.data().name || '';
      const similarity = compareTwoStrings(trimmedName.toLowerCase(), existingName.toLowerCase());
      
      if (similarity >= fuzzyThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            id: doc.id,
            name: existingName,
            similarity,
          };
        }
      }
    }
    
    if (bestMatch) {
      functions.logger.info(`✅ Found fuzzy account match: "${trimmedName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
      return bestMatch.id;
    }
    
    // No match found, create new account
    const accountData: any = {
      name: trimmedName,
      status: 'active',
      createdBy,
      source: 'email', // Mark as created from email processing
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Add routing information if provided
    if (routingMethod) {
      accountData.routingMethod = routingMethod;
    }
    if (routingConfidence !== undefined) {
      accountData.routingConfidence = routingConfidence;
    }
    
    const docRef = await accountsRef.add(accountData);
    functions.logger.info(`✅ Created new account: ${trimmedName}`);
    return docRef.id;
  } catch (error: any) {
    functions.logger.error(`Error finding/creating account "${accountName}":`, error.message);
    throw error;
  }
}

/**
 * Find or create opportunity by name and account with fuzzy matching
 */
async function findOrCreateOpportunity(
  opportunityName: string,
  accountId: string,
  createdBy: string,
  routingMethod?: 'pattern' | 'metadata' | 'context',
  routingConfidence?: number
): Promise<string> {
  try {
    const opportunitiesRef = db.collection('opportunities');
    const trimmedName = opportunityName.trim();
    
    // First, get all opportunities for this account
    const accountOpportunitiesQuery = await opportunitiesRef
      .where('accountId', '==', accountId)
      .get();
    
    // Try exact match first
    for (const doc of accountOpportunitiesQuery.docs) {
      const existingName = doc.data().name || '';
      if (existingName === trimmedName) {
        functions.logger.info(`✅ Found exact opportunity match: ${trimmedName}`);
        return doc.id;
      }
    }
    
    // If no exact match, try fuzzy matching
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    
    // Get fuzzy match threshold from config
    const fuzzyThreshold = await getParsingConfig('fuzzy_match_threshold', DEFAULT_FUZZY_MATCH_THRESHOLD);
    
    for (const doc of accountOpportunitiesQuery.docs) {
      const existingName = doc.data().name || '';
      const similarity = compareTwoStrings(trimmedName.toLowerCase(), existingName.toLowerCase());
      
      if (similarity >= fuzzyThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            id: doc.id,
            name: existingName,
            similarity,
          };
        }
      }
    }
    
    if (bestMatch) {
      functions.logger.info(`✅ Found fuzzy opportunity match: "${trimmedName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
      return bestMatch.id;
    }
    
    // No match found, create new opportunity
    // Calculate default close date: 6 months from today
    const today = new Date();
    const sixMonthsFromToday = new Date(today);
    sixMonthsFromToday.setMonth(today.getMonth() + 6);
    
    const opportunityData: any = {
      name: trimmedName,
      accountId,
      stage: 'New',
      owner: createdBy,
      createdBy,
      source: 'email', // Mark as created from email processing
      expectedCloseDate: admin.firestore.Timestamp.fromDate(sixMonthsFromToday),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Add routing information if provided
    if (routingMethod) {
      opportunityData.routingMethod = routingMethod;
    }
    if (routingConfidence !== undefined) {
      opportunityData.routingConfidence = routingConfidence;
    }
    
    const docRef = await opportunitiesRef.add(opportunityData);
    functions.logger.info(`✅ Created new opportunity: ${trimmedName} for account ${accountId} with close date: ${sixMonthsFromToday.toISOString()}`);
    return docRef.id;
  } catch (error: any) {
    functions.logger.error(`Error finding/creating opportunity "${opportunityName}":`, error.message);
    throw error;
  }
}

/**
 * Extract entities from email context (rule-based, no external APIs)
 * Uses heuristics to find account/opportunity names from email content, signatures, domains
 */
async function extractEntitiesFromContext(
  email: any,
  content: string,
  createdBy: string,
  cleanedSubject?: string,
  parseSettings?: { subjectTokens: string[] }
): Promise<{ accountId?: string; opportunityId?: string } | null> {
  try {
    const fromEmail = email.from?.email || '';
    const subject = cleanedSubject || email.subject || '';
    const domain = fromEmail.split('@')[1];
    
    if (!domain) return null;
    
    // Try to extract company name from email signature
    // Look for patterns like "Company Name" or "| Company Name" in signature area
    const signaturePatterns = [
      /\|\s*([A-Z][a-zA-Z\s&]+(?:Inc|LLC|Corp|Ltd|Company|Co)\.?)/i,
      /Company:\s*([A-Z][a-zA-Z\s&]+)/i,
      /([A-Z][a-zA-Z\s&]+(?:Inc|LLC|Corp|Ltd|Company|Co)\.?)/i,
    ];
    
    let companyName: string | undefined;
    for (const pattern of signaturePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        companyName = match[1].trim();
        break;
      }
    }
    
    // If no company name found, try to derive from cleaned subject
    if (!companyName) {
      companyName = extractCompanyName(subject, domain, parseSettings);
    }
    
    // Try to find existing account using fuzzy matching
    const accountsRef = db.collection('accounts');
    const allAccountsSnapshot = await accountsRef.get();
    const contextThreshold = await getParsingConfig('context_match_threshold', DEFAULT_CONTEXT_MATCH_THRESHOLD);
    const contextMatchThreshold = await getParsingConfig('context_match_accept_threshold', 0.7);
    
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    
    for (const doc of allAccountsSnapshot.docs) {
      const existingName = doc.data().name || '';
      const similarity = compareTwoStrings(companyName.toLowerCase(), existingName.toLowerCase());
      
      if (similarity >= contextThreshold) { // Lower threshold for context-based matching
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            id: doc.id,
            name: existingName,
            similarity,
          };
        }
      }
    }
    
    let accountId: string;
    if (bestMatch && bestMatch.similarity >= contextMatchThreshold) {
      accountId = bestMatch.id;
      functions.logger.info(`✅ Found account via context: "${companyName}" -> "${bestMatch.name}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
    } else {
      // Create new account from context
      accountId = await findOrCreateAccount(companyName, createdBy, 'context', 0.4);
    }
    
    // Extract opportunity name from subject or content
    let opportunityName = subject.substring(0, 50);
    if (opportunityName.length < 10) {
      opportunityName = `Email Opportunity - ${new Date().toLocaleDateString()}`;
    }
    
    const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'context', 0.4);
    
    return { accountId, opportunityId };
  } catch (error: any) {
    functions.logger.error('Error extracting entities from context:', error.message);
    return null;
  }
}

/**
 * Extract account/opportunity from email metadata (sender email domain, subject, etc.)
 * Enhanced version with improved matching
 */
async function extractFromMetadata(
  email: any,
  createdBy: string,
  cleanedSubject?: string,
  parseSettings?: { subjectTokens: string[] }
): Promise<{ accountId?: string; opportunityId?: string } | null> {
  try {
    const fromEmail = email.from?.email || '';
    const subject = cleanedSubject || email.subject || '';
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
      // Try to extract company name from cleaned subject or create from domain
      const companyName = extractCompanyName(subject, domain, parseSettings);
      const accountId = await findOrCreateAccount(companyName, createdBy, 'metadata', 0.6);
      
      // Create a default opportunity (use cleaned subject)
      const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
      const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'metadata', 0.6);
      
      return { accountId, opportunityId };
    }
    
    const accountId = accountQuery.docs[0].id;
    
    // Try to find or create opportunity for this account (use cleaned subject)
    const opportunityName = `Email Opportunity - ${subject.substring(0, 50)}`;
    const opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'metadata', 0.6);
    
    return { accountId, opportunityId };
  } catch (error: any) {
    functions.logger.error('Error extracting from metadata:', error.message);
    return null;
  }
}

/**
 * Extract company name from subject or use domain
 */
function extractCompanyName(subject: string, domain: string, parseSettings?: { subjectTokens: string[] }): string {
  // Clean subject first to remove tokens like "Fw:", "Re:", etc.
  let cleanedSubject = subject;
  if (parseSettings && parseSettings.subjectTokens.length > 0) {
    cleanedSubject = cleanSubjectLine(subject, parseSettings.subjectTokens);
    functions.logger.info(`🔍 extractCompanyName: Original subject: "${subject}" -> Cleaned: "${cleanedSubject}"`);
  }
  
  // If after cleaning, the subject is empty or too short, use domain
  if (!cleanedSubject || cleanedSubject.trim().length < 3) {
    functions.logger.info(`🔍 extractCompanyName: Cleaned subject too short, using domain: ${domain}`);
    return domain.split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Try to extract company name from cleaned subject
  // First try bracket notation: [Company Name]
  const bracketMatch = cleanedSubject.match(/\[(.+?)\]/);
  if (bracketMatch && bracketMatch[1]) {
    const name = bracketMatch[1].trim();
    // Don't use if it's a token (too short)
    if (name.length >= 3) {
      functions.logger.info(`🔍 extractCompanyName: Found company name in brackets: "${name}"`);
      return name;
    }
  }
  
  // Try pattern like "Company: Name" but require at least 4 characters to avoid short tokens
  // Also check that it doesn't start with common email tokens
  const colonMatch = cleanedSubject.match(/^([A-Z][a-zA-Z\s&]{3,}?):/);
  if (colonMatch && colonMatch[1]) {
    const name = colonMatch[1].trim();
    // Ensure it's not a short token (minimum 4 chars) and doesn't match common email prefixes
    const commonTokens = ['fw', 'fwd', 're', 'fw:', 'fwd:', 're:'];
    const nameLower = name.toLowerCase();
    if (name.length >= 4 && !commonTokens.includes(nameLower)) {
      functions.logger.info(`🔍 extractCompanyName: Found company name before colon: "${name}"`);
      return name;
    }
  }
  
  // If subject starts with a capital letter and has meaningful content, try to extract first meaningful words
  // Skip if it starts with common email patterns
  const trimmedSubject = cleanedSubject.trim();
  if (trimmedSubject.length >= 10) {
    // Try to extract first few words (up to 5 words) as potential company name
    const words = trimmedSubject.split(/\s+/).slice(0, 5);
    if (words.length > 0 && words[0].length >= 3) {
      // Check if first word is not a common token
      const firstWord = words[0].toLowerCase();
      const commonStarters = ['opportunity', 'for', 're', 'fw', 'fwd', 'subject', 'regarding'];
      if (!commonStarters.includes(firstWord)) {
        // Use first 2-3 words as company name
        const potentialName = words.slice(0, Math.min(3, words.length)).join(' ');
        if (potentialName.length >= 4) {
          functions.logger.info(`🔍 extractCompanyName: Extracted from subject start: "${potentialName}"`);
          return potentialName;
        }
      }
    }
  }
  
  // Use domain name as fallback
  const domainName = domain.split('.')[0]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  functions.logger.info(`🔍 extractCompanyName: Using domain as fallback: "${domainName}"`);
  return domainName;
}

/**
 * Extract structured data from email content
 * Returns dates, amounts, action items, and contacts
 */
function extractStructuredData(content: string, subject?: string): {
  dates: Date[];
  amounts: number[];
  actionItems: string[];
  contacts: { emails: string[]; phones: string[]; names: string[] };
} {
  const result = {
    dates: [] as Date[],
    amounts: [] as number[],
    actionItems: [] as string[],
    contacts: {
      emails: [] as string[],
      phones: [] as string[],
      names: [] as string[],
    },
  };

  const searchText = `${subject || ''}\n${content || ''}`;

  // Extract dates (various formats)
  const datePatterns = [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g, // MM/DD/YYYY, DD-MM-YYYY
    /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, // YYYY-MM-DD
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, // January 15, 2024
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi, // January 15
    /\b(deadline|due date|meeting|follow up|by|on|before|after)\s+([^,\n]+)/gi, // "deadline: January 15"
    /\b(today|tomorrow|next week|next month)\b/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = searchText.matchAll(pattern);
    for (const match of matches) {
      try {
        const dateStr = match[0] || match[2] || '';
        if (dateStr.toLowerCase().includes('today')) {
          result.dates.push(new Date());
        } else if (dateStr.toLowerCase().includes('tomorrow')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          result.dates.push(tomorrow);
        } else {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            result.dates.push(parsedDate);
          }
        }
      } catch (e) {
        // Ignore invalid dates
      }
    }
  }

  // Extract amounts (currency values)
  const amountPatterns = [
    /\$[\d,]+(?:\.\d{2})?/g, // $1,000.00
    /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?|usd)\b/gi, // 1,000 USD
    /\b(?:budget|amount|value|deal|contract|price|cost)\s*[:\-]?\s*\$?[\d,]+(?:\.\d{2})?/gi,
  ];

  for (const pattern of amountPatterns) {
    const matches = searchText.matchAll(pattern);
    for (const match of matches) {
      const amountStr = match[0].replace(/[^0-9.]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        result.amounts.push(amount);
      }
    }
  }

  // Extract action items
  const actionPatterns = [
    /(?:Action|TODO|To Do|Task|Follow up|Follow-up|Action Item)[\s:]+([^\n]+)/gi,
    /(?:Please|Kindly|Need to|Should|Must)\s+([^.\n]+)/gi,
    /(?:Reminder|Remember to)\s+([^.\n]+)/gi,
  ];

  for (const pattern of actionPatterns) {
    const matches = searchText.matchAll(pattern);
    for (const match of matches) {
      const actionItem = match[1]?.trim();
      if (actionItem && actionItem.length > 5) {
        result.actionItems.push(actionItem);
      }
    }
  }

  // Extract email addresses (keep original case for filtering)
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatches = searchText.matchAll(emailPattern);
  for (const match of emailMatches) {
    const email = match[0]; // Keep original case
    const emailLower = email.toLowerCase();
    // Check for duplicates case-insensitively
    if (!result.contacts.emails.some(e => e.toLowerCase() === emailLower)) {
      result.contacts.emails.push(email);
    }
  }

  // Extract phone numbers
  const phonePatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // US format
    /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, // (123) 456-7890
    /\b\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International
  ];

  for (const pattern of phonePatterns) {
    const matches = searchText.matchAll(pattern);
    for (const match of matches) {
      const phone = match[0].trim();
      if (!result.contacts.phones.includes(phone)) {
        result.contacts.phones.push(phone);
      }
    }
  }

  // Extract names (simple heuristic: capitalized words that look like names)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const nameMatches = searchText.matchAll(namePattern);
  for (const match of nameMatches) {
    const name = match[1].trim();
    // Filter out common false positives
    if (
      name.length > 3 &&
      !name.match(/^(Best|Regards|Sincerely|Thanks|Thank|Hello|Hi|Dear|Subject|From|To|CC|BCC|Account|Company|Client|Customer|Opportunity|Deal|Project|Engagement|Lead|Action|TODO|Task|Follow|Meeting|Deadline|Due|Date|Amount|Budget|Value|Price|Cost|Contract|Deal)$/i) &&
      !result.contacts.names.includes(name)
    ) {
      result.contacts.names.push(name);
    }
  }

  return result;
}

/**
 * Analyze email for sentiment, urgency, and category
 */
function analyzeEmail(content: string, subject?: string): {
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'high' | 'medium' | 'low';
  category: string;
} {
  const searchText = `${subject || ''}\n${content || ''}`.toLowerCase();

  // Sentiment analysis (keyword-based)
  const positiveWords = ['thank', 'thanks', 'appreciate', 'great', 'excellent', 'wonderful', 'pleased', 'happy', 'excited', 'looking forward', 'glad', 'delighted'];
  const negativeWords = ['sorry', 'apologize', 'disappointed', 'concerned', 'worried', 'unhappy', 'frustrated', 'problem', 'issue', 'error', 'failed', 'unable'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (searchText.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (searchText.includes(word)) negativeCount++;
  }

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount && positiveCount > 0) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount && negativeCount > 0) {
    sentiment = 'negative';
  }

  // Urgency detection
  const urgencyKeywords = {
    high: ['urgent', 'asap', 'as soon as possible', 'immediately', 'emergency', 'critical', 'important', 'deadline', 'due today', 'today'],
    medium: ['soon', 'quickly', 'priority', 'important', 'please respond', 'follow up'],
    low: ['when convenient', 'no rush', 'whenever', 'at your convenience'],
  };

  let urgency: 'high' | 'medium' | 'low' = 'low';
  for (const keyword of urgencyKeywords.high) {
    if (searchText.includes(keyword)) {
      urgency = 'high';
      break;
    }
  }
  if (urgency === 'low') {
    for (const keyword of urgencyKeywords.medium) {
      if (searchText.includes(keyword)) {
        urgency = 'medium';
        break;
      }
    }
  }

  // Category classification
  let category = 'General';
  const categoryPatterns = [
    { pattern: /inquiry|question|ask|information|request/i, category: 'Inquiry' },
    { pattern: /proposal|quote|estimate|pricing|bid/i, category: 'Proposal' },
    { pattern: /follow.?up|following|checking|status/i, category: 'Follow-up' },
    { pattern: /complaint|issue|problem|error|concern/i, category: 'Complaint' },
    { pattern: /support|help|assistance|troubleshoot/i, category: 'Support' },
    { pattern: /meeting|call|schedule|appointment/i, category: 'Meeting' },
    { pattern: /order|purchase|buy|transaction/i, category: 'Order' },
    { pattern: /thank|appreciation|gratitude/i, category: 'Thank You' },
  ];

  for (const { pattern, category: cat } of categoryPatterns) {
    if (pattern.test(searchText)) {
      category = cat;
      break;
    }
  }

  return { sentiment, urgency, category };
}

/**
 * Process a single email
 */
/**
 * Add an audit message to the email document
 */
async function addAuditMessage(
  emailDoc: admin.firestore.DocumentSnapshot,
  status: 'success' | 'failure' | 'skipped' | 'warning' | 'info',
  message: string,
  details?: any
): Promise<void> {
  try {
    const email = emailDoc.data();
    const existingMessages = (email?.auditMessages || []) as any[];
    
    // Filter out undefined values from details to avoid Firestore errors
    let cleanedDetails: any = undefined;
    if (details) {
      cleanedDetails = Object.fromEntries(
        Object.entries(details).filter(([_, value]) => value !== undefined)
      );
      // Only include details if it has at least one property
      if (Object.keys(cleanedDetails).length === 0) {
        cleanedDetails = undefined;
      }
    }
    
    const newMessage = {
      timestamp: admin.firestore.Timestamp.now(),
      status,
      message,
      ...(cleanedDetails && { details: cleanedDetails }),
    };
    
    // Append to existing messages array
    const updatedMessages = [...existingMessages, newMessage];
    
    await emailDoc.ref.update({
      auditMessages: updatedMessages,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  } catch (error: any) {
    functions.logger.warn(`Could not add audit message: ${error.message}`);
  }
}

async function processEmail(emailDoc: admin.firestore.DocumentSnapshot, createdBy: string): Promise<boolean> {
  try {
    const email = emailDoc.data();
    if (!email) {
      await addAuditMessage(emailDoc, 'failure', 'Email data not found');
      return false;
    }
    
    // Skip if already processed
    if (email.processed) {
      await addAuditMessage(emailDoc, 'info', 'Email already processed, skipping');
      return false;
    }
    
    await addAuditMessage(emailDoc, 'info', 'Starting email processing');
    
    // Skip if subject contains "testing"
    const subject = (email.subject || '').toLowerCase();
    if (subject.includes('testing')) {
      functions.logger.info(`⏭️  Skipping email with "testing" in subject: ${email.subject}`);
      await addAuditMessage(emailDoc, 'skipped', 'Email skipped: subject contains "testing"', { subject: email.subject });
      await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
      return false;
    }
    
    // Get email parse settings
    const parseSettings = await getEmailParseSettings();
    
    // Check if this is a forwarded email to CRM mailbox
    let processedEmail = { ...email };
    let originalEmailContent: string | null = null;
    let originalSubject: string | null = null;
    let forwardingWrapperContent: string | null = null; // Content before the forwarded section
    
    if (isForwardedToCrm(email)) {
      functions.logger.info(`📧 Forwarded email to CRM detected: ${email.subject}`);
      
      // Get email content to extract forwarded email info
      const htmlContent = email.body?.html || '';
      const textContent = email.body?.text || '';
      const rawContent = textContent || extractTextFromHtml(htmlContent);
      
      // Find where the forwarded section starts to extract wrapper content
      const separators = [
        /-----Original Message-----/i,
        /-----Forwarded Message-----/i,
        /From:\s/i,
        /^On .* wrote:/m,
      ];
      
      let forwardedSectionStart = rawContent.length;
      for (const separator of separators) {
        const match = rawContent.match(separator);
        if (match && match.index !== undefined && match.index < forwardedSectionStart) {
          forwardedSectionStart = match.index;
        }
      }
      
      // Extract forwarding wrapper content (before the forwarded section)
      if (forwardedSectionStart < rawContent.length) {
        const wrapperContent = rawContent.substring(0, forwardedSectionStart).trim();
        forwardingWrapperContent = wrapperContent;
        functions.logger.info(`📧 Extracted forwarding wrapper content (${wrapperContent.length} chars) - may contain Account:/Opportunity: patterns`);
      }
      
      // Extract original From, To, and content from forwarded email
      const forwardedInfo = extractForwardedEmailInfo(rawContent);
      
      if (forwardedInfo) {
        functions.logger.info(`📧 Extracted forwarded email info:`, {
          originalFrom: forwardedInfo.from,
          originalTo: forwardedInfo.to,
          hasOriginalContent: !!forwardedInfo.originalContent,
        });
        
        // Replace email.from and email.to with extracted values
        if (forwardedInfo.from) {
          processedEmail.from = forwardedInfo.from;
          functions.logger.info(`📧 Using forwarded From: ${forwardedInfo.from.email} (${forwardedInfo.from.name || 'no name'})`);
        }
        
        if (forwardedInfo.to && forwardedInfo.to.length > 0) {
          processedEmail.to = forwardedInfo.to;
          functions.logger.info(`📧 Using forwarded To: ${forwardedInfo.to.join(', ')}`);
        }
        
        // Extract original subject from forwarded email headers
        const subjectMatch = rawContent.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
        if (subjectMatch && subjectMatch[1]) {
          originalSubject = subjectMatch[1].trim();
          functions.logger.info(`📧 Extracted original subject: "${originalSubject}"`);
        }
        
        // Use original email content if extracted, otherwise use cleaned forwarded content
        if (forwardedInfo.originalContent && forwardedInfo.originalContent.length > 50) {
          originalEmailContent = forwardedInfo.originalContent;
          functions.logger.info(`📧 Using original email content (${originalEmailContent.length} chars) instead of forwarded wrapper`);
        } else {
          functions.logger.warn(`⚠️  Could not extract original email content, will use forwarded content`);
        }
      } else {
        functions.logger.warn(`⚠️  Could not extract forwarded email info from content`);
      }
    }
    
    // Clean subject line by removing tokens (Re:, Fwd:, etc.)
    let cleanedSubject = processedEmail.subject || '';
    if (cleanedSubject && parseSettings.subjectTokens.length > 0) {
      cleanedSubject = cleanSubjectLine(cleanedSubject, parseSettings.subjectTokens);
      functions.logger.info(`📝 Cleaned subject: "${processedEmail.subject}" -> "${cleanedSubject}"`);
    }
    
    // Check if email is from internal domain/address (for potential special handling)
    const fromEmail = processedEmail.from?.email || '';
    const fromDomain = fromEmail.split('@')[1]?.toLowerCase();
    const isInternalEmail = 
      (fromDomain && parseSettings.domains.includes(fromDomain)) ||
      parseSettings.emailAddresses.some(addr => addr.toLowerCase() === fromEmail.toLowerCase());
    
    if (isInternalEmail) {
      functions.logger.info(`📧 Internal email detected: ${fromEmail}`);
      // Could add special parsing logic for internal emails here if needed
    }
    
    // Get email content - use original content if this was a forwarded email
    // Get content for analysis (plain text)
    let content: string;
    if (originalEmailContent) {
      // Use the extracted original email content
      content = originalEmailContent;
      functions.logger.info(`📧 Using extracted original email content for analysis`);
    } else {
      // Use normal email content
      const htmlContent = processedEmail.body?.html || '';
      const textContent = processedEmail.body?.text || '';
      content = textContent || extractTextFromHtml(htmlContent);
    }
    
    // Clean content for analysis
    content = cleanEmailContent(content);
    
    // Get HTML content for note storage (preserve formatting)
    // For forwarded emails, use the original HTML content (not the forwarding wrapper)
    let htmlContentForNote: string = '';
    if (originalEmailContent) {
      // For forwarded emails, get the original HTML if available
      // The originalEmailContent is plain text, so we need to find the HTML version
      // Try to extract HTML from the original forwarded section
      const htmlContent = processedEmail.body?.html || '';
      if (htmlContent) {
        // Extract HTML content from the forwarded section (not the wrapper)
        // Look for the forwarded section in HTML
        const forwardedSeparators = [
          /<blockquote[^>]*>[\s\S]*?-----Original Message-----[\s\S]*?<\/blockquote>/i,
          /<div[^>]*>[\s\S]*?-----Original Message-----[\s\S]*?<\/div>/i,
          /-----Original Message-----[\s\S]*/i,
        ];
        
        let forwardedHtmlSection = htmlContent;
        for (const separator of forwardedSeparators) {
          const match = htmlContent.match(separator);
          if (match && match.index !== undefined) {
            // Extract content before the separator (original forwarded email HTML)
            forwardedHtmlSection = htmlContent.substring(0, match.index);
            break;
          }
        }
        
        // If we found a forwarded section, use it; otherwise use the original content as HTML
        if (forwardedHtmlSection !== htmlContent && forwardedHtmlSection.trim().length > 50) {
          htmlContentForNote = forwardedHtmlSection;
        } else {
          // Convert originalEmailContent to HTML (it's plain text)
          htmlContentForNote = originalEmailContent.replace(/\n/g, '<br>');
        }
      } else {
        // No HTML available, convert plain text to HTML
        htmlContentForNote = originalEmailContent.replace(/\n/g, '<br>');
      }
    } else {
      // Prefer HTML, fallback to text
      htmlContentForNote = processedEmail.body?.html || processedEmail.body?.text || '';
    }
    
    // Clean HTML content (remove quoted/replied sections but preserve HTML structure)
    // Do NOT include forwarding wrapper content in the note
    if (htmlContentForNote) {
      htmlContentForNote = cleanEmailContentHtml(htmlContentForNote);
    }
    
    // For thread emails, extract only new content (not the entire thread)
    if (email.threadId) {
      const threadContent = await extractNewThreadContent(content, htmlContentForNote, email.threadId);
      content = threadContent.newContent;
      htmlContentForNote = threadContent.newHtmlContent || htmlContentForNote;
    }
    
    if (!content || content.trim().length < 10) {
      functions.logger.info(`⏭️  Skipping email with insufficient content: ${email.subject}`);
      await addAuditMessage(
        emailDoc, 
        'skipped', 
        'Email skipped: insufficient content after cleaning', 
        { contentLength: content?.trim().length || 0 }
      );
      // Mark as processed to avoid infinite retries
      await emailDoc.ref.update({ 
        processed: true, 
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return false;
    }
    
    // Extract structured data (use cleaned subject)
    // Use processedEmail instead of email for routing
    const extractedData = extractStructuredData(content, cleanedSubject);
    
    // Filter out internal email addresses from extracted contacts
    const internalEmailsLower = parseSettings.emailAddresses.map(e => e.toLowerCase().trim());
    const internalDomainsLower = parseSettings.domains.map(d => d.toLowerCase().trim());
    
    functions.logger.info(`🔍 Email filtering settings:`, {
      internalEmails: internalEmailsLower,
      internalDomains: internalDomainsLower,
      totalExtractedEmails: extractedData.contacts.emails.length,
    });
    
    const originalEmailCount = extractedData.contacts.emails.length;
    const filteredEmails = extractedData.contacts.emails.filter(email => {
      const emailLower = email.toLowerCase().trim();
      const emailDomain = emailLower.split('@')[1]?.toLowerCase();
      
      // Filter out if email is in internal email list (case-insensitive)
      if (internalEmailsLower.includes(emailLower)) {
        functions.logger.info(`🔍 Filtering out internal email: ${email}`);
        return false;
      }
      
      // Filter out if email domain is in internal domains list (case-insensitive)
      if (emailDomain && internalDomainsLower.includes(emailDomain)) {
        functions.logger.info(`🔍 Filtering out email from internal domain: ${email} (domain: ${emailDomain})`);
        return false;
      }
      
      return true;
    });
    
    // Update extractedData with filtered emails
    extractedData.contacts.emails = filteredEmails;
    
    const filteredCount = originalEmailCount - filteredEmails.length;
    if (filteredCount > 0) {
      functions.logger.info(`🔍 Filtered out ${filteredCount} internal email address(es) from extracted contacts`);
    } else if (originalEmailCount > 0) {
      functions.logger.info(`🔍 No internal emails filtered (${originalEmailCount} emails checked)`);
    }
    
    functions.logger.info(`📊 Extracted structured data:`, {
      dates: extractedData.dates.length,
      amounts: extractedData.amounts.length,
      actionItems: extractedData.actionItems.length,
      contacts: {
        emails: extractedData.contacts.emails.length,
        phones: extractedData.contacts.phones.length,
        names: extractedData.contacts.names.length,
      },
      filteredInternalEmails: filteredCount,
    });
    
    // Analyze email (use cleaned subject)
    const analysis = analyzeEmail(content, cleanedSubject);
    functions.logger.info(`📈 Email analysis:`, analysis);
    
    // Debug: Show content being parsed (first 500 chars)
    functions.logger.info(`📄 Email content (first 500 chars) for pattern matching:`, {
      originalSubject: email.subject,
      cleanedSubject: cleanedSubject,
      contentPreview: content.substring(0, 500),
      contentLength: content.length,
    });
    
    // Check if content already processed in thread
    if (await isContentAlreadyProcessed(content, email.threadId)) {
      functions.logger.info(`⏭️  Skipping email - content already processed in thread: ${email.subject}`);
      await addAuditMessage(emailDoc, 'skipped', 'Email skipped: content already processed in thread', { threadId: email.threadId });
      await emailDoc.ref.update({ processed: true, updatedAt: admin.firestore.Timestamp.now() });
      return false;
    }
    
    // Smart routing with confidence scoring
    let accountId: string | undefined;
    let opportunityId: string | undefined;
    let routingMethod: 'pattern' | 'metadata' | 'context' | undefined;
    let routingConfidence = 0;
    
    // Step 1: Try explicit pattern matching (highest confidence)
    // Use cleaned subject for pattern matching
    // For forwarded emails, use the original subject if available
    let subjectForPatternMatching = cleanedSubject;
    if (originalSubject) {
      // Clean the original subject
      const cleanedOriginalSubject = cleanSubjectLine(originalSubject, parseSettings.subjectTokens);
      if (cleanedOriginalSubject && cleanedOriginalSubject !== cleanedSubject) {
        subjectForPatternMatching = cleanedOriginalSubject;
        functions.logger.info(`📧 Using original email subject for pattern matching: "${subjectForPatternMatching}"`);
      }
    }
    
    // For forwarded emails, also search the forwarding wrapper content for patterns
    // The forwarder may have added "Account:" or "Opportunity:" before forwarding
    let contentForPatternMatching = content;
    if (forwardingWrapperContent !== null && forwardingWrapperContent.length > 0) {
      // Combine forwarding wrapper + original content for pattern matching
      // This allows finding patterns in either location
      contentForPatternMatching = `${forwardingWrapperContent}\n\n${content}`;
      functions.logger.info(`📧 Including forwarding wrapper content in pattern matching (${forwardingWrapperContent.length} chars)`);
    }
    
    const routing = parseRoutingPattern(contentForPatternMatching, subjectForPatternMatching);
    functions.logger.info(`🔍 Pattern matching results for email "${cleanedSubject}":`, {
      accountName: routing?.accountName || 'NOT FOUND',
      opportunityName: routing?.opportunityName || 'NOT FOUND',
      hasRouting: !!routing,
    });
    
    if (routing?.accountName) {
      routingMethod = 'pattern';
      routingConfidence = 0.9; // High confidence for explicit patterns
      
      functions.logger.info(`📝 Creating/finding Account with name: "${routing.accountName}"`);
      accountId = await findOrCreateAccount(routing.accountName, createdBy, 'pattern', 0.9);
      functions.logger.info(`✅ Account ID: ${accountId}`);
      await addAuditMessage(emailDoc, 'success', `Account found/created via pattern matching`, { accountId, accountName: routing.accountName });
      
      if (routing.opportunityName) {
        functions.logger.info(`📝 Creating/finding Opportunity with name: "${routing.opportunityName}" for Account: ${accountId}`);
        opportunityId = await findOrCreateOpportunity(routing.opportunityName, accountId, createdBy, 'pattern', 0.9);
        functions.logger.info(`✅ Opportunity ID: ${opportunityId}`);
        await addAuditMessage(emailDoc, 'success', `Opportunity found/created via pattern matching`, { opportunityId, opportunityName: routing.opportunityName });
      } else {
        // Create default opportunity if not specified (use cleaned subject)
        const opportunityName = `Email Opportunity - ${cleanedSubject?.substring(0, 50) || 'New'}`;
        functions.logger.info(`📝 Creating default Opportunity with name: "${opportunityName}" for Account: ${accountId}`);
        opportunityId = await findOrCreateOpportunity(opportunityName, accountId, createdBy, 'pattern', 0.7);
        routingConfidence = 0.7; // Lower confidence when opportunity name not provided
        functions.logger.info(`✅ Opportunity ID: ${opportunityId}`);
        await addAuditMessage(emailDoc, 'success', `Default opportunity created (no name in pattern)`, { opportunityId, opportunityName });
      }
    }
    
    // Step 2: Try metadata-based routing (medium confidence)
    // Only if metadata routing is enabled in apply_routing_methods setting
    if (!accountId) {
      const applyRoutingMethods = await getParsingConfig('apply_routing_methods', ['pattern']);
      const allowedMethods = Array.isArray(applyRoutingMethods) ? applyRoutingMethods : ['pattern'];
      
      functions.logger.info(`🔍 Metadata routing check:`, {
        accountId: accountId || 'undefined',
        applyRoutingMethods: applyRoutingMethods,
        allowedMethods: allowedMethods,
        includesMetadata: allowedMethods.includes('metadata'),
        methodType: typeof applyRoutingMethods,
        isArray: Array.isArray(applyRoutingMethods),
      });
      
      if (allowedMethods.includes('metadata')) {
        routingMethod = 'metadata';
        routingConfidence = 0.6;
        const metadataResult = await extractFromMetadata(processedEmail, createdBy, cleanedSubject, parseSettings);
        if (metadataResult) {
          accountId = metadataResult.accountId;
          opportunityId = metadataResult.opportunityId;
          functions.logger.info(`✅ Metadata-based routing successful: Account ${accountId}, Opportunity ${opportunityId}`);
          await addAuditMessage(emailDoc, 'success', `Account and opportunity found/created via metadata routing`, { accountId, opportunityId });
        } else {
          routingConfidence = 0;
          await addAuditMessage(emailDoc, 'warning', 'Metadata-based routing attempted but no account/opportunity found');
        }
      } else {
        functions.logger.info(`⏭️  Metadata-based routing skipped: not enabled in apply_routing_methods setting`);
        await addAuditMessage(emailDoc, 'info', 'Metadata-based routing skipped: not enabled in apply_routing_methods setting');
      }
    }
    
    // Step 3: Try rule-based entity extraction from context (lower confidence)
    // Only if context routing is enabled in apply_routing_methods setting
    if (!accountId) {
      const applyRoutingMethods = await getParsingConfig('apply_routing_methods', ['pattern']);
      const allowedMethods = Array.isArray(applyRoutingMethods) ? applyRoutingMethods : ['pattern'];
      
      if (allowedMethods.includes('context')) {
        routingMethod = 'context';
        routingConfidence = 0.4;
        const contextResult = await extractEntitiesFromContext(processedEmail, content, createdBy, cleanedSubject, parseSettings);
        if (contextResult) {
          accountId = contextResult.accountId;
          opportunityId = contextResult.opportunityId;
          functions.logger.info(`✅ Context-based routing successful: Account ${accountId}, Opportunity ${opportunityId}`);
          await addAuditMessage(emailDoc, 'success', `Account and opportunity found/created via context-based routing`, { accountId, opportunityId });
        } else {
          routingConfidence = 0;
          await addAuditMessage(emailDoc, 'warning', 'Context-based routing attempted but no account/opportunity found');
        }
      } else {
        functions.logger.info(`⏭️  Context-based routing skipped: not enabled in apply_routing_methods setting`);
        await addAuditMessage(emailDoc, 'info', 'Context-based routing skipped: not enabled in apply_routing_methods setting');
      }
    }
    
    if (!opportunityId) {
      functions.logger.info(`⏭️  Skipping email - could not determine opportunity (no routing method succeeded): ${email.subject}`);
      // Only include routingMethod in details if it's defined (not undefined)
      const details: any = { routingConfidence };
      if (routingMethod) {
        details.routingMethod = routingMethod;
      }
      await addAuditMessage(
        emailDoc, 
        'failure', 
        'Email processing failed: Could not determine opportunity (no routing method succeeded)', 
        details
      );
      // Update email with analysis even if not processed
      await emailDoc.ref.update({
        extractedData: {
          dates: extractedData.dates.map(d => admin.firestore.Timestamp.fromDate(d)),
          amounts: extractedData.amounts,
          actionItems: extractedData.actionItems,
          contacts: extractedData.contacts,
        },
        analysis,
        routingConfidence: 0,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return false;
    }
    
    // Update opportunity with extracted amount if found
    if (extractedData.amounts.length > 0 && opportunityId) {
      const maxAmount = Math.max(...extractedData.amounts);
      try {
        await db.collection('opportunities').doc(opportunityId).update({
          amount: maxAmount,
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`💰 Updated opportunity ${opportunityId} with amount: $${maxAmount}`);
        await addAuditMessage(emailDoc, 'success', `Updated opportunity with extracted amount`, { opportunityId, amount: maxAmount });
      } catch (error: any) {
        functions.logger.warn(`Could not update opportunity amount: ${error.message}`);
        await addAuditMessage(emailDoc, 'warning', `Failed to update opportunity amount`, { error: error.message });
      }
    }
    
    // Create tasks from action items
    let tasksCreated = 0;
    if (extractedData.actionItems.length > 0 && opportunityId) {
      const tasksRef = db.collection('tasks');
      for (const actionItem of extractedData.actionItems.slice(0, 5)) { // Limit to 5 tasks per email
        try {
          await tasksRef.add({
            title: actionItem.substring(0, 200), // Truncate if too long
            description: `Action item from email: ${email.subject}`,
            status: 'not_started',
            priority: analysis.urgency === 'high' ? 'high' : analysis.urgency === 'medium' ? 'medium' : 'low',
            opportunityId,
            accountId,
            createdBy,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          });
          functions.logger.info(`✅ Created task from action item: ${actionItem.substring(0, 50)}`);
          tasksCreated++;
        } catch (error: any) {
          functions.logger.warn(`Could not create task from action item: ${error.message}`);
          await addAuditMessage(emailDoc, 'warning', `Failed to create task from action item`, { actionItem: actionItem.substring(0, 50), error: error.message });
        }
      }
      if (tasksCreated > 0) {
        await addAuditMessage(emailDoc, 'success', `Created ${tasksCreated} task(s) from action items`, { tasksCreated, totalActionItems: extractedData.actionItems.length });
      }
    }
    
    // Create note with email content (preserve HTML formatting)
    // Do NOT include forwarding wrapper content (Account:/Opportunity: patterns) in the note
    const emailHeader = `<p><strong>Email from</strong> ${processedEmail.from?.name || processedEmail.from?.email || 'Unknown'}</p>`;
    let noteContent = '';
    
    if (htmlContentForNote && htmlContentForNote.trim().length > 0) {
      // Use HTML content (already cleaned, forwarding wrapper removed)
      noteContent = `${emailHeader}\n${htmlContentForNote}`;
    } else if (content && content.trim().length > 0) {
      // Fallback to plain text converted to HTML
      noteContent = `${emailHeader}\n<p>${content.replace(/\n/g, '<br>')}</p>`;
    } else {
      // Minimal content
      noteContent = emailHeader;
    }
    
    const noteData = {
      content: noteContent,
      opportunityId,
      accountId,
      createdBy,
      source: 'email', // Mark as created from email processing
      emailId: emailDoc.id, // Store email ID for direct lookup (avoids reverse query issues)
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    const noteRef = await db.collection('notes').add(noteData);
    const noteId = noteRef.id;
    
    // Update email record with all extracted data and analysis
    await emailDoc.ref.update({
      processed: true,
      linkedTo: {
        accountId,
        opportunityId,
        noteId,
        parentType: 'opportunity',
      },
      extractedData: {
        dates: extractedData.dates.map(d => admin.firestore.Timestamp.fromDate(d)),
        amounts: extractedData.amounts,
        actionItems: extractedData.actionItems,
        contacts: extractedData.contacts,
      },
      analysis,
      routingConfidence,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    
    // Add final success audit message
    await addAuditMessage(
      emailDoc, 
      'success', 
      'Email processing completed successfully', 
      {
        accountId,
        opportunityId,
        noteId,
        routingMethod,
        routingConfidence: (routingConfidence * 100).toFixed(0) + '%',
        tasksCreated,
        extractedDataCounts: {
          dates: extractedData.dates.length,
          amounts: extractedData.amounts.length,
          actionItems: extractedData.actionItems.length,
        }
      }
    );
    
    functions.logger.info(`✅ Processed email: ${email.subject} -> Opportunity ${opportunityId}, Note ${noteId} (routing: ${routingMethod}, confidence: ${(routingConfidence * 100).toFixed(0)}%)`);
    return true;
  } catch (error: any) {
    functions.logger.error(`Error processing email ${emailDoc.id}:`, error.message);
    await addAuditMessage(
      emailDoc, 
      'failure', 
      `Email processing failed with error: ${error.message}`, 
      { error: error.message, stack: error.stack }
    );
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


