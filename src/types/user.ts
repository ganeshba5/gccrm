// User entity for CRM user management
export interface User {
  id: string;                        // Firestore document ID
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  photoURL?: string;
  role: 'admin' | 'sales_manager' | 'sales_rep' | 'user';
  isActive: boolean;
  department?: string;
  title?: string;                     // Job title
  parentUserId?: string;             // Parent user ID for hierarchical relationships (null for top-level users and admins)
  password?: string;                  // Hashed password (not returned to client)
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export type UserFormData = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin' | 'password'>;

