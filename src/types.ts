export type Lead = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: 'New' | 'Contacted' | 'Qualified' | 'Converted';
  owner?: string;
  created_at?: string;
};

// no default export; use named imports for types
