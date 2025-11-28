import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ensureAuthenticated } from '../lib/firebase-helpers';
import { getCurrentUser, canAccessAllData } from '../lib/auth-helpers';
import type { Task, TaskFormData } from '../types/task';

class TaskService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly tasksRef;

  constructor() {
    this.db = db;
    this.collectionName = 'tasks';
    this.tasksRef = collection(this.db, this.collectionName);
  }

  async create(data: TaskFormData, createdBy: string): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const taskData: any = {
        title: data.title,
        status: data.status,
        priority: data.priority,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.description) taskData.description = data.description;
      if (data.dueDate) taskData.dueDate = Timestamp.fromDate(data.dueDate);
      if (data.accountId) taskData.accountId = data.accountId;
      if (data.contactId) taskData.contactId = data.contactId;
      if (data.opportunityId) taskData.opportunityId = data.opportunityId;
      if (data.assignedTo) taskData.assignedTo = data.assignedTo;
      
      const docRef = await addDoc(this.tasksRef, taskData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<TaskFormData>): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add defined fields
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? Timestamp.fromDate(data.dueDate) : null;
      if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
      if (data.contactId !== undefined) updateData.contactId = data.contactId || null;
      if (data.opportunityId !== undefined) updateData.opportunityId = data.opportunityId || null;
      if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo || null;
      
      // If status is being set to completed, set completedAt
      if (data.status === 'completed' && !data.completedAt) {
        updateData.completedAt = Timestamp.now();
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Task | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToTask(docSnap);
    } catch (error) {
      console.error('Error getting task:', error);
      throw error;
    }
  }

  async getAll(): Promise<Task[]> {
    try {
      await ensureAuthenticated();
      
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const isAdmin = await canAccessAllData();
      let docs;
      
      try {
        if (isAdmin) {
          // Admin can see all tasks
          const q = query(this.tasksRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        } else {
          // Non-admin users can only see tasks they created
          const q = query(
            this.tasksRef,
            where('createdBy', '==', currentUser.id),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        }
      } catch (queryError: any) {
        // If query with orderBy fails, try without orderBy and sort in memory
        if (isAdmin) {
          const querySnapshot = await getDocs(this.tasksRef);
          docs = querySnapshot.docs;
        } else {
          const q = query(
            this.tasksRef,
            where('createdBy', '==', currentUser.id)
          );
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        }
        
        // Sort in memory by createdAt (descending)
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() || 0;
          const bTime = bData.createdAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
      }
      
      return docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  }

  async getByAccount(accountId: string): Promise<Task[]> {
    try {
      const q = query(
        this.tasksRef,
        where('accountId', '==', accountId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks by account:', error);
      throw error;
    }
  }

  async getByContact(contactId: string): Promise<Task[]> {
    try {
      const q = query(
        this.tasksRef,
        where('contactId', '==', contactId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks by contact:', error);
      throw error;
    }
  }

  async getByOpportunity(opportunityId: string): Promise<Task[]> {
    try {
      const q = query(
        this.tasksRef,
        where('opportunityId', '==', opportunityId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks by opportunity:', error);
      throw error;
    }
  }

  async getByAssignedTo(userId: string): Promise<Task[]> {
    try {
      const q = query(
        this.tasksRef,
        where('assignedTo', '==', userId),
        orderBy('dueDate', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks by assigned user:', error);
      throw error;
    }
  }

  async getByStatus(status: Task['status']): Promise<Task[]> {
    try {
      const q = query(
        this.tasksRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToTask(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      throw error;
    }
  }

  private convertToTask(doc: DocumentSnapshot): Task {
    const data = doc.data();
    return {
      id: doc.id,
      title: data?.title ?? '',
      description: data?.description,
      status: data?.status ?? 'not_started',
      priority: data?.priority ?? 'medium',
      dueDate: data?.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
      completedAt: data?.completedAt ? (data.completedAt as Timestamp).toDate() : undefined,
      accountId: data?.accountId,
      contactId: data?.contactId,
      opportunityId: data?.opportunityId,
      assignedTo: data?.assignedTo,
      createdBy: data?.createdBy ?? '',
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
    };
  }
}

export const taskService = new TaskService();

