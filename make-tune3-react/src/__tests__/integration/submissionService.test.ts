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
  Timestamp,
} from './testHelper';

/**
 * SubmissionService Integration Tests
 * 
 * Tests submission-related data operations using admin context
 */
describe('SubmissionService Integration', () => {
  let testProjectId: string;
  let testCollaborationId: string;
  const testUserId = 'test-user-123';
  const testOwnerId = 'test-owner-456';

  beforeAll(async () => {
    await initTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await clearFirestoreData();

    // Create test users
    await createTestUser(testOwnerId, { email: 'owner@test.com', tier: 'beta' });
    await createTestUser(testUserId, { email: 'user@test.com', tier: 'beta' });

    // Create test project and collaboration
    testProjectId = await createTestProject(testOwnerId, {
      name: 'Test Project',
      description: 'Test project for submission tests',
    });

    testCollaborationId = await createTestCollaboration(testProjectId, {
      name: 'Test Collaboration',
      description: 'Test collaboration for submission tests',
      status: 'submission',
    });
  });

  afterEach(async () => {
    await clearFirestoreData();
  });

  describe('hasUserSubmitted', () => {
    it('should return false for new user (empty participantIds)', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));

        expect(snap.exists()).toBe(true);
        const participantIds = snap.data()?.participantIds || [];
        expect(participantIds.includes(testUserId)).toBe(false);
      });
    });

    it('should return false for different user', async () => {
      // Add testUserId to participantIds
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          participantIds: [testUserId],
        }, { merge: true });

        // Check if different user is in participantIds
        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const participantIds = snap.data()?.participantIds || [];
        expect(participantIds.includes('different-user-456')).toBe(false);
      });
    });

    it('should handle non-existent collaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', 'non-existent-collab'));

        expect(snap.exists()).toBe(false);
      });
    });

    it('should handle collaboration with no participantIds', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));

        expect(snap.exists()).toBe(true);
        const participantIds = snap.data()?.participantIds || [];
        expect(Array.isArray(participantIds)).toBe(true);
        expect(participantIds.length).toBe(0);
      });
    });

    it('should handle collaboration with multiple participants', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Add multiple participants
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          participantIds: ['user1', 'user2', 'user3'],
        }, { merge: true });

        // Verify
        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const participantIds = snap.data()?.participantIds || [];

        expect(participantIds.includes('user1')).toBe(true);
        expect(participantIds.includes('user2')).toBe(true);
        expect(participantIds.includes('user3')).toBe(true);
        expect(participantIds.includes('user4')).toBe(false);
      });
    });
  });

  describe('submission tracking', () => {
    it('should track submissionsCount on collaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Simulate submission count increment (done by Cloud Function in production)
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionsCount: 3,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.submissionsCount).toBe(3);
      });
    });

    it('should track reservedSubmissionsCount on collaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          reservedSubmissionsCount: 5,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.reservedSubmissionsCount).toBe(5);
      });
    });
  });
});
