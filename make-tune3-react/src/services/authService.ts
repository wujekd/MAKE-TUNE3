import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, AuthError } from '../types/auth';

export class AuthService {
  static async registerWithEmail(email: string, password: string, username?: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // If username provided, claim it first to avoid leaving orphaned user docs on failure
      if (username) {
        try {
          await this.claimUsername(user.uid, username);
        } catch (e) {
          try { await deleteUser(user); } catch {}
          throw e;
        }
      }

      const userProfile: User = {
        uid: user.uid,
        email: user.email!,
        createdAt: new Date() as any,
        collaborationIds: [],
        username: username || undefined
      };
      await setDoc(doc(db, 'users', user.uid), userProfile);
      return userProfile;
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  static async loginWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      return userDoc.data() as User;
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  static async signInWithGooglePopup(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user } = result;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const userProfile: User = {
          uid: user.uid,
          email: user.email || '',
          createdAt: new Date() as any,
          collaborationIds: []
        };
        await setDoc(userRef, userProfile);
        return userProfile;
      }
      return snap.data() as User;
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  static async claimUsername(uid: string, rawUsername: string): Promise<void> {
    const username = rawUsername.trim().toLowerCase();
    if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
      throw { code: 'auth/invalid-username', message: 'Username must be 3-20 chars: a-z, 0-9, underscore' };
    }
    const usernameRef = doc(db, 'usernames', username);
    const userRef = doc(db, 'users', uid);
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(usernameRef);
      const userSnap = await tx.get(userRef);
      if (existing.exists()) {
        throw { code: 'auth/username-taken', message: 'Username already taken' };
      }
      if (!userSnap.exists()) {
        throw { code: 'auth/user-not-found', message: 'User profile not found' };
      }
      tx.set(usernameRef, { uid });
      tx.update(userRef, { username });
    });
  }

  static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  static async getUserProfile(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const userData = userDoc.data() as User;
      
      // Migrate existing user profiles that don't have collaborationIds
      if (!userData.collaborationIds) {
        const updatedUser: User = {
          ...userData,
          collaborationIds: []
        };
        await setDoc(doc(db, 'users', uid), updatedUser);
        return updatedUser;
      }
      
      return userData;
    } catch (error: any) {
      throw this.formatError(error);
    }
  }

  private static formatError(error: any): AuthError {
    let message = 'An error occurred during authentication';
    
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later';
        break;
      default:
        message = error.message || message;
    }
    
    return {
      code: error.code || 'unknown',
      message
    };
  }
} 