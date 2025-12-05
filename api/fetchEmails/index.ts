import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
let db: any;
try {
  if (getApps().length === 0) {
    let serviceAccount = null;
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (existsSync(keyPath)) {
        serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
      }
    } else {
      const defaultPath = join(process.cwd(), 'scripts', 'serviceAccountKey.json');
      if (existsSync(defaultPath)) {
        serviceAccount = JSON.parse(readFileSync(defaultPath, 'utf8'));
      }
    }
    
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || serviceAccount.project_id
      });
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      if (projectId) {
        initializeApp({ projectId });
      } else {
        initializeApp();
      }
    }
  }
  
  db = getFirestore();
} catch (error: any) {
  console.error('Error initializing Firebase Admin:', error.message);
  throw error;
}

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
      return gmail;
    }

    // Try OAuth2 approach as fallback
    if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
      const oauth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      oauth2Client.setCredentials({
        refresh_token: GMAIL_REFRESH_TOKEN,
      });

      await oauth2Client.getAccessToken();
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      return gmail;
    }

    throw new Error('No Gmail authentication credentials found.');
  } catch (error: any) {
    throw new Error(`Error initializing Gmail client: ${error.message}`);
  }
}

function getHeaderValue(headers: Array<{ name: string; value: string }>, name: string): string | undefined {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function parseEmailAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(addr => {
    const match = addr.match(/<(.+)>/);
    return match ? match[1] : addr.trim();
  });
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

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
    // Check mimeType from payload if available, or try to infer
    const contentType = payload.parts?.[0]?.mimeType || 'text/plain';
    if (contentType === 'text/plain') {
      body.text = decodeBase64Url(payload.body.data);
    } else if (contentType === 'text/html') {
      body.html = decodeBase64Url(payload.body.data);
    }
  }

  if (payload.parts) {
    payload.parts.forEach(extractFromPart);
  }

  return body;
}

async function emailExists(messageId: string): Promise<boolean> {
  try {
    const emailsRef = db.collection('inboundEmails');
    const query = emailsRef.where('messageId', '==', messageId).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    return false;
  }
}

async function storeEmail(gmailMessage: GmailMessage, body: { text?: string; html?: string }): Promise<void> {
  try {
    const headers = gmailMessage.payload.headers;
    const fromHeader = getHeaderValue(headers, 'From') || '';
    const toHeader = getHeaderValue(headers, 'To') || '';
    const ccHeader = getHeaderValue(headers, 'Cc');
    const bccHeader = getHeaderValue(headers, 'Bcc');
    const subject = getHeaderValue(headers, 'Subject') || '';
    const dateHeader = getHeaderValue(headers, 'Date');

    const fromMatch = fromHeader.match(/(.+?)\s*<(.+)>/);
    const from = {
      email: fromMatch ? fromMatch[2] : fromHeader,
      name: fromMatch ? fromMatch[1].replace(/"/g, '') : undefined,
    };

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

    await db.collection('inboundEmails').add(emailData);
  } catch (error: any) {
    throw new Error(`Error storing email: ${error.message}`);
  }
}

async function fetchNewEmails() {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    q: 'is:unread OR in:inbox',
  });

  const messages = response.data.messages || [];
  
  if (messages.length === 0) {
    return { stored: 0, skipped: 0 };
  }

  let stored = 0;
  let skipped = 0;

  for (const message of messages) {
    try {
      if (await emailExists(message.id!)) {
        skipped++;
        continue;
      }

      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const gmailMessage = messageResponse.data as GmailMessage;
      const body = extractEmailBody(gmailMessage.payload);
      await storeEmail(gmailMessage, body);
      stored++;
    } catch (error: any) {
      console.error(`Error processing message ${message.id}:`, error.message);
    }
  }

  return { stored, skipped };
}

// Azure Function entry point (HTTP trigger for Static Web Apps compatibility)
// This function can be called via HTTP and scheduled using GitHub Actions
module.exports = async function (req: any, context: any): Promise<any> {
  const timeStamp = new Date().toISOString();
  context.log(`Email fetch HTTP trigger called at ${timeStamp}`);

  // Optional: Add authentication check here
  // const authHeader = req.headers['x-functions-key'];
  // if (authHeader !== process.env.FUNCTION_KEY) {
  //   return { status: 401, body: 'Unauthorized' };
  // }

  try {
    // Validate environment variables
    const missingVars: string[] = [];
    if (!GMAIL_CLIENT_ID && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      missingVars.push('GMAIL_CLIENT_ID or GOOGLE_APPLICATION_CREDENTIALS');
    }
    if (!GMAIL_CLIENT_SECRET && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      missingVars.push('GMAIL_CLIENT_SECRET or GOOGLE_APPLICATION_CREDENTIALS');
    }
    if (!GMAIL_REFRESH_TOKEN && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      missingVars.push('GMAIL_REFRESH_TOKEN or GOOGLE_APPLICATION_CREDENTIALS');
    }

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      context.log.error(errorMsg);
      return {
        status: 500,
        body: {
          success: false,
          error: errorMsg,
          hint: 'Please configure Gmail API credentials in Azure Application Settings',
          timestamp: timeStamp
        }
      };
    }

    // Check Firebase initialization
    if (!db) {
      const errorMsg = 'Firebase Admin not initialized';
      context.log.error(errorMsg);
      return {
        status: 500,
        body: {
          success: false,
          error: errorMsg,
          hint: 'Check FIREBASE_ADMIN_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS in Azure Application Settings',
          timestamp: timeStamp
        }
      };
    }

    context.log('Starting email fetch...');
    const result = await fetchNewEmails();
    context.log(`✅ Email fetch complete! Stored: ${result.stored}, Skipped: ${result.skipped}`);
    
    return {
      status: 200,
      body: {
        success: true,
        message: 'Email fetch completed',
        stored: result.stored,
        skipped: result.skipped,
        timestamp: timeStamp
      }
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    const errorStack = error.stack || '';
    context.log.error(`❌ Error fetching emails: ${errorMsg}`);
    context.log.error(`Stack trace: ${errorStack}`);
    
    return {
      status: 500,
      body: {
        success: false,
        error: errorMsg,
        timestamp: timeStamp
      }
    };
  }
};

