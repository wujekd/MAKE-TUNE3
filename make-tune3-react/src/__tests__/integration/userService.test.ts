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
 * UserService Integration Tests
 * 
 * Tests user-related data operations using admin context
 */
describe('UserService Integration', () => {
  const testUserId = 'test-user-123';
  const testOwnerId = 'test-owner-456';
  let testCollaborationId: string;
  let testProjectId: string;

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

    // Create test project
    testProjectId = await createTestProject(testOwnerId, {
      name: 'Test Project',
      description: 'Test project for user service tests',
    });

    // Create test collaboration
    testCollaborationId = await createTestCollaboration(testProjectId, {
      name: 'Test Collaboration',
      description: 'Test collaboration for user service tests',
      status: 'published',
    });
  });

  afterEach(async () => {
    await clearFirestoreData();
  });

  describe('getUserProfile', () => {
    it('should read user profile', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'users', testUserId));

        expect(snap.exists()).toBe(true);
        expect(snap.data()?.email).toBe('user@test.com');
        expect(snap.data()?.tier).toBe('beta');
      });
    });

    it('should return null for non-existent user', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'users', 'non-existent-user'));

        expect(snap.exists()).toBe(false);
      });
    });

    it('should read admin user with isAdmin flag', async () => {
      const adminId = 'admin-user-123';
      await createTestUser(adminId, { email: 'admin@test.com', isAdmin: true });

      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'users', adminId));

        expect(snap.exists()).toBe(true);
        expect(snap.data()?.isAdmin).toBe(true);
      });
    });
  });

  describe('getUserCollaboration', () => {
    it('should create and read userCollaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

        // Create
        await setDoc(userCollabRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          listenedTracks: [],
          listenedRatio: 0,
          lastInteraction: Timestamp.now(),
        });

        // Read
        const snap = await getDoc(userCollabRef);
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.userId).toBe(testUserId);
        expect(snap.data()?.collaborationId).toBe(testCollaborationId);
      });
    });

    it('should return null if user collaboration does not exist', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'userCollaborations', `${testUserId}_non-existent`));

        expect(snap.exists()).toBe(false);
      });
    });
  });

  describe('createUserCollaboration', () => {
    it('should create userCollaboration with required fields', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

        await setDoc(userCollabRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          listenedTracks: ['track1', 'track2'],
          listenedRatio: 0.5,
          lastInteraction: Timestamp.now(),
        });

        const snap = await getDoc(userCollabRef);
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.listenedTracks).toEqual(['track1', 'track2']);
        expect(snap.data()?.listenedRatio).toBe(0.5);
      });
    });

    it('should create userCollaboration with custom fields', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

        await setDoc(userCollabRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          listenedTracks: ['track1'],
          favoriteTracks: ['track1', 'track2'],
          listenedRatio: 0.5,
          finalVote: 'track1',
          lastInteraction: Timestamp.now(),
        });

        const snap = await getDoc(userCollabRef);
        expect(snap.data()?.favoriteTracks).toEqual(['track1', 'track2']);
        expect(snap.data()?.finalVote).toBe('track1');
      });
    });
  });

  describe('updateUserCollaboration', () => {
    it('should update userCollaboration fields', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

        // Create initial
        await setDoc(userCollabRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          listenedTracks: [],
          listenedRatio: 0,
          lastInteraction: Timestamp.now(),
        });

        // Update
        await setDoc(userCollabRef, {
          listenedTracks: ['track1', 'track2'],
          listenedRatio: 0.75,
          lastInteraction: Timestamp.now(),
        }, { merge: true });

        const snap = await getDoc(userCollabRef);
        expect(snap.data()?.listenedTracks).toEqual(['track1', 'track2']);
        expect(snap.data()?.listenedRatio).toBe(0.75);
      });
    });
  });

  describe('userDownloads', () => {
    it('should create userDownload record', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const downloadRef = doc(db, 'userDownloads', `${testUserId}__${testCollaborationId}`);

        await setDoc(downloadRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          downloadedAt: Timestamp.now(),
          downloadCount: 1,
        });

        const snap = await getDoc(downloadRef);
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.userId).toBe(testUserId);
        expect(snap.data()?.downloadCount).toBe(1);
      });
    });

    it('should allow multiple download records', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const downloadRef = doc(db, 'userDownloads', `${testUserId}__${testCollaborationId}`);

        // First download
        await setDoc(downloadRef, {
          userId: testUserId,
          collaborationId: testCollaborationId,
          downloadedAt: Timestamp.now(),
          downloadCount: 1,
        });

        // Second download
        await setDoc(downloadRef, {
          downloadCount: 2,
          lastDownloadAt: Timestamp.now(),
        }, { merge: true });

        const snap = await getDoc(downloadRef);
        expect(snap.data()?.downloadCount).toBe(2);
      });
    });

    it('should return false for non-existent download', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'userDownloads', `${testUserId}__non-existent`));

        expect(snap.exists()).toBe(false);
      });
    });
  });

  describe('getUserCollaborations', () => {
    it('should return empty for user with no collaborations', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, 'users', testUserId));

        expect(snap.exists()).toBe(true);
        const collabIds = snap.data()?.collaborationIds || [];
        expect(Array.isArray(collabIds)).toBe(true);
        expect(collabIds.length).toBe(0);
      });
    });
  });
});
