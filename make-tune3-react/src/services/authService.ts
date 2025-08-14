import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, AuthError } from '../types/auth';

export class AuthService {
  static async registerWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      const userProfile: User = {
        uid: user.uid,
        email: user.email!,
        createdAt: new Date() as any, // Will be converted to Timestamp by Firestore
        collaborationIds: [] // Initialize with empty array
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