import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export type FeedbackCategory = 'bug' | 'idea' | 'ui' | 'creator_request' | 'other';
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export interface FeedbackAnswers {
  q1: string;
  q2: string;
  q3: string;
}

export interface Feedback {
  id: string;
  uid: string;
  createdAt: Timestamp;
  category: FeedbackCategory;
  message: string;
  answers?: FeedbackAnswers;
  status: FeedbackStatus;
  adminNote?: string;
  route: string;
}

export interface CreateFeedbackData {
  uid: string;
  category: FeedbackCategory;
  message: string;
  answers?: FeedbackAnswers;
  route: string;
}

export interface FeedbackFilters {
  category?: FeedbackCategory;
  status?: FeedbackStatus;
}

export class FeedbackService {
  static async createFeedback(data: CreateFeedbackData): Promise<string> {
    const feedbackData: Record<string, unknown> = {
      uid: data.uid,
      category: data.category,
      message: data.message,
      route: data.route,
      status: 'new' as FeedbackStatus,
      createdAt: serverTimestamp()
    };

    if (data.answers) {
      feedbackData.answers = data.answers;
    }

    const docRef = await addDoc(collection(db, 'feedback'), feedbackData);
    return docRef.id;
  }

  static async getAllFeedback(filters?: FeedbackFilters): Promise<Feedback[]> {
    let q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));

    if (filters?.category) {
      q = query(
        collection(db, 'feedback'),
        where('category', '==', filters.category),
        orderBy('createdAt', 'desc')
      );
    }

    if (filters?.status) {
      q = query(
        collection(db, 'feedback'),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc')
      );
    }

    if (filters?.category && filters?.status) {
      q = query(
        collection(db, 'feedback'),
        where('category', '==', filters.category),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Feedback));
  }

  static async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    adminNote?: string
  ): Promise<void> {
    const feedbackRef = doc(db, 'feedback', feedbackId);
    const updateData: Record<string, any> = { status };
    if (adminNote !== undefined) {
      updateData.adminNote = adminNote;
    }
    await updateDoc(feedbackRef, updateData);
  }

  static async grantCreatorAccess(uid: string, incrementBy: number = 1): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      bonusProjects: increment(incrementBy)
    });
  }
}
