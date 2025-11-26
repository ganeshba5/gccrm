import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  onAuthStateChanged,
  reload
} from 'firebase/auth';
import { auth } from '../lib/firebase';

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
    console.log('Setting up auth state change listener');
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        console.log('User details:', {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          isAnonymous: user.isAnonymous,
          providerData: user.providerData
        });
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to sign in with email:', email);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful:', {
        uid: result.user.uid,
        email: result.user.email,
        emailVerified: result.user.emailVerified
      });
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error instanceof Error ? error : new Error('Failed to sign in');
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('Attempting to sign up with email:', email);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Sign up successful, sending email verification');
      await sendEmailVerification(user);
      console.log('Email verification sent');
      
      return {
        error: null,
        needsEmailVerification: true,
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
      await firebaseSignOut(auth);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error instanceof Error ? error : new Error('Failed to sign out');
    }
  };

  const resendVerificationEmail = async () => {
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }
    try {
      await sendEmailVerification(user);
      console.log('Verification email sent');
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error instanceof Error ? error : new Error('Failed to send verification email');
    }
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