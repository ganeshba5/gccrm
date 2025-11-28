import { authService } from '../services/authService';
import type { User } from '../types/user';

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await authService.getCurrentUser();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}

/**
 * Check if the current user can access all data (admin) or only their own
 */
export async function canAccessAllData(): Promise<boolean> {
  return await isAdmin();
}

