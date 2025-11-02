import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  getDoc,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Report, ReportStatus } from '../types/collaboration';

export class ReportService {
  static async createReport(
    submissionPath: string,
    collaborationId: string,
    reportedBy: string,
    reportedByUsername: string | undefined,
    reason: string
  ): Promise<string> {
    try {
      const reportData = {
        submissionPath,
        collaborationId,
        reportedBy,
        reportedByUsername,
        reason,
        status: 'pending' as ReportStatus,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);
      return docRef.id;
    } catch (error) {
      throw error;
    }
  }

  static async getPendingReports(): Promise<Report[]> {
    try {
      const q = query(
        collection(db, 'reports'),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const reports: Report[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        reports.push({
          id: docSnap.id,
          submissionPath: data.submissionPath,
          collaborationId: data.collaborationId,
          reportedBy: data.reportedBy,
          reportedByUsername: data.reportedByUsername,
          reason: data.reason,
          status: data.status,
          createdAt: data.createdAt,
          resolvedAt: data.resolvedAt,
          resolvedBy: data.resolvedBy
        });
      }
      
      reports.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      
      return reports;
    } catch (error) {
      console.error('Error loading reports:', error);
      throw error;
    }
  }

  static async dismissReport(reportId: string, adminUserId: string): Promise<void> {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'dismissed',
        resolvedAt: new Date(),
        resolvedBy: adminUserId
      });
    } catch (error) {
      throw error;
    }
  }

  static async banUserAndResolveReport(
    reportId: string, 
    submissionPath: string,
    collaborationId: string
  ): Promise<void> {
    try {
      const banUserBySubmission = httpsCallable(functions, 'banUserBySubmission');
      const result = await banUserBySubmission({
        reportId,
        submissionPath,
        collaborationId
      });
      
      return result.data as any;
    } catch (error) {
      console.error('Error banning user:', error);
      throw error;
    }
  }

  static async checkExistingReport(
    submissionPath: string,
    collaborationId: string,
    reportedBy: string
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'reports'),
        where('submissionPath', '==', submissionPath),
        where('collaborationId', '==', collaborationId),
        where('reportedBy', '==', reportedBy),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      return false;
    }
  }
}

