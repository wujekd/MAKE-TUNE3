import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { SystemSettings } from '../types/collaboration';
import { COLLECTIONS, SYSTEM_SETTINGS_DOC } from '../types/collaboration';

const DEFAULT_SETTINGS: Omit<SystemSettings, 'updatedAt' | 'updatedBy'> = {
  projectCreationEnabled: true,
  submissionsEnabled: true,
  votingEnabled: true,
  defaultProjectAllowance: 0,
  maxSubmissionsPerCollab: 100
};

export class SettingsService {
  static async getSystemSettings(): Promise<SystemSettings | null> {
    const settingsRef = doc(db, COLLECTIONS.SYSTEM_SETTINGS, SYSTEM_SETTINGS_DOC);
    const snap = await getDoc(settingsRef);
    
    if (!snap.exists()) {
      return null;
    }
    
    return snap.data() as SystemSettings;
  }

  static async getSystemSettingsWithDefaults(): Promise<SystemSettings> {
    const settings = await this.getSystemSettings();
    
    if (!settings) {
      return {
        ...DEFAULT_SETTINGS,
        updatedAt: Timestamp.now(),
        updatedBy: 'system'
      };
    }
    
    return {
      ...DEFAULT_SETTINGS,
      ...settings
    };
  }

  static async updateSystemSettings(
    updates: Partial<Omit<SystemSettings, 'updatedAt' | 'updatedBy'>>,
    adminUid: string
  ): Promise<void> {
    const settingsRef = doc(db, COLLECTIONS.SYSTEM_SETTINGS, SYSTEM_SETTINGS_DOC);
    const current = await this.getSystemSettings();
    
    const newSettings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      ...(current || {}),
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: adminUid
    };
    
    await setDoc(settingsRef, newSettings);
  }

  static async initializeSettings(adminUid: string): Promise<SystemSettings> {
    const existing = await this.getSystemSettings();
    if (existing) {
      return existing;
    }

    const initialSettings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      updatedAt: Timestamp.now(),
      updatedBy: adminUid
    };

    const settingsRef = doc(db, COLLECTIONS.SYSTEM_SETTINGS, SYSTEM_SETTINGS_DOC);
    await setDoc(settingsRef, initialSettings);
    
    return initialSettings;
  }
}
