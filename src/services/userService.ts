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
import { db, auth } from '../lib/firebase';
import { ensureAuthenticated } from '../lib/firebase-helpers';
import { getCurrentUser, canAccessAllData } from '../lib/auth-helpers';
import type { User, UserFormData } from '../types/user';

class UserService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly usersRef;

  constructor() {
    this.db = db;
    this.collectionName = 'users';
    this.usersRef = collection(this.db, this.collectionName);
  }

  async create(data: UserFormData): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const userData: any = {
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.displayName) userData.displayName = data.displayName;
      if (data.firstName) userData.firstName = data.firstName;
      if (data.lastName) userData.lastName = data.lastName;
      if (data.phone) userData.phone = data.phone;
      if (data.photoURL) userData.photoURL = data.photoURL;
      if (data.department) userData.department = data.department;
      if (data.title) userData.title = data.title;
      // parentUserId: null for top-level users and admins, otherwise set the parent user ID
      if (data.parentUserId) userData.parentUserId = data.parentUserId;
      // If role is admin, parentUserId should be null/undefined
      if (data.role === 'admin') {
        userData.parentUserId = null;
      }
      
      const docRef = await addDoc(this.usersRef, userData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<UserFormData>): Promise<void> {
    try {
      // Check if user is admin or updating their own profile
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const isAdmin = await canAccessAllData();
      
      // Non-admin users can only update their own profile
      if (!isAdmin && currentUser.id !== id) {
        throw new Error('You can only update your own profile');
      }
      
      // Non-admin users cannot update role or isActive
      if (!isAdmin) {
        if (data.role !== undefined && data.role !== currentUser.role) {
          throw new Error('You cannot change your role');
        }
        if (data.isActive !== undefined && data.isActive !== currentUser.isActive) {
          throw new Error('You cannot change your active status');
        }
      }
      
      const docRef = doc(this.db, this.collectionName, id);
      
      // Remove undefined fields (Firestore doesn't allow undefined)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add defined fields
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined && isAdmin) updateData.role = data.role;
      if (data.isActive !== undefined && isAdmin) updateData.isActive = data.isActive;
      if (data.displayName !== undefined) updateData.displayName = data.displayName || null;
      if (data.firstName !== undefined) updateData.firstName = data.firstName || null;
      if (data.lastName !== undefined) updateData.lastName = data.lastName || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.photoURL !== undefined) updateData.photoURL = data.photoURL || null;
      if (data.department !== undefined) updateData.department = data.department || null;
      if (data.title !== undefined) updateData.title = data.title || null;
      if (data.parentUserId !== undefined && isAdmin) {
        // Only admins can set parentUserId
        // If role is admin, parentUserId should be null
        if (data.role === 'admin' || (await this.getById(id))?.role === 'admin') {
          updateData.parentUserId = null;
        } else {
          updateData.parentUserId = data.parentUserId || null;
        }
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<User | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToUser(docSnap);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getAll(): Promise<User[]> {
    try {
      // Ensure user is authenticated and token is available
      await ensureAuthenticated();
      
      // Try query without orderBy first (in case index isn't ready)
      let docs;
      try {
        // Simple query without orderBy
        const querySnapshot = await getDocs(this.usersRef);
        docs = querySnapshot.docs;
        
        // Sort in memory by createdAt (descending)
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() || 0;
          const bTime = bData.createdAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
      } catch (simpleError: any) {
        // If simple query fails, try with orderBy (might need index)
        const q = query(this.usersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToUser(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  async getByRole(role: User['role']): Promise<User[]> {
    try {
      await ensureAuthenticated();
      
      let docs;
      try {
        const q = query(
          this.usersRef,
          where('role', '==', role),
          where('isActive', '==', true)
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
        
        // Sort in memory
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() || 0;
          const bTime = bData.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      } catch (simpleError: any) {
        const q = query(
          this.usersRef,
          where('role', '==', role),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToUser(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw error;
    }
  }

  async getActiveUsers(): Promise<User[]> {
    try {
      await ensureAuthenticated();
      
      let docs;
      try {
        const q = query(this.usersRef, where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
        
        // Sort in memory
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() || 0;
          const bTime = bData.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      } catch (simpleError: any) {
        const q = query(
          this.usersRef,
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToUser(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting active users:', error);
      throw error;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, userId);
      await updateDoc(docRef, {
        lastLogin: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  private convertToUser(doc: DocumentSnapshot): User {
    const data = doc.data();
    return {
      id: doc.id,
      email: data?.email ?? '',
      displayName: data?.displayName,
      firstName: data?.firstName,
      lastName: data?.lastName,
      phone: data?.phone,
      photoURL: data?.photoURL,
      role: data?.role ?? 'user',
      isActive: data?.isActive ?? true,
      department: data?.department,
      title: data?.title,
      parentUserId: data?.parentUserId,
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
      lastLogin: data?.lastLogin ? (data.lastLogin as Timestamp).toDate() : undefined,
    };
  }
}

export const userService = new UserService();

