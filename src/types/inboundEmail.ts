// Inbound Email entity - emails received in the CRM mailbox
export interface InboundEmail {
  id: string;
  messageId: string;                    // Gmail message ID
  threadId?: string;                    // Gmail thread ID
  from: {
    email: string;                      // Sender email address
    name?: string;                      // Sender display name
  };
  to: string[];                         // Recipient email addresses
  cc?: string[];                        // CC email addresses
  bcc?: string[];                       // BCC email addresses
  subject: string;                      // Email subject
  body: {
    text?: string;                      // Plain text body
    html?: string;                      // HTML body
  };
  attachments?: EmailAttachment[];      // Email attachments
  receivedAt: Date;                     // When email was received
  read: boolean;                        // Whether email has been read
  processed: boolean;                   // Whether email has been processed/linked to records
  linkedTo?: {
    accountId?: string;                 // Linked account ID
    contactId?: string;                 // Linked contact ID
    opportunityId?: string;              // Linked opportunity ID
    noteId?: string;                     // Linked note ID (if converted to note)
    parentType?: 'opportunity' | 'account' | 'contact';  // Parent entity type this email is attached to
  };
  labels?: string[];                    // Gmail labels
  snippet?: string;                     // Email snippet/preview
  createdBy?: string;                   // User who processed/linked the email
  createdAt: Date;                      // When record was created in CRM
  updatedAt: Date;                      // When record was last updated
}

export interface EmailAttachment {
  id: string;                          // Attachment ID
  filename: string;                    // Original filename
  mimeType: string;                    // MIME type
  size: number;                         // Size in bytes
  attachmentId?: string;               // Gmail attachment ID
  url?: string;                         // URL if stored in Firebase Storage
  storedAt?: Date;                     // When attachment was stored
}

export type InboundEmailFormData = Omit<InboundEmail, 'id' | 'createdAt' | 'updatedAt'>;

