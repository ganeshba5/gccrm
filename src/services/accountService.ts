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
import { configSettingService } from './configSettingService';
import type { Account, AccountFormData } from '../types/account';

class AccountService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly accountsRef;

  constructor() {
    this.db = db;
    this.collectionName = 'accounts';
    this.accountsRef = collection(this.db, this.collectionName);
  }

  async create(data: AccountFormData, createdBy: string): Promise<string> {
    try {
      // Remove undefined fields (Firestore doesn't allow undefined)
      const accountData: any = {
        name: data.name,
        status: data.status,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // Only add optional fields if they have values
      if (data.website) accountData.website = data.website;
      if (data.industry) accountData.industry = data.industry;
      if (data.phone) accountData.phone = data.phone;
      if (data.email) accountData.email = data.email;
      if (data.billingAddress) accountData.billingAddress = data.billingAddress;
      if (data.shippingAddress) accountData.shippingAddress = data.shippingAddress;
      if (data.description) accountData.description = data.description;
      if (data.assignedTo) accountData.assignedTo = data.assignedTo;
      if (data.lastContact) accountData.lastContact = Timestamp.fromDate(data.lastContact);
      if (data.sharedUsers && data.sharedUsers.length > 0) accountData.sharedUsers = data.sharedUsers;
      
      const docRef = await addDoc(this.accountsRef, accountData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<AccountFormData>): Promise<void> {
    try {
      // Check permissions
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const isAdmin = await canAccessAllData();
      
      // Get the account to check ownership
      const account = await this.getById(id);
      if (!account) {
        throw new Error('Account not found');
      }

      // Non-admin users can only update accounts they created or have edit permission via sharing
      if (!isAdmin && account.createdBy !== currentUser.id) {
        const sharedUser = account.sharedUsers?.find(su => su.userId === currentUser.id);
        if (!sharedUser || sharedUser.permission !== 'edit') {
          throw new Error('You do not have permission to edit this account');
        }
      }

      const docRef = doc(this.db, this.collectionName, id);
      
      // Remove undefined fields (Firestore doesn't allow undefined)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      // Only add defined fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.website !== undefined) updateData.website = data.website || null;
      if (data.industry !== undefined) updateData.industry = data.industry || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.billingAddress !== undefined) updateData.billingAddress = data.billingAddress || null;
      if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress || null;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo || null;
      if (data.lastContact !== undefined) updateData.lastContact = data.lastContact ? Timestamp.fromDate(data.lastContact) : null;
      if (data.sharedUsers !== undefined) updateData.sharedUsers = data.sharedUsers || null;
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Account | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToAccount(docSnap);
    } catch (error) {
      console.error('Error getting account:', error);
      throw error;
    }
  }

  async getAll(): Promise<Account[]> {
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
          // Admin can see all accounts
          const q = query(this.accountsRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          docs = querySnapshot.docs;
        } else {
          // Non-admin users can see:
          // 1. Accounts they created
          // 2. Accounts linked to opportunities they own
          // 3. Accounts shared with them (view or edit permission)
          
          // First, get accounts they created
          const createdAccountsQuery = query(
            this.accountsRef,
            where('createdBy', '==', currentUser.id)
          );
          const createdAccountsSnapshot = await getDocs(createdAccountsQuery);
          const createdAccountIds = new Set(createdAccountsSnapshot.docs.map(doc => doc.id));
          
          // Get opportunities owned by the user to find linked accounts
          // Import opportunityService to avoid circular dependency
          const oppService = (await import('./opportunityService')).opportunityService;
          const userOpportunities = await oppService.getByOwner(currentUser.id);
          const linkedAccountIds = new Set(
            userOpportunities
              .filter(opp => opp.accountId)
              .map(opp => opp.accountId!)
          );
          
          // Get accounts shared with the user
          // We need to fetch all accounts and filter in memory since Firestore doesn't support array-contains queries on nested fields easily
          const allAccountsSnapshot = await getDocs(this.accountsRef);
          const sharedAccountIds = new Set(
            allAccountsSnapshot.docs
              .filter(doc => {
                const data = doc.data();
                const sharedUsers = data?.sharedUsers || [];
                return sharedUsers.some((su: any) => su.userId === currentUser.id);
              })
              .map(doc => doc.id)
          );
          
          // Combine all sets of account IDs
          const allAccountIds = new Set([...createdAccountIds, ...linkedAccountIds, ...sharedAccountIds]);
          
          if (allAccountIds.size === 0) {
            docs = [];
          } else {
            // Filter accounts by the combined set
            docs = allAccountsSnapshot.docs.filter(doc => allAccountIds.has(doc.id));
          }
        }
      } catch (queryError: any) {
        // If query fails, try alternative approach
        if (isAdmin) {
          const querySnapshot = await getDocs(this.accountsRef);
          docs = querySnapshot.docs;
        } else {
          // For non-admin, get accounts they created and accounts from their opportunities
          const createdAccountsQuery = query(
            this.accountsRef,
            where('createdBy', '==', currentUser.id)
          );
          const createdAccountsSnapshot = await getDocs(createdAccountsQuery);
          const createdAccountIds = new Set(createdAccountsSnapshot.docs.map(doc => doc.id));
          
          // Get opportunities owned by the user
          const oppService = (await import('./opportunityService')).opportunityService;
          const userOpportunities = await oppService.getByOwner(currentUser.id);
          const linkedAccountIds = new Set(
            userOpportunities
              .filter(opp => opp.accountId)
              .map(opp => opp.accountId!)
          );
          
          // Get accounts shared with the user
          const allAccountsSnapshot = await getDocs(this.accountsRef);
          const sharedAccountIds = new Set(
            allAccountsSnapshot.docs
              .filter(doc => {
                const data = doc.data();
                const sharedUsers = data?.sharedUsers || [];
                return sharedUsers.some((su: any) => su.userId === currentUser.id);
              })
              .map(doc => doc.id)
          );
          
          const allAccountIds = new Set([...createdAccountIds, ...linkedAccountIds, ...sharedAccountIds]);
          
          if (allAccountIds.size === 0) {
            docs = [];
          } else {
            // Fetch accounts by IDs (using getDoc for each)
            const accountPromises = Array.from(allAccountIds).map(accountId => 
              getDoc(doc(this.db, this.collectionName, accountId))
            );
            const accountDocs = await Promise.all(accountPromises);
            docs = accountDocs.filter(docSnap => docSnap.exists()).map(docSnap => docSnap as any);
          }
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
      
      // Convert to Account objects
      let accounts = docs.map(doc => this.convertToAccount(doc as DocumentSnapshot));
      
      // Filter by show_routing_methods config setting
      // Check user setting first, then global, then default (empty array = only manual)
      const showRoutingMethods = await configSettingService.getConfigValue<string[]>(
        'email_parsing.show_routing_methods',
        currentUser.id
      );
      
      if (showRoutingMethods !== null && Array.isArray(showRoutingMethods)) {
        // Filter accounts: show if no routingMethod (manual/import) OR if routingMethod is in allowed list
        accounts = accounts.filter(account => {
          if (!account.routingMethod) {
            return true; // Show accounts without routing method (manual/import)
          }
          return showRoutingMethods.includes(account.routingMethod);
        });
      }
      
      return accounts;
    } catch (error) {
      console.error('Error getting accounts:', error);
      throw error;
    }
  }

  async getByStatus(status: Account['status']): Promise<Account[]> {
    try {
      const q = query(
        this.accountsRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToAccount(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting accounts by status:', error);
      throw error;
    }
  }

  async getByAssignedTo(userId: string): Promise<Account[]> {
    try {
      const q = query(
        this.accountsRef,
        where('assignedTo', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToAccount(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting accounts by assigned user:', error);
      throw error;
    }
  }

  private convertToAccount(doc: DocumentSnapshot): Account {
    const data = doc.data();
    return {
      id: doc.id,
      name: data?.name ?? '',
      website: data?.website,
      industry: data?.industry,
      phone: data?.phone,
      email: data?.email,
      billingAddress: data?.billingAddress,
      shippingAddress: data?.shippingAddress,
      status: data?.status ?? 'prospect',
      description: data?.description,
      assignedTo: data?.assignedTo,
      sharedUsers: data?.sharedUsers || undefined,
      createdBy: data?.createdBy ?? '',
      source: data?.source,
      routingMethod: data?.routingMethod,
      routingConfidence: data?.routingConfidence,
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
      lastContact: data?.lastContact ? (data.lastContact as Timestamp).toDate() : undefined,
    };
  }
}

export const accountService = new AccountService();

