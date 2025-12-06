// Central export file for all types
export * from './opportunity';
export * from './account';
export * from './user';
export * from './contact';
export * from './note';
export * from './task';
export * from './role';
export * from './inboundEmail';
export * from './configSetting';

// Legacy exports for backward compatibility (deprecated - use new types)
/** @deprecated Use Opportunity instead */
export type Lead = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: 'New' | 'Contacted' | 'Qualified' | 'Converted';
  owner?: string;
  createdAt: Date;
};

/** @deprecated Use Account instead */
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  status: 'active' | 'inactive' | 'lead';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  lastContact?: Date;
}

