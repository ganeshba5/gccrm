// Account (formerly Customer)
export interface Account {
  id: string;
  name: string;                      // Account/Company name
  website?: string;                  // Website URL
  industry?: string;                  // Industry type
  phone?: string;                    // Primary phone
  email?: string;                    // Primary email
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  status: 'active' | 'inactive' | 'prospect';
  description?: string;               // Account description
  assignedTo?: string;                // User UID of assigned sales rep
  createdBy: string;                 // User UID who created the account
  createdAt: Date;
  updatedAt: Date;
  lastContact?: Date;
}

export type AccountFormData = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

