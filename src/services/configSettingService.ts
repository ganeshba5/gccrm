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
import type { ConfigSetting, ConfigSettingFormData, ConfigScope } from '../types/configSetting';

class ConfigSettingService {
  private readonly db: Firestore;
  private readonly collectionName: string;
  private readonly settingsRef;

  constructor() {
    this.db = db;
    this.collectionName = 'configSettings';
    this.settingsRef = collection(this.db, this.collectionName);
  }

  /**
   * Get all config settings, optionally filtered by scope and category
   */
  async getConfigSettings(scope?: ConfigScope, category?: string, userId?: string): Promise<ConfigSetting[]> {
    try {
      await ensureAuthenticated();
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      let q = query(this.settingsRef);

      // Filter by scope
      if (scope) {
        q = query(q, where('scope', '==', scope));
      }

      // Filter by category
      if (category) {
        q = query(q, where('category', '==', category));
      }

      // For user scope, filter by userId
      if (scope === 'user' && userId) {
        q = query(q, where('userId', '==', userId));
      }

      // Order by category and key
      try {
        q = query(q, orderBy('category', 'asc'), orderBy('key', 'asc'));
      } catch (error: any) {
        // If index doesn't exist, try without orderBy
        console.warn('Firestore index not found. Fetching without orderBy:', error.message);
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.convertToConfigSetting(doc));
    } catch (error: any) {
      console.error('Error getting config settings:', error);
      throw error;
    }
  }

  /**
   * Get a specific config setting by key and scope
   */
  async getConfigSetting(key: string, scope: ConfigScope, userId?: string): Promise<ConfigSetting | null> {
    try {
      await ensureAuthenticated();
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      let q = query(
        this.settingsRef,
        where('key', '==', key),
        where('scope', '==', scope)
      );

      if (scope === 'user') {
        const targetUserId = userId || user.id;
        q = query(q, where('userId', '==', targetUserId));
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      return this.convertToConfigSetting(snapshot.docs[0]);
    } catch (error: any) {
      console.error('Error getting config setting:', error);
      throw error;
    }
  }

  /**
   * Get config value with fallback: user setting > global setting > default value
   */
  async getConfigValue<T = any>(key: string, userId?: string): Promise<T | null> {
    try {
      await ensureAuthenticated();
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const targetUserId = userId || user.id;

      // Try user setting first
      const userSetting = await this.getConfigSetting(key, 'user', targetUserId);
      if (userSetting) {
        return userSetting.value as T;
      }

      // Fall back to global setting
      const globalSetting = await this.getConfigSetting(key, 'global');
      if (globalSetting) {
        return globalSetting.value as T;
      }

      // Fall back to predefined default
      const { PREDEFINED_CONFIG_SETTINGS } = await import('../types/configSetting');
      const predefined = PREDEFINED_CONFIG_SETTINGS[key as keyof typeof PREDEFINED_CONFIG_SETTINGS];
      if (predefined?.defaultValue !== undefined) {
        return predefined.defaultValue as T;
      }

      return null;
    } catch (error: any) {
      console.error('Error getting config value:', error);
      return null;
    }
  }

  /**
   * Create or update a config setting
   */
  async setConfigSetting(data: ConfigSettingFormData, userId?: string): Promise<string> {
    try {
      await ensureAuthenticated();
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const isAdmin = await canAccessAllData();
      const targetUserId = userId || user.id;

      // Permission checks
      if (data.scope === 'global' && !isAdmin) {
        throw new Error('Only admins can create or update global settings');
      }

      if (data.scope === 'user' && targetUserId !== user.id && !isAdmin) {
        throw new Error('Users can only manage their own user settings');
      }

      // Validate required fields
      if (data.scope === 'user' && !targetUserId) {
        throw new Error('userId is required for user-scoped settings');
      }

      // Check if setting already exists
      const existing = await this.getConfigSetting(data.key, data.scope, data.scope === 'user' ? targetUserId : undefined);
      
      const now = Timestamp.now();
      const settingData: any = {
        key: data.key,
        scope: data.scope,
        value: data.value,
        valueType: data.valueType,
        isEditable: data.isEditable,
        updatedAt: now,
        updatedBy: user.id,
      };

      // Only add optional fields if they have values (exclude undefined)
      if (data.scope === 'user') {
        settingData.userId = targetUserId;
      }
      if (data.description !== undefined && data.description !== null) {
        settingData.description = data.description;
      }
      if (data.category !== undefined && data.category !== null) {
        settingData.category = data.category;
      }
      if (data.defaultValue !== undefined && data.defaultValue !== null) {
        settingData.defaultValue = data.defaultValue;
      }
      if (data.validation !== undefined && data.validation !== null) {
        settingData.validation = data.validation;
      }

      if (existing) {
        // Update existing setting
        const docRef = doc(this.db, this.collectionName, existing.id);
        await updateDoc(docRef, settingData);
        return existing.id;
      } else {
        // Create new setting
        settingData.createdAt = now;
        settingData.createdBy = user.id;
        const docRef = await addDoc(this.settingsRef, settingData);
        return docRef.id;
      }
    } catch (error: any) {
      console.error('Error setting config setting:', error);
      throw error;
    }
  }

  /**
   * Delete a config setting
   */
  async deleteConfigSetting(settingId: string): Promise<void> {
    try {
      await ensureAuthenticated();
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const isAdmin = await canAccessAllData();

      // Get the setting to check permissions
      const settingDoc = await getDoc(doc(this.db, this.collectionName, settingId));
      if (!settingDoc.exists()) {
        throw new Error('Config setting not found');
      }

      const setting = this.convertToConfigSetting(settingDoc);

      // Permission checks
      if (setting.scope === 'global' && !isAdmin) {
        throw new Error('Only admins can delete global settings');
      }

      if (setting.scope === 'user' && setting.userId !== user.id && !isAdmin) {
        throw new Error('Users can only delete their own user settings');
      }

      await deleteDoc(doc(this.db, this.collectionName, settingId));
    } catch (error: any) {
      console.error('Error deleting config setting:', error);
      throw error;
    }
  }

  /**
   * Convert Firestore document to ConfigSetting
   */
  private convertToConfigSetting(doc: DocumentSnapshot): ConfigSetting {
    const data = doc.data();
    if (!data) {
      throw new Error('Document data is empty');
    }

    return {
      id: doc.id,
      key: data.key,
      scope: data.scope,
      userId: data.userId,
      value: data.value,
      valueType: data.valueType,
      description: data.description,
      category: data.category,
      isEditable: data.isEditable ?? true,
      defaultValue: data.defaultValue,
      validation: data.validation,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  }
}

export const configSettingService = new ConfigSettingService();

