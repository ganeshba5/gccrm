import {import {

  collection,  collection,

  doc,  doc,

  addDoc,  addDoc,

  updateDoc,  updateDoc,

  deleteDoc,  deleteDoc,

  getDoc,  getDoc,

  getDocs,  getDocs,

  query,  query,

  where,  where,

  orderBy,  orderBy,

  Timestamp,  Timestamp,

  DocumentSnapshot,  DocumentSnapshot,

} from 'firebase/firestore';  Firestore,

import { db } from '../lib/firebase';  QueryDocumentSnapshot,

import type { Customer, CustomerFormData } from '../types/customer';} from 'firebase/firestore';

import { db } from '../lib/firebase';

const COLLECTION_NAME = 'customers';import type { Customer, CustomerFormData } from '../types/customer';

const customersRef = collection(db, COLLECTION_NAME);

class CustomerService {

function convertToCustomer(doc: DocumentSnapshot): Customer {  private readonly db: Firestore;

  const data = doc.data();  private readonly collectionName: string;

  return {  private readonly customersRef;

    id: doc.id,

    firstName: data?.firstName ?? '',  constructor() {

    lastName: data?.lastName ?? '',    this.db = db;

    email: data?.email ?? '',    this.collectionName = 'customers';

    phone: data?.phone,    this.customersRef = collection(this.db, this.collectionName);

    company: data?.company,  }

    status: data?.status ?? 'lead',

    notes: data?.notes,  async create(data: CustomerFormData): Promise<string> {

    createdAt: (data?.createdAt as Timestamp).toDate(),    try {

    updatedAt: (data?.updatedAt as Timestamp).toDate(),      const customerData = {

    assignedTo: data?.assignedTo,        ...data,

    lastContact: data?.lastContact ? (data.lastContact as Timestamp).toDate() : undefined        createdAt: Timestamp.now(),

  };        updatedAt: Timestamp.now()

}      };

      

export const customerService = {      const docRef = await addDoc(this.customersRef, customerData);

  async create(data: CustomerFormData): Promise<string> {      return docRef.id;

    try {    } catch (error) {

      const customerData = {      console.error('Error creating customer:', error);

        ...data,      throw error;

        createdAt: Timestamp.now(),    }

        updatedAt: Timestamp.now()  }

      };

        async update(id: string, data: Partial<CustomerFormData>): Promise<void> {

      const docRef = await addDoc(customersRef, customerData);    try {

      return docRef.id;      const docRef = doc(this.db, this.collectionName, id);

    } catch (error) {      await updateDoc(docRef, {

      console.error('Error creating customer:', error);        ...data,

      throw error;        updatedAt: Timestamp.now()

    }      });

  },    } catch (error) {

      console.error('Error updating customer:', error);

  async update(id: string, data: Partial<CustomerFormData>): Promise<void> {      throw error;

    try {    }

      const docRef = doc(db, COLLECTION_NAME, id);  }

      await updateDoc(docRef, {

        ...data,  async delete(id: string): Promise<void> {

        updatedAt: Timestamp.now()    try {

      });      const docRef = doc(this.db, this.collectionName, id);

    } catch (error) {      await deleteDoc(docRef);

      console.error('Error updating customer:', error);    } catch (error) {

      throw error;      console.error('Error deleting customer:', error);

    }      throw error;

  },    }

  }

  async delete(id: string): Promise<void> {

    try {  async getById(id: string): Promise<Customer | null> {

      const docRef = doc(db, COLLECTION_NAME, id);    try {

      await deleteDoc(docRef);      const docRef = doc(this.db, this.collectionName, id);

    } catch (error) {      const docSnap = await getDoc(docRef);

      console.error('Error deleting customer:', error);      

      throw error;      if (!docSnap.exists()) {

    }        return null;

  },      }



  async getById(id: string): Promise<Customer | null> {      return this.convertToCustomer(docSnap);

    try {    } catch (error) {

      const docRef = doc(db, COLLECTION_NAME, id);      console.error('Error getting customer:', error);

      const docSnap = await getDoc(docRef);      throw error;

          }

      if (!docSnap.exists()) {  }

        return null;

      }  async getAll(): Promise<Customer[]> {

    try {

      return convertToCustomer(docSnap);      const q = query(this.customersRef, orderBy('createdAt', 'desc'));

    } catch (error) {      const querySnapshot = await getDocs(q);

      console.error('Error getting customer:', error);      

      throw error;      return querySnapshot.docs.map(doc => this.convertToCustomer(doc as DocumentSnapshot));

    }    } catch (error) {

  },      console.error('Error getting customers:', error);

      throw error;

  async getAll(): Promise<Customer[]> {    }

    try {  }

      const q = query(customersRef, orderBy('createdAt', 'desc'));

      const querySnapshot = await getDocs(q);  async getByStatus(status: Customer['status']): Promise<Customer[]> {

          try {

      return querySnapshot.docs.map(doc => convertToCustomer(doc as DocumentSnapshot));      const q = query(

    } catch (error) {        this.customersRef,

      console.error('Error getting customers:', error);        where('status', '==', status),

      throw error;        orderBy('createdAt', 'desc')

    }      );

  },      const querySnapshot = await getDocs(q);

      

  async getByStatus(status: Customer['status']): Promise<Customer[]> {      return querySnapshot.docs.map(doc => this.convertToCustomer(doc as DocumentSnapshot));

    try {    } catch (error) {

      const q = query(      console.error('Error getting customers by status:', error);

        customersRef,      throw error;

        where('status', '==', status),    }

        orderBy('createdAt', 'desc')  }

      );

      const querySnapshot = await getDocs(q);  private convertToCustomer(doc: DocumentSnapshot): Customer {

          const data = doc.data();

      return querySnapshot.docs.map(doc => convertToCustomer(doc as DocumentSnapshot));    return {

    } catch (error) {      id: doc.id,

      console.error('Error getting customers by status:', error);      firstName: data?.firstName ?? '',

      throw error;      lastName: data?.lastName ?? '',

    }      email: data?.email ?? '',

  }      phone: data?.phone,

};      company: data?.company,
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