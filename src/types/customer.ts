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
  assignedTo?: string; // UUID of the user responsible
  lastContact?: Date;
}

export type CustomerFormData = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;