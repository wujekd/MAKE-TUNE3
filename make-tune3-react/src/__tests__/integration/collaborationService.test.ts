import { describe, it, expect, afterEach } from 'vitest';
import { CollaborationService } from '../../services/collaborationService';

const PROJECT_ID = 'demo-test-project';

async function clearFirestoreData() {
  await fetch(`http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: 'DELETE'
  });
}

describe('CollaborationService Integration Tests', () => {
  afterEach(async () => {
    await clearFirestoreData();
  });

  describe('createProject', () => {
    it('should create a project with all required fields', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
        ownerId: 'test-user-123',
        isActive: true,
        pastCollaborations: []
      };

      const createdProject = await CollaborationService.createProject(projectData);

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
        ownerId: 'test-user-456',
        isActive: true,
        pastCollaborations: []
      };

      const createdProject = await CollaborationService.createProject(projectData);
      const retrievedProject = await CollaborationService.getProject(createdProject.id);

      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject?.id).toBe(createdProject.id);
      expect(retrievedProject?.name).toBe(projectData.name);
      expect(retrievedProject?.ownerId).toBe(projectData.ownerId);
    });

    it('should generate unique IDs for multiple projects', async () => {
      const projectData1 = {
        name: 'Project One',
        description: 'First project',
        ownerId: 'test-user-789',
        isActive: true,
        pastCollaborations: []
      };

      const projectData2 = {
        name: 'Project Two',
        description: 'Second project',
        ownerId: 'test-user-789',
        isActive: true,
        pastCollaborations: []
      };

      const project1 = await CollaborationService.createProject(projectData1);
      const project2 = await CollaborationService.createProject(projectData2);

      expect(project1.id).not.toBe(project2.id);
      
      const retrieved1 = await CollaborationService.getProject(project1.id);
      const retrieved2 = await CollaborationService.getProject(project2.id);
      
      expect(retrieved1?.name).toBe('Project One');
      expect(retrieved2?.name).toBe('Project Two');
    });

    it('should set timestamps correctly', async () => {
      const beforeCreate = Date.now();
      
      const projectData = {
        name: 'Timestamp Test Project',
        description: 'Testing timestamps',
        ownerId: 'test-user-timestamp',
        isActive: true,
        pastCollaborations: []
      };

      const createdProject = await CollaborationService.createProject(projectData);
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
});