/**
 * Fetch and store incoming emails from Gmail
 * 
 * This script polls Gmail API for new emails and stores them in Firestore
 * 
 * Usage:
 *   npx tsx scripts/fetch-gmail-emails.ts
 * 
 * Requirements:
 *   1. Google Cloud Project with Gmail API enabled
 *   2. Service account with Gmail API access OR OAuth2 credentials
 *   3. Environment variables:
 *      - GMAIL_CLIENT_ID (for OAuth2)
 *      - GMAIL_CLIENT_SECRET (for OAuth2)
 *      - GMAIL_REFRESH_TOKEN (for OAuth2)
 *      - GMAIL_USER_EMAIL (crm@infogloballink.com)
 * 
 * For service account approach:
 *   - Use domain-wide delegation
 *   - Set GOOGLE_APPLICATION_CREDENTIALS to service account key
 */

import 'dotenv/config';
import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import type { InboundEmail, EmailAttachment } from '../src/types/inboundEmail.js';

const GMAIL_USER_EMAIL = process.env.GMAIL_USER_EMAIL || 'crm@infogloballink.com';
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: {
      data?: string;
      size?: number;
    };
    parts?: Array<{
      mimeType: string;
      body: {
        data?: string;
        size?: number;
        attachmentId?: string;
      };
      filename?: string;
      headers?: Array<{ name: string; value: string }>;
      parts?: any[];
    }>;
  };
  sizeEstimate: number;
}

/**
 * Initialize Gmail API client
 */
async function getGmailClient() {
  try {
    // Try service account with domain-wide delegation first (recommended for production)
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      join(process.cwd(), 'scripts', 'serviceAccountKey.json');

    if (existsSync(serviceAccountPath)) {
      console.log('   Using service account with domain-wide delegation...');
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        undefined,
        serviceAccount.private_key,
        ['https://www.googleapis.com/auth/gmail.readonly'],
        GMAIL_USER_EMAIL
      );

      await jwtClient.authorize();
      const gmail = google.gmail({ version: 'v1', auth: jwtClient });
      console.log('   ✅ Service account authentication successful\n');
      return gmail;
    }

    // Try OAuth2 approach as fallback
    if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
      console.log('   Using OAuth2 credentials...');
      const oauth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
      );

      oauth2Client.setCredentials({
        refresh_token: GMAIL_REFRESH_TOKEN,
      });

      // Test the credentials
      try {
        await oauth2Client.getAccessToken();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        console.log('   ✅ OAuth2 authentication successful\n');
        return gmail;
      } catch (oauthError: any) {
        console.error('   ❌ OAuth2 authentication failed:', oauthError.message);
        console.error('\n   To fix OAuth2 issues:');
        console.error('   1. Verify GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are correct');
        console.error('   2. Generate a new refresh token using OAuth2 Playground');
        console.error('   3. Ensure the OAuth2 client type matches (Desktop app vs Web app)');
        console.error('   4. Or use service account with domain-wide delegation instead\n');
        throw oauthError;
      }
    }

    throw new Error('No Gmail authentication credentials found. Please set up OAuth2 or service account.');
  } catch (error: any) {
    if (error.message && !error.message.includes('No Gmail authentication')) {
      console.error('Error initializing Gmail client:', error.message);
    }
    throw error;
  }
}

/**
 * Get email address from headers
 */
function getHeaderValue(headers: Array<{ name: string; value: string }>, name: string): string | undefined {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

/**
 * Parse email addresses from header value
 */
function parseEmailAddresses(value: string | undefined): string[] {
  if (!value) return [];
  // Simple parsing - can be enhanced
  return value.split(',').map(addr => {
    const match = addr.match(/<(.+)>/);
    return match ? match[1] : addr.trim();
  });
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/**
 * Extract email body from message payload
 */
function extractEmailBody(payload: GmailMessage['payload']): { text?: string; html?: string } {
  const body: { text?: string; html?: string } = {};

  function extractFromPart(part: any) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body.text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      body.html = decodeBase64Url(part.body.data);
    }

    if (part.parts) {
      part.parts.forEach((p: any) => extractFromPart(p));
    }
  }

  if (payload.body?.data) {
    // Single part message
    if (payload.mimeType === 'text/plain') {
      body.text = decodeBase64Url(payload.body.data);
    } else if (payload.mimeType === 'text/html') {
      body.html = decodeBase64Url(payload.body.data);
    }
  }

  if (payload.parts) {
    payload.parts.forEach(extractFromPart);
  }

  return body;
}

/**
 * Extract attachments from message payload
 */
async function extractAttachments(
  gmail: any,
  messageId: string,
  payload: GmailMessage['payload']
): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];

  function extractFromPart(part: any, index: number) {
    if (part.body?.attachmentId && part.filename) {
      attachments.push({
        id: `${messageId}-${index}`,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }

    if (part.parts) {
      part.parts.forEach((p: any, i: number) => extractFromPart(p, `${index}-${i}`));
    }
  }

  if (payload.parts) {
    payload.parts.forEach((part: any, index: number) => extractFromPart(part, index));
  }

  return attachments;
}

/**
 * Check if email already exists in database
 */
async function emailExists(messageId: string): Promise<boolean> {
  try {
    const emailsRef = db.collection('inboundEmails');
    const query = emailsRef.where('messageId', '==', messageId).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking if email exists:', error);
    return false;
  }
}

/**
 * Store email in Firestore
 */
async function storeEmail(gmailMessage: GmailMessage, body: { text?: string; html?: string }, attachments: EmailAttachment[]): Promise<void> {
  try {
    const headers = gmailMessage.payload.headers;
    const fromHeader = getHeaderValue(headers, 'From') || '';
    const toHeader = getHeaderValue(headers, 'To') || '';
    const ccHeader = getHeaderValue(headers, 'Cc');
    const bccHeader = getHeaderValue(headers, 'Bcc');
    const subject = getHeaderValue(headers, 'Subject') || '';
    const dateHeader = getHeaderValue(headers, 'Date');

    // Parse sender
    const fromMatch = fromHeader.match(/(.+?)\s*<(.+)>/);
    const from = {
      email: fromMatch ? fromMatch[2] : fromHeader,
      name: fromMatch ? fromMatch[1].replace(/"/g, '') : undefined,
    };

    // Parse date
    const receivedAt = dateHeader ? new Date(dateHeader) : new Date();

    const emailData: any = {
      messageId: gmailMessage.id,
      threadId: gmailMessage.threadId,
      from: from,
      to: parseEmailAddresses(toHeader),
      subject: subject,
      body: body,
      receivedAt: Timestamp.fromDate(receivedAt),
      read: !gmailMessage.labelIds.includes('UNREAD'),
      processed: false,
      labels: gmailMessage.labelIds,
      snippet: gmailMessage.snippet,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    if (ccHeader) emailData.cc = parseEmailAddresses(ccHeader);
    if (bccHeader) emailData.bcc = parseEmailAddresses(bccHeader);
    if (attachments.length > 0) emailData.attachments = attachments;

    await db.collection('inboundEmails').add(emailData);
    console.log(`✅ Stored email: ${subject} from ${from.email}`);
  } catch (error: any) {
    console.error('Error storing email:', error.message);
    throw error;
  }
}

/**
 * Fetch new emails from Gmail
 */
async function fetchNewEmails() {
  try {
    console.log(`\n📧 Fetching emails from ${GMAIL_USER_EMAIL}...\n`);

    const gmail = await getGmailClient();

    // Get list of messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50, // Adjust as needed
      q: 'is:unread OR in:inbox', // Fetch unread or inbox emails
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} messages to process\n`);

    if (messages.length === 0) {
      console.log('No new messages found.\n');
      return;
    }

    let stored = 0;
    let skipped = 0;

    // Process each message
    for (const message of messages) {
      try {
        // Check if already stored
        if (await emailExists(message.id!)) {
          skipped++;
          continue;
        }

        // Get full message details
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const gmailMessage = messageResponse.data as GmailMessage;

        // Extract body
        const body = extractEmailBody(gmailMessage.payload);

        // Extract attachments
        const attachments = await extractAttachments(gmail, message.id!, gmailMessage.payload);

        // Store in Firestore
        await storeEmail(gmailMessage, body, attachments);

        stored++;
      } catch (error: any) {
        console.error(`Error processing message ${message.id}:`, error.message);
      }
    }

    console.log(`\n✅ Email fetch complete!`);
    console.log(`   📧 Stored: ${stored}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipped}\n`);
  } catch (error: any) {
    console.error('\n❌ Error fetching emails:', error.message);
    
    if (error.message.includes('unauthorized_client') || error.message.includes('invalid_grant')) {
      console.error('\nOAuth2 Authentication Issue:');
      console.error('The OAuth2 credentials are invalid or expired.');
      console.error('\nSolutions:');
      console.error('1. Remove OAuth2 env vars and use Service Account instead (recommended):');
      console.error('   - Unset GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
      console.error('   - Set up domain-wide delegation in Google Workspace Admin');
      console.error('   - See scripts/GMAIL_SETUP.md for detailed instructions');
      console.error('\n2. Or fix OAuth2 credentials:');
      console.error('   - Generate new refresh token using OAuth2 Playground');
      console.error('   - Ensure client type matches (Desktop app vs Web app)');
      console.error('   - Verify scopes include: https://www.googleapis.com/auth/gmail.readonly');
    } else if (error.message.includes('insufficient permission') || error.message.includes('403')) {
      console.error('\nPermission Issue:');
      console.error('The service account needs domain-wide delegation for Gmail API.');
      console.error('\nTo fix:');
      console.error('1. Go to Google Workspace Admin Console');
      console.error('2. Security > API Controls > Domain-wide Delegation');
      console.error('3. Add your service account Client ID');
      console.error('4. Add scope: https://www.googleapis.com/auth/gmail.readonly');
      console.error('5. See scripts/GMAIL_SETUP.md for detailed instructions');
    } else {
      console.error('\nGeneral troubleshooting:');
      console.error('1. Ensure Gmail API is enabled in Google Cloud Console');
      console.error('2. Verify GMAIL_USER_EMAIL is set correctly (currently: ' + GMAIL_USER_EMAIL + ')');
      console.error('3. Check service account has domain-wide delegation enabled');
      console.error('4. See scripts/GMAIL_SETUP.md for detailed setup instructions');
    }
    throw error;
  }
}

// Main execution
fetchNewEmails()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

