import { describe, it, expect, afterEach } from 'vitest';
import { CollaborationService, ProjectService } from '../../services';

const PROJECT_ID = 'demo-test-project';

async function clearFirestoreData() {
  await fetch(`http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: 'DELETE'
  });
}

describe('CollaborationService Integration Tests', () => {
  afterEach(async () => {
    await clearFirestoreData();
    await new Promise(resolve => setTimeout(resolve, 130));
  });

  describe('createProject', () => {
    it('should create a project with all required fields', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
        tags: [],
        tagsKey: [],
        ownerId: 'test-user-123',
        isActive: true,
        pastCollaborations: []
      };

      const createdProject = await ProjectService.createProject(projectData);

      expect(createdProject.id).toBeDefined();
      expect(typeof createdProject.id).toBe('string');
      expect(createdProject.id.length).toBeGreaterThan(0);
      
      expect(createdProject.name).toBe(projectData.name);
      expect(createdProject.description).toBe(projectData.description);
      expect(createdProject.ownerId).toBe(projectData.ownerId);
      expect(createdProject.isActive).toBe(true);
      
      expect(createdProject.createdAt).toBeDefined();
      expect(createdProject.updatedAt).toBeDefined();
      
      expect(Array.isArray(createdProject.pastCollaborations)).toBe(true);
      expect(createdProject.pastCollaborations.length).toBe(0);
    });

    it('should persist the project to Firestore', async () => {
      const projectData = {
        name: 'Persistent Test Project',
        description: 'Testing persistence',
        tags: [],
        tagsKey: [],
        ownerId: 'test-user-456',
        isActive: true,
        pastCollaborations: []
      };

      const createdProject = await ProjectService.createProject(projectData);
      const retrievedProject = await ProjectService.getProject(createdProject.id);

      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject?.id).toBe(createdProject.id);
      expect(retrievedProject?.name).toBe(projectData.name);
      expect(retrievedProject?.ownerId).toBe(projectData.ownerId);
    });


    it('should set timestamps correctly', async () => {
      const beforeCreate = Date.now();
      
      const projectData = {
        name: 'Timestamp Test Project',
        description: 'Testing timestamps',
        ownerId: 'test-user-timestamp',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      };

      const createdProject = await ProjectService.createProject(projectData);
      const afterCreate = Date.now();

      const createdAtMs = createdProject.createdAt.toMillis();
      const updatedAtMs = createdProject.updatedAt.toMillis();

      expect(createdAtMs).toBeGreaterThanOrEqual(beforeCreate);
      expect(createdAtMs).toBeLessThanOrEqual(afterCreate);
      
      expect(updatedAtMs).toBeGreaterThanOrEqual(beforeCreate);
      expect(updatedAtMs).toBeLessThanOrEqual(afterCreate);
      
      expect(createdAtMs).toBe(updatedAtMs);
    });
  });

  describe('getProject', () => {
    it('should retrieve an existing project by ID', async () => {
      const projectData = {
        name: 'Retrievable Project',
        description: 'Testing retrieval',
        ownerId: 'test-user-get',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      };

      const created = await ProjectService.createProject(projectData);
      
      const retrieved = await ProjectService.getProject(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(projectData.name);
      expect(retrieved?.description).toBe(projectData.description);
      expect(retrieved?.ownerId).toBe(projectData.ownerId);
    });

    it('should return null for non-existent project', async () => {
      const result = await ProjectService.getProject('non-existent-id-12345');

      expect(result).toBeNull();
    });

    it('should retrieve project with correct timestamp types', async () => {
      const projectData = {
        name: 'Timestamp Project',
        description: 'Testing timestamp retrieval',
        ownerId: 'test-user-timestamps',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      };

      const created = await ProjectService.createProject(projectData);
      const retrieved = await ProjectService.getProject(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.createdAt).toBeDefined();
      expect(retrieved?.updatedAt).toBeDefined();
      expect(typeof retrieved?.createdAt.toMillis).toBe('function');
      expect(typeof retrieved?.updatedAt.toMillis).toBe('function');
    });
  });

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const projectData = {
        name: 'Original Name',
        description: 'Original description for testing',
        ownerId: 'test-user-update',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      };

      const created = await ProjectService.createProject(projectData);
      
      await ProjectService.updateProject(created.id, {
        name: 'Updated Name',
        description: 'Updated description for testing'
      });

      const updated = await ProjectService.getProject(created.id);

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated description for testing');
      expect(updated?.ownerId).toBe(projectData.ownerId);
    });

  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectData = {
        name: 'Project To Delete',
        description: 'This project will be deleted',
        ownerId: 'test-user-delete',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      };

      const created = await ProjectService.createProject(projectData);
      
      await ProjectService.deleteProject(created.id);

      const retrieved = await ProjectService.getProject(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('createCollaboration', () => {
    it('should create a collaboration with required fields', async () => {
      const project = await ProjectService.createProject({
        name: 'Test Project',
        description: 'Project for collaboration test',
        tags: [],
        tagsKey: [],
        ownerId: 'test-user-collab',
        isActive: true,
        pastCollaborations: []
      });

      const collabData = {
        projectId: project.id,
        name: 'Test Collaboration',
        description: 'Test description',
        tags: [],
        tagsKey: [],
        status: 'unpublished' as const,
        backingTrackPath: '',
        submissionDuration: 7,
        votingDuration: 3,
        publishedAt: null,
        participantIds: [],
        submissions: []
      };

      const created = await CollaborationService.createCollaboration(collabData);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(collabData.name);
      expect(created.status).toBe('unpublished');
      expect(created.projectId).toBe(project.id);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });
  });

  describe('getCollaboration', () => {
    it('should retrieve an existing collaboration', async () => {
      const project = await ProjectService.createProject({
        name: 'Test Project',
        description: 'Project for get collaboration test',
        ownerId: 'test-user',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      });

      const collabData = {
        projectId: project.id,
        name: 'Retrievable Collaboration',
        description: 'Test description',
        status: 'unpublished' as const,
        backingTrackPath: '',
        submissionDuration: 7,
        votingDuration: 3,
        publishedAt: null,
        participantIds: [],
        submissions: [],
        tags: [],
        tagsKey: []
      };

      const created = await CollaborationService.createCollaboration(collabData);
      const retrieved = await CollaborationService.getCollaboration(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(collabData.name);
    });

    it('should return null for non-existent collaboration', async () => {
      const result = await CollaborationService.getCollaboration('non-existent-collab-id');
      expect(result).toBeNull();
    });
  });

  describe('updateCollaboration', () => {
    it('should update collaboration fields', async () => {
      const project = await ProjectService.createProject({
        name: 'Test Project',
        description: 'Project for update collaboration test',
        ownerId: 'test-user',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      });

      const created = await CollaborationService.createCollaboration({
        projectId: project.id,
        name: 'Original Collab Name',
        description: 'Test description',
        status: 'unpublished' as const,
        backingTrackPath: '',
        submissionDuration: 7,
        votingDuration: 3,
        publishedAt: null,
        participantIds: [],
        submissions: [],
        tags: [],
        tagsKey: []
      });

      await CollaborationService.updateCollaboration(created.id, {
        name: 'Updated Collab Name',
        status: 'submission'
      });

      const updated = await CollaborationService.getCollaboration(created.id);

      expect(updated?.name).toBe('Updated Collab Name');
      expect(updated?.status).toBe('submission');
    });
  });

  describe('deleteCollaboration', () => {
    it('should delete a collaboration', async () => {
      const project = await ProjectService.createProject({
        name: 'Test Project',
        description: 'Project for delete collaboration test',
        ownerId: 'test-user',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      });

      const created = await CollaborationService.createCollaboration({
        projectId: project.id,
        name: 'Collab To Delete',
        description: 'Test description',
        status: 'unpublished' as const,
        backingTrackPath: '',
        submissionDuration: 7,
        votingDuration: 3,
        publishedAt: null,
        participantIds: [],
        submissions: [],
        tags: [],
        tagsKey: []
      });

      await CollaborationService.deleteCollaboration(created.id);

      const retrieved = await CollaborationService.getCollaboration(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('getCollaborationsByProject', () => {

    it('should return empty array for project with no collaborations', async () => {
      const project = await ProjectService.createProject({
        name: 'Empty Project',
        description: 'Project with no collaborations',
        ownerId: 'test-user',
        isActive: true,
        pastCollaborations: [],
        tags: [],
        tagsKey: []
      });

      const collabs = await CollaborationService.getCollaborationsByProject(project.id);
      expect(collabs).toEqual([]);
    });
  });
});