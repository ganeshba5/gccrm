import { authService } from '../services/authService';

/**
 * Ensures the user is authenticated using application-level auth
 * Checks if there's a valid session
 */
export async function ensureAuthenticated(): Promise<void> {
  const session = authService.getSession();
  if (!session) {
    throw new Error('User is not authenticated');
  }
  
  // Check if session is expired
  if (Date.now() > session.expiresAt) {
    authService.clearSession();
    throw new Error('Session expired. Please sign in again.');
  }
  
  // Verify user still exists and is active
  const user = await authService.getCurrentUser();
  if (!user) {
    throw new Error('User not found or inactive');
  }
}

