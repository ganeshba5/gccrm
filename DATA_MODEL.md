# Data Model Documentation

This document describes the data model for the GC CRM application.

## Overview

The application uses **Firestore** as the backend database. The CRM follows a standard B2B sales model with Accounts, Contacts, Opportunities, Users, Notes, and Tasks.

## Entity Relationships

```
Account (Company)
  ├── Has many Contacts
  ├── Has many Opportunities
  ├── Has many Notes
  └── Has many Tasks

Contact (Person)
  ├── Belongs to Account (required)
  ├── Has many Notes
  └── Has many Tasks

Opportunity (Deal)
  ├── Belongs to Account (optional)
  ├── Owned by User (required)
  ├── Has many Notes
  └── Has many Tasks

User
  ├── Owns many Opportunities
  ├── Assigned to many Accounts
  ├── Assigned to many Tasks
  └── Has a Role (admin, sales_manager, sales_rep, user)

Note
  ├── Can belong to Account (optional)
  ├── Can belong to Contact (optional)
  └── Can belong to Opportunity (optional)

Task
  ├── Can belong to Account (optional)
  ├── Can belong to Contact (optional)
  ├── Can belong to Opportunity (optional)
  └── Assigned to User (optional)
```

## Collections

### 1. Opportunities (`/opportunities/{opportunityId}`)

**Status**: ✅ Implemented (formerly Leads)

**Purpose**: Track sales opportunities/deals in the pipeline.

**TypeScript Type**:
```typescript
export type Opportunity = {
  id: string;
  name: string;                      // Opportunity name/title
  accountId?: string;               // Reference to Account
  amount?: number;                   // Deal amount/value
  stage: 'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  probability?: number;              // 0-100 percentage
  expectedCloseDate?: Date;         // Expected close date
  description?: string;              // Opportunity description
  owner: string;                     // User UID who owns the opportunity (required)
  createdAt: Date;
  updatedAt: Date;
};
```

**Firestore Fields**:
- `name` (string, required, max 200): Opportunity name/title
- `accountId` (string, optional): Reference to Account document
- `amount` (number, optional, >= 0): Deal value/amount
- `stage` (string, required): One of: 'New', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'
- `probability` (number, optional, 0-100): Win probability percentage
- `expectedCloseDate` (timestamp, optional): Expected close date
- `description` (string, optional, max 5000): Opportunity description
- `owner` (string, required): User UID who owns the opportunity
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp

**Validation Rules**:
- Maximum 15 fields per document
- `name`: 1-200 characters, required
- `stage`: Must be one of the allowed values
- `owner`: Required, must match authenticated user on create
- `amount`: Must be >= 0 if provided
- `probability`: Must be 0-100 if provided

**Permissions**:
- **Read**: Any authenticated user
- **Create**: Any authenticated user (must be owner)
- **Update**: Owner, Admin, Sales Manager, or Sales Rep (if owner)
- **Delete**: Owner, Admin, Sales Manager, or Sales Rep (if owner)

---

### 2. Accounts (`/accounts/{accountId}`)

**Status**: ✅ Implemented (formerly Customers)

**Purpose**: Manage company/organization records (customers, prospects, partners).

**TypeScript Type**:
```typescript
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
  createdAt: Date;
  updatedAt: Date;
  lastContact?: Date;
}
```

**Firestore Fields**:
- `name` (string, required, max 200): Account/Company name
- `website` (string, optional, max 500): Website URL
- `industry` (string, optional, max 100): Industry type
- `phone` (string, optional, max 20): Primary phone number
- `email` (string, optional): Valid email address
- `billingAddress` (object, optional): Billing address fields
- `shippingAddress` (object, optional): Shipping address fields
- `status` (string, required): One of: 'active', 'inactive', 'prospect'
- `description` (string, optional, max 5000): Account description
- `assignedTo` (string, optional): User UID of assigned sales rep
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp
- `lastContact` (timestamp, optional): Last contact date

**Validation Rules**:
- Maximum 20 fields per document
- `name`: 1-200 characters, required
- `email`: Valid email format if provided
- `status`: Must be one of the allowed values

**Permissions**:
- **Read**: Any authenticated user
- **Create**: Any authenticated user
- **Update**: Admin, Sales Manager, or Sales Rep (if assigned to them)
- **Delete**: Admin or Sales Rep (if assigned to them)

---

### 3. Users (`/users/{userId}`)

**Status**: ✅ Implemented

**Purpose**: Manage CRM users and their roles/permissions.

**TypeScript Type**:
```typescript
export interface User {
  id: string;                        // Firebase Auth UID
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
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}
```

**Firestore Fields**:
- `email` (string, required): Valid email address
- `displayName` (string, optional, max 200): Display name
- `firstName` (string, optional, max 100): First name
- `lastName` (string, optional, max 100): Last name
- `phone` (string, optional, max 20): Phone number
- `photoURL` (string, optional, max 500): Profile photo URL
- `role` (string, required): One of: 'admin', 'sales_manager', 'sales_rep', 'user'
- `isActive` (boolean, required): Whether user is active
- `department` (string, optional, max 100): Department
- `title` (string, optional, max 100): Job title
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp
- `lastLogin` (timestamp, optional): Last login timestamp

**Validation Rules**:
- Maximum 15 fields per document
- `email`: Valid email format, required
- `role`: Must be one of the allowed values

**Permissions**:
- **Read**: User can read own profile, Admin/Sales Manager can read all
- **Create**: Admin only
- **Update**: Admin, Sales Manager (except admin role), or User (own profile, cannot change role)
- **Delete**: Admin only (cannot delete self)

---

### 4. Contacts (`/contacts/{contactId}`)

**Status**: ✅ Implemented

**Purpose**: Manage individual contacts (people) associated with Accounts.

**TypeScript Type**:
```typescript
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  accountId: string;                 // Required: Contact belongs to an Account
  email?: string;
  phone?: string;
  mobile?: string;
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
```

**Firestore Fields**:
- `firstName` (string, required, max 100): First name
- `lastName` (string, required, max 100): Last name
- `accountId` (string, required): Reference to Account document
- `email` (string, optional): Valid email address
- `phone` (string, optional, max 20): Phone number
- `mobile` (string, optional, max 20): Mobile number
- `title` (string, optional, max 100): Job title
- `department` (string, optional, max 100): Department
- `mailingAddress` (object, optional): Mailing address fields
- `isPrimary` (boolean, optional): Whether this is the primary contact
- `notes` (string, optional, max 2000): Additional notes
- `createdBy` (string, required): User UID who created the contact
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp

**Validation Rules**:
- Maximum 20 fields per document
- `firstName`: 1-100 characters, required
- `lastName`: 1-100 characters, required
- `accountId`: Required, must reference valid Account
- `email`: Valid email format if provided

**Permissions**:
- **Read**: Any authenticated user
- **Create**: Any authenticated user (must be creator)
- **Update**: Admin, Sales Manager, Sales Rep, or Creator
- **Delete**: Admin, Sales Manager, Sales Rep (if creator), or Creator

---

### 5. Notes (`/notes/{noteId}`)

**Status**: ✅ Implemented

**Purpose**: Store notes and comments related to Accounts, Contacts, or Opportunities.

**TypeScript Type**:
```typescript
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
```

**Firestore Fields**:
- `content` (string, required, max 10000): Note content/text
- `accountId` (string, optional): Reference to Account document
- `contactId` (string, optional): Reference to Contact document
- `opportunityId` (string, optional): Reference to Opportunity document
- `isPrivate` (boolean, optional): If true, only creator and admins can view
- `createdBy` (string, required): User UID who created the note
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp

**Validation Rules**:
- Maximum 10 fields per document
- `content`: 1-10000 characters, required
- At least one of: `accountId`, `contactId`, or `opportunityId` should be provided (not enforced in rules, but recommended)

**Permissions**:
- **Read**: Any authenticated user (except private notes - only creator, admin, sales manager)
- **Create**: Any authenticated user (must be creator)
- **Update**: Admin, Sales Manager, Sales Rep (if creator), or Creator
- **Delete**: Admin, Sales Manager, Sales Rep (if creator), or Creator

---

### 6. Tasks (`/tasks/{taskId}`)

**Status**: ✅ Implemented

**Purpose**: Track tasks and activities related to Accounts, Contacts, or Opportunities.

**TypeScript Type**:
```typescript
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  completedAt?: Date;
  accountId?: string;                 // Optional: Associated with Account
  contactId?: string;                 // Optional: Associated with Contact
  opportunityId?: string;             // Optional: Associated with Opportunity
  assignedTo?: string;                // User UID assigned to the task
  createdBy: string;                  // User UID who created the task
  createdAt: Date;
  updatedAt: Date;
}
```

**Firestore Fields**:
- `title` (string, required, max 200): Task title
- `description` (string, optional, max 5000): Task description
- `status` (string, required): One of: 'not_started', 'in_progress', 'completed', 'cancelled'
- `priority` (string, required): One of: 'low', 'medium', 'high'
- `dueDate` (timestamp, optional): Due date
- `completedAt` (timestamp, optional): Completion date
- `accountId` (string, optional): Reference to Account document
- `contactId` (string, optional): Reference to Contact document
- `opportunityId` (string, optional): Reference to Opportunity document
- `assignedTo` (string, optional): User UID assigned to the task
- `createdBy` (string, required): User UID who created the task
- `createdAt` (timestamp, required): Creation timestamp
- `updatedAt` (timestamp, required): Last update timestamp

**Validation Rules**:
- Maximum 15 fields per document
- `title`: 1-200 characters, required
- `status`: Must be one of the allowed values
- `priority`: Must be one of the allowed values

**Permissions**:
- **Read**: Any authenticated user
- **Create**: Any authenticated user (must be creator)
- **Update**: Admin, Sales Manager, Sales Rep (if creator or assigned), Creator, or Assigned User
- **Delete**: Admin, Sales Manager, Sales Rep (if creator), or Creator

---

### 7. Roles (`/roles/{userId}`)

**Status**: ✅ Implemented

**Purpose**: Store user roles and permissions (complementary to User entity).

**Note**: Roles are primarily stored in Firebase Auth custom claims, but can also be stored in Firestore for additional metadata.

**Firestore Fields**:
- Custom claims in Firebase Auth: `roles` array or `role` string
- Values: 'admin', 'sales_manager', 'sales_rep', 'user'

**Permissions**:
- **Read**: User can read own role, Admin can read any
- **Write**: Admin only

---

## Role-Based Permissions

### Admin
- Full access to all collections
- Can manage users and roles
- Can delete any record

### Sales Manager
- Can read all records
- Can create/update Accounts, Contacts, Opportunities, Notes, Tasks
- Can manage Sales Reps (but not Admins)
- Can read Users

### Sales Rep
- Can read all records
- Can create/update own Opportunities
- Can create/update Accounts/Contacts assigned to them
- Can create/update own Notes and Tasks
- Can read Users

### User
- Can read all records (view-only)
- Cannot create/update/delete records

---

## Common Patterns

### Timestamps
- All entities use `createdAt` (timestamp, required)
- Most entities use `updatedAt` (timestamp, required)
- Use Firestore `Timestamp` type in code, convert to `Date` in TypeScript

### Ownership
- `owner`: User UID who owns the record (Opportunities)
- `createdBy`: User UID who created the record (Contacts, Notes, Tasks)
- `assignedTo`: User UID who is assigned to work on the record (Accounts, Tasks)

### Status Fields
- Opportunities: `'New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'`
- Accounts: `'active' | 'inactive' | 'prospect'`
- Tasks: `'not_started' | 'in_progress' | 'completed' | 'cancelled'`

### Relationships
- **Account → Contacts**: One-to-many (Contact has required `accountId`)
- **Account → Opportunities**: One-to-many (Opportunity has optional `accountId`)
- **User → Opportunities**: One-to-many (Opportunity has required `owner`)
- **Notes/Tasks → Accounts/Contacts/Opportunities**: Many-to-many (via optional reference fields)

---

## Indexes

### Required Composite Indexes

1. **Accounts**:
   - Collection: `accounts`
   - Fields: `status` (Ascending), `createdAt` (Descending)
   - Purpose: Query accounts by status, ordered by creation date

2. **Opportunities**:
   - Collection: `opportunities`
   - Fields: `accountId` (Ascending), `stage` (Ascending), `createdAt` (Descending)
   - Purpose: Query opportunities by account and stage

3. **Contacts**:
   - Collection: `contacts`
   - Fields: `accountId` (Ascending), `createdAt` (Descending)
   - Purpose: Query contacts by account

4. **Tasks**:
   - Collection: `tasks`
   - Fields: `assignedTo` (Ascending), `status` (Ascending), `dueDate` (Ascending)
   - Purpose: Query tasks by assignee and status

### Single-Field Indexes
- Firestore automatically creates single-field indexes
- No explicit single-field indexes needed in `firestore.indexes.json`

---

## Migration Notes

### From Leads to Opportunities
1. Rename collection: `leads` → `opportunities`
2. Map fields:
   - `name` → `name` (same)
   - `company` → `accountId` (create/link to Account)
   - `status` → `stage` (map values)
   - `owner` → `owner` (same)
   - Add `amount`, `probability`, `expectedCloseDate` if available
   - Add `updatedAt` timestamp

### From Customers to Accounts
1. Rename collection: `customers` → `accounts`
2. Map fields:
   - `firstName` + `lastName` → `name` (combine)
   - `company` → `name` (if company name was used)
   - `status` → `status` (map 'lead' to 'prospect')
   - `assignedTo` → `assignedTo` (same)
   - Add `website`, `industry` if available
   - Add `updatedAt` timestamp

---

## Type Definitions Location

- **All Types**: `src/types/` directory
  - `src/types/opportunity.ts` - Opportunity type
  - `src/types/account.ts` - Account type
  - `src/types/user.ts` - User type
  - `src/types/contact.ts` - Contact type
  - `src/types/note.ts` - Note type
  - `src/types/task.ts` - Task type
  - `src/types/role.ts` - Role and permission types
  - `src/types/index.ts` - Central export file

---

## References

- Firestore Rules: `firestore.rules`
- Firestore Indexes: `firestore.indexes.json`
- TypeScript Types: `src/types/`
- Service Classes: `src/services/`
