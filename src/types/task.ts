// Task entity - can be associated with Account, Contact, or Opportunity
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

export type TaskFormData = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

