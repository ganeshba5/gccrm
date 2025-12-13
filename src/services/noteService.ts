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
import type { Note, NoteFormData, NoteAttachment } from '../types/note';

class NoteService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly notesRef;

  constructor() {
    this.db = db;
    this.collectionName = 'notes';
    this.notesRef = collection(this.db, this.collectionName);
  }

  async create(data: NoteFormData, createdBy: string): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const noteData: any = {
        content: data.content,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.accountId) noteData.accountId = data.accountId;
      if (data.contactId) noteData.contactId = data.contactId;
      if (data.opportunityId) noteData.opportunityId = data.opportunityId;
      if (data.isPrivate !== undefined) noteData.isPrivate = data.isPrivate;
      if (data.attachments && data.attachments.length > 0) {
        noteData.attachments = data.attachments.map(att => ({
          id: att.id,
          name: att.name,
          url: att.url,
          size: att.size,
          type: att.type,
          uploadedAt: Timestamp.fromDate(att.uploadedAt),
        }));
      }
      
      const docRef = await addDoc(this.notesRef, noteData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<NoteFormData>): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      
      // Remove undefined fields (Firestore doesn't allow undefined)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add defined fields
      if (data.content !== undefined) updateData.content = data.content;
      if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
      if (data.contactId !== undefined) updateData.contactId = data.contactId || null;
      if (data.opportunityId !== undefined) updateData.opportunityId = data.opportunityId || null;
      if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
      if (data.attachments !== undefined) {
        if (data.attachments.length > 0) {
          updateData.attachments = data.attachments.map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            size: att.size,
            type: att.type,
            uploadedAt: Timestamp.fromDate(att.uploadedAt),
          }));
        } else {
          updateData.attachments = null;
        }
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Note | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToNote(docSnap);
    } catch (error) {
      console.error('Error getting note:', error);
      throw error;
    }
  }

  async getAll(): Promise<Note[]> {
    try {
      // Ensure user is authenticated and token is available
      await ensureAuthenticated();
      
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const isAdmin = await canAccessAllData();
      let docs;
      
      try {
        if (isAdmin) {
          // Admin can see all notes
          const q = query(this.notesRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        } else {
          // Non-admin users can only see notes they created
          const q = query(
            this.notesRef,
            where('createdBy', '==', currentUser.id),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        }
      } catch (queryError: any) {
        // If query with orderBy fails, try without orderBy and sort in memory
        if (isAdmin) {
          const querySnapshot = await getDocs(this.notesRef);
          docs = querySnapshot.docs;
        } else {
          const q = query(
            this.notesRef,
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
      
      return docs.map(doc => this.convertToNote(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting notes:', error);
      throw error;
    }
  }

  async getByAccount(accountId: string): Promise<Note[]> {
    try {
      await ensureAuthenticated();
      
      let docs;
      try {
        const q = query(this.notesRef, where('accountId', '==', accountId));
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
          this.notesRef,
          where('accountId', '==', accountId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToNote(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting notes by account:', error);
      throw error;
    }
  }

  async getByContact(contactId: string): Promise<Note[]> {
    try {
      await ensureAuthenticated();
      
      let docs;
      try {
        const q = query(this.notesRef, where('contactId', '==', contactId));
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
          this.notesRef,
          where('contactId', '==', contactId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToNote(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting notes by contact:', error);
      throw error;
    }
  }

  async getByOpportunity(opportunityId: string): Promise<Note[]> {
    try {
      await ensureAuthenticated();
      
      let docs;
      try {
        const q = query(this.notesRef, where('opportunityId', '==', opportunityId));
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
          this.notesRef,
          where('opportunityId', '==', opportunityId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      }
      
      return docs.map(doc => this.convertToNote(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting notes by opportunity:', error);
      throw error;
    }
  }

  private convertToNote(doc: DocumentSnapshot): Note {
    const data = doc.data();
    
    // Convert attachments from Firestore format to NoteAttachment[]
    let attachments: NoteAttachment[] | undefined;
    if (data?.attachments && Array.isArray(data.attachments)) {
      attachments = data.attachments.map((att: any) => ({
        id: att.id,
        name: att.name,
        url: att.url,
        size: att.size,
        type: att.type,
        uploadedAt: att.uploadedAt?.toDate ? att.uploadedAt.toDate() : new Date(att.uploadedAt),
      }));
    }
    
    return {
      id: doc.id,
      content: data?.content ?? '',
      attachments,
      accountId: data?.accountId,
      contactId: data?.contactId,
      opportunityId: data?.opportunityId,
      isPrivate: data?.isPrivate ?? false,
      createdBy: data?.createdBy ?? '',
      source: data?.source,
      emailId: data?.emailId,
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
    };
  }
}

export const noteService = new NoteService();

