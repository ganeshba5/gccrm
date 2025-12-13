// Contact entity - belongs to an Account
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  accountId: string;                 // Required: Contact belongs to an Account
  email?: string;
  phone?: string;
  mobile?: string;
  linkedin?: string;                  // LinkedIn profile URL
  title?: string;                     // Job title
  department?: string;
  mailingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  isPrimary?: boolean;                // Primary contact for the account
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                  // User UID who created the contact
}

export type ContactFormData = Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

