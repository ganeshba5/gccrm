// Note entity - can be associated with Account, Contact, or Opportunity
export interface Note {
  id: string;
  content: string;                    // Note content/text
  accountId?: string;                 // Optional: Associated with Account
  contactId?: string;                 // Optional: Associated with Contact
  opportunityId?: string;             // Optional: Associated with Opportunity
  isPrivate?: boolean;                 // Private notes (only visible to creator)
  createdBy: string;                  // User UID who created the note
  createdAt: Date;
  updatedAt: Date;
}

export type NoteFormData = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

