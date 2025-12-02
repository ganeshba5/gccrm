import 'dotenv/config';
import { db } from './firebase-admin.js';
import { Timestamp } from 'firebase-admin/firestore';

interface SampleTask {
  title: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  assignedTo?: string; // Will be null/undefined for unassigned
  createdBy: string;
}

// Sample tasks data - all unassigned
const sampleTasks: SampleTask[] = [
  {
    title: 'Review Q4 Sales Report',
    description: 'Analyze Q4 sales performance and prepare summary for management team',
    status: 'not_started',
    priority: 'high',
    dueDate: new Date('2024-12-15'),
    createdBy: 'system',
  },
  {
    title: 'Follow up with Acme Corp',
    description: 'Schedule meeting to discuss renewal options',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date('2024-12-10'),
    createdBy: 'system',
  },
  {
    title: 'Update customer database',
    description: 'Verify and update contact information for all active accounts',
    status: 'not_started',
    priority: 'medium',
    dueDate: new Date('2024-12-20'),
    createdBy: 'system',
  },
  {
    title: 'Prepare proposal for Tech Solutions',
    description: 'Create detailed proposal for new enterprise package',
    status: 'not_started',
    priority: 'high',
    dueDate: new Date('2024-12-12'),
    createdBy: 'system',
  },
  {
    title: 'Send welcome email to new clients',
    description: 'Send onboarding emails to all new clients from last month',
    status: 'in_progress',
    priority: 'medium',
    dueDate: new Date('2024-12-08'),
    createdBy: 'system',
  },
  {
    title: 'Review and approve expense reports',
    description: 'Review team expense reports for November',
    status: 'not_started',
    priority: 'low',
    dueDate: new Date('2024-12-18'),
    createdBy: 'system',
  },
  {
    title: 'Conduct market research',
    description: 'Research competitor pricing and feature comparison',
    status: 'not_started',
    priority: 'medium',
    dueDate: new Date('2024-12-25'),
    createdBy: 'system',
  },
  {
    title: 'Update product documentation',
    description: 'Update user guides with latest features and improvements',
    status: 'in_progress',
    priority: 'low',
    dueDate: new Date('2024-12-30'),
    createdBy: 'system',
  },
  {
    title: 'Schedule team meeting',
    description: 'Coordinate schedules and book conference room for monthly team meeting',
    status: 'not_started',
    priority: 'medium',
    dueDate: new Date('2024-12-11'),
    createdBy: 'system',
  },
  {
    title: 'Review customer feedback',
    description: 'Analyze customer survey responses and identify improvement areas',
    status: 'not_started',
    priority: 'high',
    dueDate: new Date('2024-12-14'),
    createdBy: 'system',
  },
];

async function insertSampleTasks() {
  try {
    console.log(`Inserting ${sampleTasks.length} sample unassigned tasks...\n`);

    const tasksRef = db.collection('tasks');
    const batch = db.batch();
    const now = Timestamp.now();

    sampleTasks.forEach((task, index) => {
      const docRef = tasksRef.doc(); // Auto-generate document ID
      const taskData: any = {
        title: task.title,
        status: task.status,
        priority: task.priority,
        createdBy: task.createdBy,
        createdAt: now,
        updatedAt: now,
      };

      // Add optional fields only if they exist
      if (task.description) {
        taskData.description = task.description;
      }
      if (task.dueDate) {
        taskData.dueDate = Timestamp.fromDate(task.dueDate);
      }
      if (task.accountId) {
        taskData.accountId = task.accountId;
      }
      if (task.contactId) {
        taskData.contactId = task.contactId;
      }
      if (task.opportunityId) {
        taskData.opportunityId = task.opportunityId;
      }
      // assignedTo is intentionally omitted (unassigned tasks)

      batch.set(docRef, taskData);
      console.log(`  Prepared task ${index + 1}: ${task.title} (${task.status}, ${task.priority})`);
    });

    // Commit the batch
    await batch.commit();

    console.log(`\n✅ Successfully inserted ${sampleTasks.length} unassigned tasks!`);
    console.log('   All tasks are unassigned (assignedTo is null/undefined)');
    console.log('   Tasks have been added to the database.\n');

    return sampleTasks.length;
  } catch (error: any) {
    console.error('❌ Error inserting tasks:', error.message || error);
    console.error('   Error code:', error.code);
    throw error;
  }
}

// Run the function
insertSampleTasks()
  .then((count) => {
    console.log(`✅ ${count} unassigned tasks created successfully`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

