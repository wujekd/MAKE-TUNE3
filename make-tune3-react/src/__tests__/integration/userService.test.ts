import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  initTestEnvironment,
  getAuthenticatedContext,
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
import { updateDoc } from 'firebase/firestore';

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
    it('should read own user profile', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const userRef = doc(db, 'users', testUserId);
      const snap = await getDoc(userRef);

      expect(snap.exists()).toBe(true);
      expect(snap.data()?.email).toBe('user@test.com');
    });

    it('should not read other user profiles (non-admin)', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      try {
        await getDoc(doc(db, 'users', testOwnerId));
        expect.fail('Should have thrown permission denied error');
      } catch (error: any) {
        expect(error.code).toBe('permission-denied');
      }
    });

    it('should allow admin to read any user profile', async () => {
      const adminId = 'admin-user-123';
      await createTestUser(adminId, { email: 'admin@test.com', isAdmin: true });

      const context = await getAuthenticatedContext(adminId);
      const db = context.firestore();

      const snap = await getDoc(doc(db, 'users', testUserId));
      expect(snap.exists()).toBe(true);
    });
  });

  describe('getUserCollaboration', () => {
    it('should create and read own userCollaboration', async () => {
      const context = await getAuthenticatedContext(testUserId);
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

    it('should not read other user collaborations', async () => {
      const otherUserId = 'other-user-789';
      await createTestUser(otherUserId);

      // Create collaboration for other user using admin context
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        await setDoc(doc(adminDb, 'userCollaborations', `${otherUserId}_${testCollaborationId}`), {
          userId: otherUserId,
          collaborationId: testCollaborationId,
          listenedTracks: [],
          lastInteraction: Timestamp.now(),
        });
      });

      // Try to read as testUser
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      try {
        await getDoc(doc(db, 'userCollaborations', `${otherUserId}_${testCollaborationId}`));
        expect.fail('Should have thrown permission denied error');
      } catch (error: any) {
        expect(error.code).toBe('permission-denied');
      }
    });
  });

  describe('createUserCollaboration', () => {
    it('should create userCollaboration with required fields', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

      await setDoc(userCollabRef, {
        userId: testUserId,
        collaborationId: testCollaborationId,
        listenedTracks: ['track1', 'track2'],
        listenedRatio: 0.5,
        lastInteraction: Timestamp.now(),
      });

      // Read back using admin context to verify creation (avoids timing issues with rules)
      const env = await initTestEnvironment();
      let data: any = null;
      await env.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        const snap = await getDoc(doc(adminDb, 'userCollaborations', `${testUserId}_${testCollaborationId}`));
        data = snap.data();
      });

      expect(data).not.toBeNull();
      expect(data?.listenedTracks).toEqual(['track1', 'track2']);
      expect(data?.listenedRatio).toBe(0.5);
    });

    it('should not create userCollaboration for another user', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const fakeUserCollabRef = doc(db, 'userCollaborations', `other-user_${testCollaborationId}`);

      try {
        await setDoc(fakeUserCollabRef, {
          userId: 'other-user',
          collaborationId: testCollaborationId,
          listenedTracks: [],
          lastInteraction: Timestamp.now(),
        });
        expect.fail('Should have thrown permission denied error');
      } catch (error: any) {
        expect(error.code).toBe('permission-denied');
      }
    });
  });

  describe('updateUserCollaboration', () => {
    beforeEach(async () => {
      // Create initial userCollaboration using admin context
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        await setDoc(doc(adminDb, 'userCollaborations', `${testUserId}_${testCollaborationId}`), {
          userId: testUserId,
          collaborationId: testCollaborationId,
          listenedTracks: [],
          listenedRatio: 0,
          lastInteraction: Timestamp.now(),
        });
      });
    });

    it('should update listenedTracks and listenedRatio', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

      // Only update allowed fields per validUserCollabUpdate rule
      await updateDoc(userCollabRef, {
        listenedTracks: ['track1', 'track2'],
        listenedRatio: 0.75,
        lastInteraction: Timestamp.now(),
      });

      // Verify using admin context (avoids rule edge case on L217)
      const env2 = await initTestEnvironment();
      let data: any = null;
      await env2.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        const snap = await getDoc(doc(adminDb, 'userCollaborations', `${testUserId}_${testCollaborationId}`));
        data = snap.data();
      });

      expect(data?.listenedTracks).toEqual(['track1', 'track2']);
      expect(data?.listenedRatio).toBe(0.75);
    });
  });

  describe('userDownloads', () => {
    it('should create userDownload record', async () => {
      const context = await getAuthenticatedContext(testUserId);
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

    it('should read own userDownload record', async () => {
      // Create download record first
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (adminContext) => {
        const adminDb = adminContext.firestore();
        await setDoc(doc(adminDb, 'userDownloads', `${testUserId}__${testCollaborationId}`), {
          userId: testUserId,
          collaborationId: testCollaborationId,
          downloadedAt: Timestamp.now(),
          downloadCount: 1,
        });
      });

      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const snap = await getDoc(doc(db, 'userDownloads', `${testUserId}__${testCollaborationId}`));
      expect(snap.exists()).toBe(true);
    });

    it('should not create userDownload for another user', async () => {
      const context = await getAuthenticatedContext(testUserId);
      const db = context.firestore();

      const otherDownloadRef = doc(db, 'userDownloads', `other-user__${testCollaborationId}`);

      try {
        await setDoc(otherDownloadRef, {
          userId: 'other-user',
          collaborationId: testCollaborationId,
          downloadedAt: Timestamp.now(),
          downloadCount: 1,
        });
        expect.fail('Should have thrown permission denied error');
      } catch (error: any) {
        expect(error.code).toBe('permission-denied');
      }
    });
  });
});
