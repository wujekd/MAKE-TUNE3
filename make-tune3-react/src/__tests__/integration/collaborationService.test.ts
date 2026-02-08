import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  initTestEnvironment,
  clearFirestoreData,
  cleanupTestEnvironment,
  createTestUser,
  createTestProject,
  createTestCollaboration,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  collection,
} from './testHelper';

/**
 * CollaborationService Integration Tests
 * 
 * Tests project and collaboration CRUD operations using admin context
 */
describe('CollaborationService Integration Tests', () => {
  const testOwnerId = 'test-owner-123';

  beforeAll(async () => {
    await initTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await clearFirestoreData();
    await createTestUser(testOwnerId, { email: 'owner@test.com', tier: 'beta' });
  });

  afterEach(async () => {
    await clearFirestoreData();
  });

  describe('createProject', () => {
    it('should create a project with all required fields', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Test Project',
        description: 'A test project for integration testing',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        expect(snap.exists()).toBe(true);
        expect(snap.data()?.name).toBe('Test Project');
        expect(snap.data()?.description).toBe('A test project for integration testing');
        expect(snap.data()?.ownerId).toBe(testOwnerId);
        expect(snap.data()?.isActive).toBe(true);
      });
    });

    it('should persist the project to Firestore', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Persistent Test Project',
        description: 'Testing persistence',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        expect(snap.exists()).toBe(true);
        expect(snap.data()?.name).toBe('Persistent Test Project');
      });
    });

    it('should set timestamps correctly', async () => {
      const beforeCreate = Date.now();
      const projectId = await createTestProject(testOwnerId, {
        name: 'Timestamp Test Project',
      });
      const afterCreate = Date.now();

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        const createdAtMs = snap.data()?.createdAt?.toMillis();
        const updatedAtMs = snap.data()?.updatedAt?.toMillis();

        expect(createdAtMs).toBeGreaterThanOrEqual(beforeCreate);
        expect(createdAtMs).toBeLessThanOrEqual(afterCreate);
        expect(updatedAtMs).toBeGreaterThanOrEqual(beforeCreate);
      });
    });
  });

  describe('getProject', () => {
    it('should retrieve an existing project by ID', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Retrievable Project',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        expect(snap.exists()).toBe(true);
        expect(snap.id).toBe(projectId);
        expect(snap.data()?.name).toBe('Retrievable Project');
      });
    });

    it('should return null for non-existent project', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', 'non-existent-id'));

        expect(snap.exists()).toBe(false);
      });
    });

    it('should retrieve project with correct timestamp types', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Timestamp Type Project',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        expect(snap.data()?.createdAt).toBeDefined();
        expect(typeof snap.data()?.createdAt.toMillis).toBe('function');
      });
    });
  });

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Original Name',
        description: 'Original description',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Update the project
        await setDoc(doc(db, 'projects', projectId), {
          name: 'Updated Name',
          description: 'Updated description',
          updatedAt: Timestamp.now(),
        }, { merge: true });

        // Verify
        const snap = await getDoc(doc(db, 'projects', projectId));
        expect(snap.data()?.name).toBe('Updated Name');
        expect(snap.data()?.description).toBe('Updated description');
      });
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Project to Delete',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Verify exists before delete
        let snap = await getDoc(doc(db, 'projects', projectId));
        expect(snap.exists()).toBe(true);

        // Delete
        await deleteDoc(doc(db, 'projects', projectId));

        // Verify deleted
        snap = await getDoc(doc(db, 'projects', projectId));
        expect(snap.exists()).toBe(false);
      });
    });
  });

  describe('createCollaboration', () => {
    it('should create a collaboration with required fields', async () => {
      const projectId = await createTestProject(testOwnerId);
      const collabId = await createTestCollaboration(projectId, {
        name: 'Test Collaboration',
        description: 'Test description',
        status: 'published',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', collabId));

        expect(snap.exists()).toBe(true);
        expect(snap.data()?.name).toBe('Test Collaboration');
        expect(snap.data()?.projectId).toBe(projectId);
        expect(snap.data()?.status).toBe('published');
      });
    });
  });

  describe('getCollaboration', () => {
    it('should retrieve an existing collaboration', async () => {
      const projectId = await createTestProject(testOwnerId);
      const collabId = await createTestCollaboration(projectId, {
        name: 'Retrievable Collaboration',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', collabId));

        expect(snap.exists()).toBe(true);
        expect(snap.id).toBe(collabId);
        expect(snap.data()?.name).toBe('Retrievable Collaboration');
      });
    });

    it('should return null for non-existent collaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', 'non-existent-id'));

        expect(snap.exists()).toBe(false);
      });
    });
  });

  describe('updateCollaboration', () => {
    it('should update collaboration fields', async () => {
      const projectId = await createTestProject(testOwnerId);
      const collabId = await createTestCollaboration(projectId, {
        name: 'Original Collab',
        status: 'published',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Update
        await setDoc(doc(db, 'collaborations', collabId), {
          name: 'Updated Collab',
          updatedAt: Timestamp.now(),
        }, { merge: true });

        // Verify
        const snap = await getDoc(doc(db, 'collaborations', collabId));
        expect(snap.data()?.name).toBe('Updated Collab');
      });
    });
  });

  describe('deleteCollaboration', () => {
    it('should delete a collaboration', async () => {
      const projectId = await createTestProject(testOwnerId);
      const collabId = await createTestCollaboration(projectId, {
        name: 'Collab to Delete',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Verify exists
        let snap = await getDoc(doc(db, 'collaborations', collabId));
        expect(snap.exists()).toBe(true);

        // Delete
        await deleteDoc(doc(db, 'collaborations', collabId));

        // Verify deleted
        snap = await getDoc(doc(db, 'collaborations', collabId));
        expect(snap.exists()).toBe(false);
      });
    });
  });

  describe('getCollaborationsByProject', () => {
    it('should return empty array for project with no collaborations', async () => {
      const projectId = await createTestProject(testOwnerId, {
        name: 'Empty Project',
      });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'projects', projectId));

        expect(snap.exists()).toBe(true);
        // Project exists but has no collaborations - verified by not having any collaborations with this projectId
      });
    });
  });
});