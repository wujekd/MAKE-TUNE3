import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebaseDb';
import { callFirebaseFunction } from './firebaseFunctions';

export class ReportService {
  static async createReport(
    submissionPath: string,
    collaborationId: string,
    reportedBy: string,
    reportedByUsername: string | undefined,
    reason: string
  ): Promise<string> {
    const reportData = {
      submissionPath,
      collaborationId,
      reportedBy,
      reportedByUsername,
      reason,
      status: 'pending',
      createdAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);
    return docRef.id;
  }

  static async dismissReport(reportId: string, adminUserId: string): Promise<void> {
    try {
      const reportRef = doc(db, 'reports', reportId);
      const reportSnap = await getDoc(reportRef);
      
      if (!reportSnap.exists()) {
        throw new Error('Report not found');
      }

      const reportData = reportSnap.data();
      
      const batch = writeBatch(db);
      
      batch.update(reportRef, {
        status: 'dismissed',
        resolvedAt: serverTimestamp(),
        resolvedBy: adminUserId
      });

      const resolvedReportRef = doc(collection(db, 'resolvedReports'));
      batch.set(resolvedReportRef, {
        ...reportData,
        originalReportId: reportId,
        status: 'dismissed',
        resolvedAt: serverTimestamp(),
        resolvedBy: adminUserId
      });

      await batch.commit();
    } catch (error) {
      console.error('Error dismissing report:', error);
      throw error;
    }
  }

  static async banUserAndResolveReport(
    reportId: string, 
    submissionPath: string,
    collaborationId: string
  ): Promise<void> {
    try {
      await callFirebaseFunction('banUserBySubmission', {
        reportId,
        submissionPath,
        collaborationId
      });
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
    } catch {
      return false;
    }
  }
}
