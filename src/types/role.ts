// Role and Permission definitions
export type Role = 'admin' | 'sales_manager' | 'sales_rep' | 'user';

export interface Permission {
  resource: 'accounts' | 'contacts' | 'opportunities' | 'notes' | 'tasks' | 'users';
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
}

// Default role permissions
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: 'accounts', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'contacts', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'opportunities', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'notes', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'tasks', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
  ],
  sales_manager: [
    { resource: 'accounts', actions: ['create', 'read', 'update'] },
    { resource: 'contacts', actions: ['create', 'read', 'update'] },
    { resource: 'opportunities', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'notes', actions: ['create', 'read', 'update'] },
    { resource: 'tasks', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['read'] },
  ],
  sales_rep: [
    { resource: 'accounts', actions: ['create', 'read', 'update'] },
    { resource: 'contacts', actions: ['create', 'read', 'update'] },
    { resource: 'opportunities', actions: ['create', 'read', 'update'] },
    { resource: 'notes', actions: ['create', 'read', 'update'] },
    { resource: 'tasks', actions: ['create', 'read', 'update'] },
    { resource: 'users', actions: ['read'] },
  ],
  user: [
    { resource: 'accounts', actions: ['read'] },
    { resource: 'contacts', actions: ['read'] },
    { resource: 'opportunities', actions: ['read'] },
    { resource: 'notes', actions: ['read'] },
    { resource: 'tasks', actions: ['read'] },
    { resource: 'users', actions: ['read'] },
  ],
};

