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

// no default export; use named imports for types
