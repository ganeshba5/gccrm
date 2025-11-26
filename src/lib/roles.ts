import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export async function assignRole(userId: string, role: 'admin' | 'sales') {
  try {
    const addRole = httpsCallable(functions, 'addRole');
    await addRole({ userId, role });
    return { error: null };
  } catch (error) {
    console.error('Error assigning role:', error);
    return { error };
  }
}