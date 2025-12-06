/**
 * Firebase Cloud Function to fetch emails from Gmail and store them in Firestore
 * 
 * This function can be:
 * - Called via HTTP (onRequest)
 * - Scheduled using Firebase Scheduler (onSchedule)
 * - Triggered manually from Firebase Console
 * 
 * Environment variables required (set in Firebase Functions config):
 * - GMAIL_USER_EMAIL: Email address to fetch from (default: crm@infogloballink.com)
 * - GOOGLE_SERVICE_ACCOUNT_KEY: Service account key JSON (recommended)
 * OR
 * - GMAIL_CLIENT_ID: OAuth2 client ID
 * - GMAIL_CLIENT_SECRET: OAuth2 client secret
 * - GMAIL_REFRESH_TOKEN: OAuth2 refresh token
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { processEmail } from './processEmails';

// Firebase Admin is already initialized in index.ts
const db = admin.firestore();

// Configure function with secrets access
// For v1 functions, we need to use runWith to access secrets
// However, v1 functions can access secrets via process.env if they're set as environment variables
// Let's try to access via both methods

// Note: These are set at function invocation time to access runtime config
// For v1 functions, secrets set via functions:secrets:set are not automatically available
// We'll access them dynamically in the function handler

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

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
}

/**
 * Initialize Gmail API client
 */
async function getGmailClient(gmailUserEmail?: string) {
  try {
    // Get Gmail user email (passed from function handler or use default)
    const userEmail = gmailUserEmail || process.env.GMAIL_USER_EMAIL || 
                     functions.config().gmail?.user_email || 
                     'crm@infogloballink.com';
    
    // Option 1: Service account key from environment variable (recommended)
    const serviceAccountKeyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 
                                  process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKeyEnv && serviceAccountKeyEnv.trim().length > 0) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKeyEnv.trim());
        
        if (!serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('Service account key missing required fields (client_email or private_key)');
        }
        
        const jwtClient = new google.auth.JWT(
          serviceAccount.client_email,
          undefined,
          serviceAccount.private_key,
          ['https://www.googleapis.com/auth/gmail.readonly'],
          userEmail
        );

        await jwtClient.authorize();
        const gmail = google.gmail({ version: 'v1', auth: jwtClient });
        functions.logger.info('✅ Service account authentication successful');
        return gmail;
      } catch (parseError: any) {
        functions.logger.warn('Failed to parse service account key from environment variable:', parseError.message);
      }
    }

    // Option 2: OAuth2 approach as fallback
    const gmailClientId = process.env.GMAIL_CLIENT_ID;
    const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
    const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
    
    if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        gmailClientId,
        gmailClientSecret,
        'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
      );

      oauth2Client.setCredentials({
        refresh_token: gmailRefreshToken,
      });

      await oauth2Client.getAccessToken();
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      functions.logger.info('✅ OAuth2 authentication successful');
      return gmail;
    }

    throw new Error('No Gmail authentication credentials found. Please set up OAuth2 or service account.');
  } catch (error: any) {
    functions.logger.error('Error initializing Gmail client:', error.message);
    throw error;
  }
}

/**
 * Get header value from email headers
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
    // Single part message - try to infer from first part or default to text/plain
    const inferredMimeType = payload.parts?.[0]?.mimeType || 'text/plain';
    if (inferredMimeType === 'text/plain') {
      body.text = decodeBase64Url(payload.body.data);
    } else if (inferredMimeType === 'text/html') {
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
function extractAttachments(
  messageId: string,
  payload: GmailMessage['payload']
): EmailAttachment[] {
  const attachments: EmailAttachment[] = [];

  function extractFromPart(part: any, index: number | string) {
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
    functions.logger.error('Error checking if email exists:', error);
    return false;
  }
}

/**
 * Store email in Firestore
 */
async function storeEmail(
  gmailMessage: GmailMessage,
  body: { text?: string; html?: string },
  attachments: EmailAttachment[]
): Promise<void> {
  try {
    const headers = gmailMessage.payload.headers;
    const fromHeader = getHeaderValue(headers, 'From') || '';
    const toHeader = getHeaderValue(headers, 'To') || '';
    const ccHeader = getHeaderValue(headers, 'Cc');
    const bccHeader = getHeaderValue(headers, 'Bcc');
    const subject = getHeaderValue(headers, 'Subject') || '';
    const dateHeader = getHeaderValue(headers, 'Date');

    // Skip emails with "testing" in subject
    if (subject.toLowerCase().includes('testing')) {
      functions.logger.info(`⏭️  Skipping email with "testing" in subject: ${subject}`);
      return; // Don't store the email
    }

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
      receivedAt: admin.firestore.Timestamp.fromDate(receivedAt),
      read: !gmailMessage.labelIds.includes('UNREAD'),
      processed: false,
      labels: gmailMessage.labelIds,
      snippet: gmailMessage.snippet,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (ccHeader) emailData.cc = parseEmailAddresses(ccHeader);
    if (bccHeader) emailData.bcc = parseEmailAddresses(bccHeader);
    if (attachments.length > 0) emailData.attachments = attachments;

    await db.collection('inboundEmails').add(emailData);
    functions.logger.info(`✅ Stored email: ${subject} from ${from.email}`);
  } catch (error: any) {
    functions.logger.error('Error storing email:', error.message);
    throw error;
  }
}

/**
 * Fetch new emails from Gmail
 */
async function fetchNewEmails(gmailUserEmail?: string): Promise<{ stored: number; skipped: number }> {
  try {
    const userEmail = gmailUserEmail || process.env.GMAIL_USER_EMAIL || 
                     functions.config().gmail?.user_email || 
                     'crm@infogloballink.com';
    functions.logger.info(`📧 Fetching emails from ${userEmail}...`);

    const gmail = await getGmailClient(userEmail);

    // Get list of messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50, // Adjust as needed
      q: 'is:unread OR in:inbox', // Fetch unread or inbox emails
    });

    const messages = response.data.messages || [];
    functions.logger.info(`Found ${messages.length} messages to process`);

    if (messages.length === 0) {
      functions.logger.info('No new messages found.');
      return { stored: 0, skipped: 0 };
    }

    let stored = 0;
    let skipped = 0;

    // Process each message
    for (const message of messages) {
      try {
        // Check if email already exists
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
        const body = extractEmailBody(gmailMessage.payload);
        const attachments = extractAttachments(gmailMessage.id, gmailMessage.payload);

        await storeEmail(gmailMessage, body, attachments);
        stored++;
        
        // Process the email immediately after storing
        try {
          // Get admin user ID for processing
          const usersRef = db.collection('users');
          const adminQuery = await usersRef
            .where('role', '==', 'admin')
            .where('isActive', '==', true)
            .limit(1)
            .get();
          
          const adminUserId = adminQuery.empty ? 'system' : adminQuery.docs[0].id;
          
          // Find the email document we just created
          const emailQuery = await db.collection('inboundEmails')
            .where('messageId', '==', gmailMessage.id)
            .limit(1)
            .get();
          
          if (!emailQuery.empty) {
            await processEmail(emailQuery.docs[0], adminUserId);
          }
        } catch (processError: any) {
          functions.logger.warn(`Could not process email ${gmailMessage.id}:`, processError.message);
          // Don't fail the whole operation if processing fails
        }
      } catch (error: any) {
        functions.logger.error(`Error processing message ${message.id}:`, error.message);
      }
    }

    functions.logger.info(`✅ Email fetch complete! Stored: ${stored}, Skipped: ${skipped}`);
    return { stored, skipped };
  } catch (error: any) {
    functions.logger.error('❌ Error fetching emails:', error.message);
    throw error;
  }
}

/**
 * HTTP-triggered Firebase Cloud Function
 * Can be called via: https://<region>-<project-id>.cloudfunctions.net/fetchEmails
 */
export const fetchEmails = functions.https.onRequest(async (req, res) => {
  const timestamp = new Date().toISOString();
  functions.logger.info(`Email fetch HTTP trigger called at ${timestamp}`);

  // Optional: Add authentication check here
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.FUNCTION_SECRET}`) {
  //   res.status(401).json({ error: 'Unauthorized' });
  //   return;
  // }

  try {
    // Validate environment variables
    const missingVars: string[] = [];
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const hasServiceAccount = !!(serviceAccountKey && serviceAccountKey.trim().length > 0);
    const hasOAuth2 = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);

    if (!hasServiceAccount && !hasOAuth2) {
      missingVars.push('GOOGLE_SERVICE_ACCOUNT_KEY (or FIREBASE_SERVICE_ACCOUNT_KEY) OR GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
    }

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      functions.logger.error(errorMsg);
      res.status(500).json({
        success: false,
        error: errorMsg,
        hint: 'Please configure Gmail API credentials in Firebase Functions environment variables',
        timestamp: timestamp
      });
      return;
    }

    // Get Gmail user email from config or env
    const gmailUserEmail = process.env.GMAIL_USER_EMAIL || 
                          functions.config().gmail?.user_email || 
                          'crm@infogloballink.com';
    
    functions.logger.info('Starting email fetch...');
    const result = await fetchNewEmails(gmailUserEmail);
    
    res.status(200).json({
      success: true,
      message: 'Email fetch completed',
      stored: result.stored,
      skipped: result.skipped,
      timestamp: timestamp
    });
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    functions.logger.error(`❌ Error fetching emails: ${errorMsg}`);
    
    res.status(500).json({
      success: false,
      error: errorMsg,
      timestamp: timestamp
    });
  }
});

/**
 * Scheduled Firebase Cloud Function (optional)
 * Uncomment and configure in Firebase Console > Functions > Scheduler
 * Example: Run every 15 minutes
 */
// export const fetchEmailsScheduled = functions.pubsub.schedule('*/15 * * * *').onRun(async (context) => {
//   functions.logger.info('Scheduled email fetch triggered');
//   try {
//     const result = await fetchNewEmails();
//     functions.logger.info(`Scheduled fetch complete: Stored ${result.stored}, Skipped ${result.skipped}`);
//     return null;
//   } catch (error: any) {
//     functions.logger.error('Scheduled email fetch failed:', error.message);
//     throw error;
//   }
// });

