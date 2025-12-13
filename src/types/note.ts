// Note entity - can be associated with Account, Contact, or Opportunity
export interface Note {
  id: string;
  content: string;                    // Note content/text (can be HTML for rich text)
  attachments?: NoteAttachment[];     // Optional: File attachments
  accountId?: string;                 // Optional: Associated with Account
  contactId?: string;                 // Optional: Associated with Contact
  opportunityId?: string;             // Optional: Associated with Opportunity
  isPrivate?: boolean;                 // Private notes (only visible to creator)
  createdBy: string;                  // User UID who created the note
  source?: string;                     // Source of creation (e.g., 'email', 'import', 'manual')
  emailId?: string;                    // ID of the inbound email if note was created from email
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteAttachment {
  id: string;                         // Unique identifier for the attachment
  name: string;                       // Original file name
  url: string;                        // Firebase Storage URL
  size: number;                       // File size in bytes
  type: string;                       // MIME type (e.g., 'image/png', 'application/pdf')
  uploadedAt: Date;                   // Upload timestamp
}

export type NoteFormData = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

