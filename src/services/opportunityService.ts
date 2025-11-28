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
import type { Opportunity, OpportunityFormData } from '../types/opportunity';

class OpportunityService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly opportunitiesRef;

  constructor() {
    this.db = db;
    this.collectionName = 'opportunities';
    this.opportunitiesRef = collection(this.db, this.collectionName);
  }

  async create(data: OpportunityFormData, createdBy: string): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const opportunityData: any = {
        name: data.name,
        stage: data.stage,
        owner: data.owner,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.accountId) opportunityData.accountId = data.accountId;
      if (data.amount !== undefined) opportunityData.amount = data.amount;
      if (data.probability !== undefined) opportunityData.probability = data.probability;
      if (data.expectedCloseDate) opportunityData.expectedCloseDate = Timestamp.fromDate(data.expectedCloseDate);
      if (data.description) opportunityData.description = data.description;
      
      const docRef = await addDoc(this.opportunitiesRef, opportunityData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating opportunity:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<OpportunityFormData>): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      
      // Remove undefined fields (Firestore doesn't allow undefined)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add defined fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.stage !== undefined) updateData.stage = data.stage;
      if (data.owner !== undefined) updateData.owner = data.owner;
      if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
      if (data.amount !== undefined) updateData.amount = data.amount !== undefined ? data.amount : null;
      if (data.probability !== undefined) updateData.probability = data.probability !== undefined ? data.probability : null;
      if (data.expectedCloseDate !== undefined) updateData.expectedCloseDate = data.expectedCloseDate ? Timestamp.fromDate(data.expectedCloseDate) : null;
      if (data.description !== undefined) updateData.description = data.description || null;
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating opportunity:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Opportunity | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToOpportunity(docSnap);
    } catch (error) {
      console.error('Error getting opportunity:', error);
      throw error;
    }
  }

  async getAll(): Promise<Opportunity[]> {
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
          // Admin can see all opportunities
          const q = query(this.opportunitiesRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        } else {
          // Non-admin users can only see opportunities they own
          const q = query(
            this.opportunitiesRef,
            where('owner', '==', currentUser.id),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        }
      } catch (queryError: any) {
        // If query with orderBy fails, try without orderBy and sort in memory
        if (isAdmin) {
          const querySnapshot = await getDocs(this.opportunitiesRef);
          docs = querySnapshot.docs;
        } else {
          const q = query(
            this.opportunitiesRef,
            where('owner', '==', currentUser.id)
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
      
      return docs.map(doc => this.convertToOpportunity(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting opportunities:', error);
      throw error;
    }
  }

  async getByAccount(accountId: string): Promise<Opportunity[]> {
    try {
      const q = query(
        this.opportunitiesRef,
        where('accountId', '==', accountId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToOpportunity(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting opportunities by account:', error);
      throw error;
    }
  }

  async getByOwner(ownerId: string): Promise<Opportunity[]> {
    try {
      const q = query(
        this.opportunitiesRef,
        where('owner', '==', ownerId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToOpportunity(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting opportunities by owner:', error);
      throw error;
    }
  }

  async getByStage(stage: Opportunity['stage']): Promise<Opportunity[]> {
    try {
      const q = query(
        this.opportunitiesRef,
        where('stage', '==', stage),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToOpportunity(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting opportunities by stage:', error);
      throw error;
    }
  }

  private convertToOpportunity(doc: DocumentSnapshot): Opportunity {
    const data = doc.data();
    return {
      id: doc.id,
      name: data?.name ?? '',
      accountId: data?.accountId,
      amount: data?.amount,
      stage: data?.stage ?? 'New',
      probability: data?.probability,
      expectedCloseDate: data?.expectedCloseDate ? (data.expectedCloseDate as Timestamp).toDate() : undefined,
      description: data?.description,
      owner: data?.owner ?? '',
      createdBy: data?.createdBy ?? '',
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
    };
  }
}

export const opportunityService = new OpportunityService();

