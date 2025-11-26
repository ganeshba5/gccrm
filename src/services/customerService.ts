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
import type { Customer, CustomerFormData } from '../types/customer';

class CustomerService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly customersRef;

  constructor() {
    this.db = db;
    this.collectionName = 'customers';
    this.customersRef = collection(this.db, this.collectionName);
  }

  async create(data: CustomerFormData): Promise<string> {
    try {
      const customerData = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(this.customersRef, customerData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<CustomerFormData>): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Customer | null> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return this.convertToCustomer(docSnap);
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  async getAll(): Promise<Customer[]> {
    try {
      const q = query(this.customersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToCustomer(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting customers:', error);
      throw error;
    }
  }

  async getByStatus(status: Customer['status']): Promise<Customer[]> {
    try {
      const q = query(
        this.customersRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => this.convertToCustomer(doc as DocumentSnapshot));
    } catch (error) {
      console.error('Error getting customers by status:', error);
      throw error;
    }
  }

  private convertToCustomer(doc: DocumentSnapshot): Customer {
    const data = doc.data();
    return {
      id: doc.id,
      firstName: data?.firstName ?? '',
      lastName: data?.lastName ?? '',
      email: data?.email ?? '',
      phone: data?.phone,
      company: data?.company,
      status: data?.status ?? 'lead',
      notes: data?.notes,
      createdAt: (data?.createdAt as Timestamp).toDate(),
      updatedAt: (data?.updatedAt as Timestamp).toDate(),
      assignedTo: data?.assignedTo,
      lastContact: data?.lastContact ? (data.lastContact as Timestamp).toDate() : undefined
    };
  }
}

export const customerService = new CustomerService();
