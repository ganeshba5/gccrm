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
import { getCurrentUser } from '../lib/auth-helpers';
import type { InboundEmail, InboundEmailFormData } from '../types/inboundEmail';

class InboundEmailService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly emailsRef;

  constructor() {
    this.db = db;
    this.collectionName = 'inboundEmails';
    this.emailsRef = collection(this.db, this.collectionName);
  }

  async create(data: InboundEmailFormData): Promise<string> {
    try {
      const emailData: any = {
        messageId: data.messageId,
        from: data.from,
        to: data.to,
        subject: data.subject,
        body: data.body,
        receivedAt: Timestamp.fromDate(data.receivedAt),
        read: data.read || false,
        processed: data.processed || false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (data.threadId) emailData.threadId = data.threadId;
      if (data.cc) emailData.cc = data.cc;
      if (data.bcc) emailData.bcc = data.bcc;
      if (data.attachments && data.attachments.length > 0) {
        emailData.attachments = data.attachments.map(att => ({
          ...att,
          storedAt: att.storedAt ? Timestamp.fromDate(att.storedAt) : undefined,
        }));
      }
      if (data.linkedTo) emailData.linkedTo = data.linkedTo;
      if (data.labels) emailData.labels = data.labels;
      if (data.snippet) emailData.snippet = data.snippet;
      if (data.createdBy) emailData.createdBy = data.createdBy;

      const docRef = await addDoc(this.emailsRef, emailData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating inbound email:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<InboundEmailFormData>): Promise<void> {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(this.db, this.collectionName, id);
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (data.read !== undefined) updateData.read = data.read;
      if (data.processed !== undefined) updateData.processed = data.processed;
      if (data.linkedTo !== undefined) updateData.linkedTo = data.linkedTo || null;
      if (data.createdBy !== undefined) updateData.createdBy = data.createdBy || null;
      if (data.labels !== undefined) updateData.labels = data.labels || null;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating inbound email:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting inbound email:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<InboundEmail | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToInboundEmail(docSnap);
    } catch (error) {
      console.error('Error getting inbound email:', error);
      throw error;
    }
  }

  async getByMessageId(messageId: string): Promise<InboundEmail | null> {
    try {
      await ensureAuthenticated();

      let docs;
      try {
        // Try query with orderBy (requires composite index)
        const q = query(this.emailsRef, where('messageId', '==', messageId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      } catch (orderByError: any) {
        // If orderBy fails (index not created), use where only
        console.warn('Firestore composite index not found for messageId + createdAt. Using where only:', orderByError.message);
        const q = query(this.emailsRef, where('messageId', '==', messageId));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
        
        // Sort in memory by createdAt (descending)
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() || 0;
          const bTime = bData.createdAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
      }

      if (docs.length === 0) {
        return null;
      }

      return this.convertToInboundEmail(docs[0] as DocumentSnapshot);
    } catch (error) {
      console.error('Error getting inbound email by message ID:', error);
      throw error;
    }
  }

  async getAll(limit?: number): Promise<InboundEmail[]> {
    try {
      await ensureAuthenticated();

      let docs;
      try {
        // Try query with orderBy (requires index)
        const q = query(this.emailsRef, orderBy('receivedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      } catch (orderByError: any) {
        // If orderBy fails (index not created), fetch all and sort in memory
        console.warn('Firestore index not found for receivedAt. Sorting in memory. Please create the index:', orderByError.message);
        const querySnapshot = await getDocs(this.emailsRef);
        docs = querySnapshot.docs;
        
        // Sort in memory by receivedAt (descending)
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.receivedAt?.toMillis?.() || 0;
          const bTime = bData.receivedAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
      }

      const emails = docs.map(doc => this.convertToInboundEmail(doc as DocumentSnapshot));
      
      if (limit) {
        return emails.slice(0, limit);
      }

      return emails;
    } catch (error) {
      console.error('Error getting inbound emails:', error);
      throw error;
    }
  }

  async getUnprocessed(): Promise<InboundEmail[]> {
    try {
      await ensureAuthenticated();

      let docs;
      try {
        // Try query with orderBy (requires composite index)
        const q = query(
          this.emailsRef,
          where('processed', '==', false),
          orderBy('receivedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
      } catch (orderByError: any) {
        // If orderBy fails (index not created), use where only
        console.warn('Firestore composite index not found for processed + receivedAt. Using where only:', orderByError.message);
        const q = query(this.emailsRef, where('processed', '==', false));
        const querySnapshot = await getDocs(q);
        docs = querySnapshot.docs;
        
        // Sort in memory by receivedAt (descending)
        docs.sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.receivedAt?.toMillis?.() || 0;
          const bTime = bData.receivedAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
      }

      return docs.map(doc => this.convertToInboundEmail(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting unprocessed inbound emails:', error);
      throw error;
    }
  }

  async linkToRecord(
    emailId: string,
    accountId?: string,
    contactId?: string,
    opportunityId?: string,
    noteId?: string
  ): Promise<void> {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(this.db, this.collectionName, emailId);
      const updateData: any = {
        processed: true,
        linkedTo: {},
        createdBy: currentUser.id,
        updatedAt: Timestamp.now(),
      };

      if (accountId) updateData.linkedTo.accountId = accountId;
      if (contactId) updateData.linkedTo.contactId = contactId;
      if (opportunityId) updateData.linkedTo.opportunityId = opportunityId;
      if (noteId) updateData.linkedTo.noteId = noteId;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error linking email to record:', error);
      throw error;
    }
  }

  private convertToInboundEmail(doc: DocumentSnapshot): InboundEmail {
    const data = doc.data();
    return {
      id: doc.id,
      messageId: data?.messageId ?? '',
      threadId: data?.threadId,
      from: data?.from ?? { email: '', name: undefined },
      to: data?.to ?? [],
      cc: data?.cc,
      bcc: data?.bcc,
      subject: data?.subject ?? '',
      body: data?.body ?? { text: undefined, html: undefined },
      attachments: data?.attachments?.map((att: any) => ({
        ...att,
        storedAt: att.storedAt ? (att.storedAt as Timestamp).toDate() : undefined,
      })),
      receivedAt: (data?.receivedAt as Timestamp).toDate(),
      read: data?.read ?? false,
      processed: data?.processed ?? false,
      linkedTo: data?.linkedTo,
      labels: data?.labels,
      snippet: data?.snippet,
      createdBy: data?.createdBy,
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
    };
  }
}

export const inboundEmailService = new InboundEmailService();

