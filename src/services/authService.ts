/**
 * Application-level authentication service
 * Authenticates users against Firestore users collection instead of Firebase Auth
 */

import { collection, query, where, getDocs, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types/user';
import bcrypt from 'bcryptjs';

const SESSION_STORAGE_KEY = 'gccrm_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Session {
  userId: string;
  email: string;
  role: User['role'];
  expiresAt: number;
}

class AuthService {
  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<User> {
    try {
      // Find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Invalid email or password');
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Check if user is active
      if (!userData.isActive) {
        throw new Error('Account is inactive. Please contact an administrator.');
      }

      // Get password hash from Firestore
      const passwordHash = userData.password;
      
      if (!passwordHash) {
        // If no password is set, allow first-time login with default password
        const defaultPassword = 'Welcome@123';
        const isValid = password === defaultPassword;
        
        if (!isValid) {
          throw new Error('Invalid email or password');
        }
        
        // Hash and save the password
        const hashedPassword = await this.hashPassword(password);
        await updateDoc(doc(db, 'users', userDoc.id), {
          password: hashedPassword,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Verify password
        const isValid = await this.verifyPassword(password, passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }
      }

      // Update last login
      await updateDoc(doc(db, 'users', userDoc.id), {
        lastLogin: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Create user object (without password)
      const user: User = {
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        photoURL: userData.photoURL,
        role: userData.role || 'user',
        isActive: userData.isActive ?? true,
        department: userData.department,
        title: userData.title,
        createdAt: (userData.createdAt as Timestamp).toDate(),
        updatedAt: (userData.updatedAt as Timestamp).toDate(),
        lastLogin: userData.lastLogin ? (userData.lastLogin as Timestamp).toDate() : undefined,
      };

      // Create session
      this.createSession(user);

      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error instanceof Error ? error : new Error('Failed to sign in');
    }
  }

  /**
   * Create a session and store it
   */
  createSession(user: User): void {
    const session: Session = {
      userId: user.id,
      email: user.email,
      role: user.role,
      expiresAt: Date.now() + SESSION_DURATION,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    try {
      const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionStr) return null;

      const session: Session = JSON.parse(sessionStr);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Get current user from session
   */
  async getCurrentUser(): Promise<User | null> {
    const session = this.getSession();
    if (!session) return null;

    try {
      // Fetch user from Firestore by ID
      const userDocRef = doc(db, 'users', session.userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        this.clearSession();
        return null;
      }

      const userData = userDocSnap.data();

      // Check if user is still active
      if (!userData.isActive) {
        this.clearSession();
        return null;
      }

      return {
        id: userDocSnap.id,
        email: userData.email,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        photoURL: userData.photoURL,
        role: userData.role || 'user',
        isActive: userData.isActive ?? true,
        department: userData.department,
        title: userData.title,
        createdAt: (userData.createdAt as Timestamp).toDate(),
        updatedAt: (userData.updatedAt as Timestamp).toDate(),
        lastLogin: userData.lastLogin ? (userData.lastLogin as Timestamp).toDate() : undefined,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    this.clearSession();
  }

  /**
   * Clear session
   */
  clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
}

export const authService = new AuthService();

