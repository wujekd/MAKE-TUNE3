import { doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
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

  static async createProjectWithUniqueName(params: { name: string; description?: string; ownerId: string; tags?: string[]; tagsKey?: string[] }): Promise<Project> {
    const { name, description, ownerId, tags = [], tagsKey = [] } = params;
    const nameKey = name.toLowerCase().replace(/\s+/g, '-');
    const nameIndexRef = doc(db, COLLECTIONS.PROJECT_NAME_INDEX, nameKey);
    const nameSnap = await getDoc(nameIndexRef);
    
    if (nameSnap.exists()) {
      throw new Error('Project name already taken');
    }

    const project = await this.createProject({
      name,
      description: description || '',
      ownerId,
      isActive: true,
      pastCollaborations: [],
      tags,
      tagsKey,
      currentCollaborationId: null,
      currentCollaborationStatus: null,
      currentCollaborationStageEndsAt: null
    });

    try {
      await setDoc(nameIndexRef, {
        nameKey,
        projectId: project.id,
        ownerId,
        createdAt: Timestamp.now()
      }, { merge: false });
    } catch (error) {
      // roll back the project doc if we fail to reserve the name
      await deleteDoc(doc(db, COLLECTIONS.PROJECTS, project.id));
      throw error;
    }

    return project;
  }
}
