import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types/user';
import { authService } from '../services/authService';

type AuthContextType = {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailVerification: boolean; }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth state listener');
    // Check for existing session on mount
    checkAuthState();
    
    // Check auth state periodically (every 5 minutes)
    const interval = setInterval(() => {
      checkAuthState();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      console.log('Auth state checked:', currentUser ? 'User logged in' : 'No user');
      if (currentUser) {
        console.log('User details:', {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          isActive: currentUser.isActive,
        });
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking auth state:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to sign in with email:', email);
    try {
      const authenticatedUser = await authService.signIn(email, password);
      console.log('Sign in successful:', {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
      });
      setUser(authenticatedUser);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error instanceof Error ? error : new Error('Failed to sign in');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('Attempting to sign up with email:', email);
    try {
      // For now, sign up creates a user in Firestore
      // In production, you might want admin approval
      const { userService } = await import('../services/userService');
      const { hashPassword } = authService;
      
      const hashedPassword = await hashPassword(password);
      const userId = await userService.create({
        email: email.toLowerCase().trim(),
        role: 'user',
        isActive: true,
      });

      // Set password (this would need to be done via a separate method or admin)
      // For now, we'll need to update the user document with password
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await updateDoc(doc(db, 'users', userId), {
        password: hashedPassword,
        updatedAt: Timestamp.now(),
      });

      console.log('Sign up successful');
      
      return {
        error: null,
        needsEmailVerification: false,
      };
    } catch (error) {
      console.error('Sign up failed:', error);
      return {
        error: error instanceof Error ? error : new Error('Failed to sign up'),
        needsEmailVerification: false,
      };
    }
  };

  const signOut = async () => {
    console.log('Attempting to sign out');
    try {
      authService.signOut();
      setUser(null);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error instanceof Error ? error : new Error('Failed to sign out');
    }
  };

  const resendVerificationEmail = async () => {
    // Not applicable for application-level auth
    throw new Error('Email verification is not used with application-level authentication');
  };

  const value = {
    user,
    signIn,
    signUp,
    signOut,
    resendVerificationEmail,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
