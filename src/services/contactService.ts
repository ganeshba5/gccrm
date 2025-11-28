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
import type { Contact, ContactFormData } from '../types/contact';

class ContactService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly contactsRef;

  constructor() {
    this.db = db;
    this.collectionName = 'contacts';
    this.contactsRef = collection(this.db, this.collectionName);
  }

  async create(data: ContactFormData, createdBy: string): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const contactData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        accountId: data.accountId,
        createdBy: createdBy || 'system',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.email) contactData.email = data.email;
      if (data.phone) contactData.phone = data.phone;
      if (data.mobile) contactData.mobile = data.mobile;
      if (data.title) contactData.title = data.title;
      if (data.department) contactData.department = data.department;
      if (data.mailingAddress) contactData.mailingAddress = data.mailingAddress;
      if (data.isPrimary !== undefined) contactData.isPrimary = data.isPrimary;
      if (data.notes) contactData.notes = data.notes;
      
      console.log('Creating contact with data:', {
        ...contactData,
        createdAt: contactData.createdAt.toString(),
        updatedAt: contactData.updatedAt.toString(),
      });
      
      const docRef = await addDoc(this.contactsRef, contactData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating contact:', error);
      console.error('Contact data that failed:', data);
      throw error;
    }
  }

  async update(id: string, data: Partial<ContactFormData>): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      
      // Remove undefined fields (Firestore doesn't allow undefined)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add fields that are defined
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.accountId !== undefined) updateData.accountId = data.accountId;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.mobile !== undefined) updateData.mobile = data.mobile || null;
      if (data.title !== undefined) updateData.title = data.title || null;
      if (data.department !== undefined) updateData.department = data.department || null;
      if (data.mailingAddress !== undefined) updateData.mailingAddress = data.mailingAddress || null;
      if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Contact | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToContact(docSnap);
    } catch (error) {
      console.error('Error getting contact:', error);
      throw error;
    }
  }

  async getAll(): Promise<Contact[]> {
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
          // Admin can see all contacts
          const q = query(this.contactsRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        } else {
          // Non-admin users can only see contacts they created
          const q = query(
            this.contactsRef,
            where('createdBy', '==', currentUser.id),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        }
      } catch (queryError: any) {
        // If query with orderBy fails, try without orderBy and sort in memory
        if (isAdmin) {
          const querySnapshot = await getDocs(this.contactsRef);
          docs = querySnapshot.docs;
        } else {
          const q = query(
            this.contactsRef,
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
      
      return docs.map(doc => this.convertToContact(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }

  async getByAccount(accountId: string): Promise<Contact[]> {
    try {
      const q = query(
        this.contactsRef,
        where('accountId', '==', accountId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToContact(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting contacts by account:', error);
      throw error;
    }
  }

  async getPrimaryByAccount(accountId: string): Promise<Contact | null> {
    try {
      const q = query(
        this.contactsRef,
        where('accountId', '==', accountId),
        where('isPrimary', '==', true),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      return this.convertToContact(querySnapshot.docs[0] as DocumentSnapshot);
    } catch (error) {
      console.error('Error getting primary contact by account:', error);
      throw error;
    }
  }

  private convertToContact(doc: DocumentSnapshot): Contact {
    const data = doc.data();
    return {
      id: doc.id,
      firstName: data?.firstName ?? '',
      lastName: data?.lastName ?? '',
      accountId: data?.accountId ?? '',
      email: data?.email,
      phone: data?.phone,
      mobile: data?.mobile,
      title: data?.title,
      department: data?.department,
      mailingAddress: data?.mailingAddress,
      isPrimary: data?.isPrimary ?? false,
      notes: data?.notes,
      createdBy: data?.createdBy ?? '',
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
    };
  }
}

export const contactService = new ContactService();

