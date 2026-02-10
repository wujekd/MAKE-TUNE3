import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import type { Project, ProjectId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class ProjectService {
  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Timestamp.now();
    const projectData = {
      ...project,
      tags: project.tags || [],
      tagsKey: project.tagsKey || [],
      createdAt: now,
      updatedAt: now,
      currentCollaborationId: project.currentCollaborationId ?? null,
      currentCollaborationStatus: project.currentCollaborationStatus ?? null,
      currentCollaborationStageEndsAt: project.currentCollaborationStageEndsAt ?? null
    } as Omit<Project, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), projectData as any);
    return { ...(projectData as any), id: docRef.id } as Project;
  }

  static async getProject(projectId: ProjectId): Promise<Project | null> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { ...(docSnap.data() as any), id: docSnap.id } as Project;
  }

  static async updateProject(projectId: ProjectId, updates: Partial<Project>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  static async deleteProject(projectId: ProjectId): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await deleteDoc(docRef);
  }

  static async listUserProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('ownerId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Project));
  }

  static async listAllProjects(): Promise<Project[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.PROJECTS));
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Project));
  }

  static async createProjectWithUniqueName(params: { name: string; description?: string; ownerId: string }): Promise<Project> {
    const createFn = httpsCallable(functions, 'createProjectWithUniqueName');

    // Call cloud function which handles checks, name reservation, and allowance increment
    const result = await createFn({
      name: params.name,
      description: params.description
    });

    const data = result.data as any;

    // Helper to restore timestamps from JSON representation if needed
    const restoreTimestamp = (val: any) => {
      if (val && typeof val._seconds === 'number') {
        return new Timestamp(val._seconds, val._nanoseconds);
      }
      return val;
    };

    return {
      ...data,
      id: data.id,
      createdAt: restoreTimestamp(data.createdAt),
      updatedAt: restoreTimestamp(data.updatedAt)
    } as Project;
  }

  static async recountMyProjectCount(): Promise<number> {
    const recountFn = httpsCallable(functions, 'recountMyProjectCount');
    const result = await recountFn({});
    return Number((result.data as any)?.projectCount || 0);
  }
}
