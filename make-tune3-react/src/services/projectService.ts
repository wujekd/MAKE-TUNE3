import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Project, ProjectId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class ProjectService {
  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Timestamp.now();
    const projectData = {
      ...project,
      createdAt: now,
      updatedAt: now
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

  static async createProjectWithUniqueName(params: { name: string; description?: string; ownerId: string }): Promise<Project> {
    const { name, description, ownerId } = params;
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
      pastCollaborations: []
    });

    await addDoc(collection(db, COLLECTIONS.PROJECT_NAME_INDEX), {
      nameKey,
      projectId: project.id,
      createdAt: Timestamp.now()
    });

    return project;
  }
}

