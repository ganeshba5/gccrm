import type { SharedUser } from './account';

// Opportunity (formerly Lead)
export type Opportunity = {
  id: string;
  name: string;                    // Opportunity name/title
  accountId?: string;               // Reference to Account
  amount?: number;                   // Deal amount/value
  stage: 'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  probability?: number;              // 0-100 percentage
  expectedCloseDate?: Date;         // Expected close date
  description?: string;              // Opportunity description
  owner: string;                     // User UID who owns the opportunity
  sharedUsers?: SharedUser[];        // List of users with shared access
  createdBy: string;                // User UID who created the opportunity
  source?: string;                   // Source of creation (e.g., 'email', 'import', 'manual')
  createdAt: Date;
  updatedAt: Date;
};

export type OpportunityFormData = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

