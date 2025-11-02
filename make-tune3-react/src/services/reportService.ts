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
import { db } from './firebase';
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
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const reports: Report[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        let reportedUserId: string | undefined;
        try {
          const submissionUserQuery = query(
            collection(db, 'submissionUsers'),
            where('filePath', '==', data.submissionPath),
            where('collaborationId', '==', data.collaborationId)
          );
          const submissionUserSnap = await getDocs(submissionUserQuery);
          if (!submissionUserSnap.empty) {
            reportedUserId = submissionUserSnap.docs[0].data().userId;
          }
        } catch (e) {
        }

        reports.push({
          id: docSnap.id,
          submissionPath: data.submissionPath,
          collaborationId: data.collaborationId,
          reportedUserId,
          reportedBy: data.reportedBy,
          reportedByUsername: data.reportedByUsername,
          reason: data.reason,
          status: data.status,
          createdAt: data.createdAt,
          resolvedAt: data.resolvedAt,
          resolvedBy: data.resolvedBy
        });
      }
      
      return reports;
    } catch (error) {
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
    adminUserId: string,
    reportedUserId: string,
    submissionPath: string,
    collaborationId: string
  ): Promise<void> {
    try {
      const submissionUserQuery = query(
        collection(db, 'submissionUsers'),
        where('userId', '==', reportedUserId),
        where('filePath', '==', submissionPath),
        where('collaborationId', '==', collaborationId)
      );
      
      const snapshot = await getDocs(submissionUserQuery);
      
      if (!snapshot.empty) {
        const submissionUserRef = doc(db, 'submissionUsers', snapshot.docs[0].id);
        await updateDoc(submissionUserRef, {
          isBanned: true
        });
      }

      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'user-banned',
        resolvedAt: new Date(),
        resolvedBy: adminUserId
      });
    } catch (error) {
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

