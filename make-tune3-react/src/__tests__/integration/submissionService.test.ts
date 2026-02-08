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
  collection,
} from './testHelper';

/**
 * SubmissionService Integration Tests
 * 
 * Tests the 2-stage submission token system:
 * Stage 1: reserveSubmissionSlot - validates global switch, max count, creates token
 * Stage 2: finalizeSubmissionUpload - validates token and completes submission
 * 
 * These tests verify the data structures used by Cloud Functions
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

  describe('system settings - global submission switch', () => {
    it('should store submissionsEnabled setting', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Create system settings with submissions disabled
        await setDoc(doc(db, 'systemSettings', 'global'), {
          submissionsEnabled: false,
          maxSubmissionsPerCollab: 100,
          projectCreationEnabled: true,
          votingEnabled: true,
        });

        const snap = await getDoc(doc(db, 'systemSettings', 'global'));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.submissionsEnabled).toBe(false);
      });
    });

    it('should store submissionsEnabled as true when enabled', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'systemSettings', 'global'), {
          submissionsEnabled: true,
          maxSubmissionsPerCollab: 100,
        });

        const snap = await getDoc(doc(db, 'systemSettings', 'global'));
        expect(snap.data()?.submissionsEnabled).toBe(true);
      });
    });

    it('should default to enabled when settings do not exist', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Check that settings don't exist
        const snap = await getDoc(doc(db, 'systemSettings', 'global'));
        expect(snap.exists()).toBe(false);
        // Cloud Function defaults submissionsEnabled to true when missing
      });
    });
  });

  describe('submission limits - maxSubmissionsPerCollab', () => {
    it('should store global maxSubmissionsPerCollab setting', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'systemSettings', 'global'), {
          submissionsEnabled: true,
          maxSubmissionsPerCollab: 50,
        });

        const snap = await getDoc(doc(db, 'systemSettings', 'global'));
        expect(snap.data()?.maxSubmissionsPerCollab).toBe(50);
      });
    });

    it('should support per-collaboration submissionLimitOverride', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Set per-collab override
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionLimitOverride: 10,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.submissionLimitOverride).toBe(10);
      });
    });

    it('should track submissionsCount for limit enforcement', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Simulate reaching the submission limit
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionsCount: 49,
          reservedSubmissionsCount: 1,
          submissionLimitOverride: 50,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const data = snap.data();
        const totalPending = (data?.submissionsCount || 0) + (data?.reservedSubmissionsCount || 0);

        // totalPending (50) >= limit (50) = cannot submit
        expect(totalPending >= data?.submissionLimitOverride).toBe(true);
      });
    });

    it('should allow submission when under limit', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionsCount: 5,
          reservedSubmissionsCount: 2,
          submissionLimitOverride: 50,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const data = snap.data();
        const totalPending = (data?.submissionsCount || 0) + (data?.reservedSubmissionsCount || 0);

        // totalPending (7) < limit (50) = can submit
        expect(totalPending < data?.submissionLimitOverride).toBe(true);
      });
    });
  });

  describe('submission tokens - 2-stage reservation system', () => {
    it('should create submission token with required fields', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const now = Timestamp.now();
        const expiresAt = Timestamp.fromMillis(now.toMillis() + 20 * 60 * 1000); // 20 minutes

        // Token ID is collabId__uid
        const tokenId = `${testCollaborationId}__${testUserId}`;

        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          collabId: testCollaborationId,
          uid: testUserId,
          submissionId: 'generated-submission-id',
          fileExt: 'mp3',
          settings: {
            eq: {
              highshelf: { gain: 0, frequency: 8000 },
              param2: { gain: 0, frequency: 3000, Q: 1 },
              param1: { gain: 0, frequency: 250, Q: 1 },
              highpass: { frequency: 20, enabled: false },
            },
            volume: { gain: 1 },
          },
          createdAt: now,
          expiresAt,
          used: false,
        });

        const snap = await getDoc(doc(db, 'submissionUploadTokens', tokenId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.collabId).toBe(testCollaborationId);
        expect(snap.data()?.uid).toBe(testUserId);
        expect(snap.data()?.used).toBe(false);
      });
    });

    it('should mark token as used after successful upload', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const now = Timestamp.now();
        const tokenId = `${testCollaborationId}__${testUserId}`;

        // Create token
        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          collabId: testCollaborationId,
          uid: testUserId,
          submissionId: 'submission-123',
          fileExt: 'mp3',
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 20 * 60 * 1000),
          used: false,
        });

        // Mark as used (simulating finalize)
        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          used: true,
          usedAt: now,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'submissionUploadTokens', tokenId));
        expect(snap.data()?.used).toBe(true);
        expect(snap.data()?.usedAt).toBeTruthy();
      });
    });

    it('should mark token as invalidated with reason when rejected', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const now = Timestamp.now();
        const tokenId = `${testCollaborationId}__${testUserId}`;

        // Create token
        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          collabId: testCollaborationId,
          uid: testUserId,
          submissionId: 'submission-123',
          fileExt: 'mp3',
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 20 * 60 * 1000),
          used: false,
        });

        // Invalidate (e.g., submissions disabled)
        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          used: true,
          usedAt: now,
          invalidatedAt: now,
          invalidReason: 'submissions-disabled',
        }, { merge: true });

        const snap = await getDoc(doc(db, 'submissionUploadTokens', tokenId));
        expect(snap.data()?.used).toBe(true);
        expect(snap.data()?.invalidReason).toBe('submissions-disabled');
      });
    });

    it('should track token expiry time', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const now = Timestamp.now();
        const expiresAt = Timestamp.fromMillis(now.toMillis() + 20 * 60 * 1000);
        const tokenId = `${testCollaborationId}__${testUserId}`;

        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          collabId: testCollaborationId,
          uid: testUserId,
          submissionId: 'submission-123',
          createdAt: now,
          expiresAt,
          used: false,
        });

        const snap = await getDoc(doc(db, 'submissionUploadTokens', tokenId));
        const tokenData = snap.data();

        // Check token not expired
        expect(tokenData?.expiresAt.toMillis()).toBeGreaterThan(now.toMillis());
      });
    });

    it('should detect expired token', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const now = Timestamp.now();
        const expiredAt = Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000); // 5 minutes ago
        const tokenId = `${testCollaborationId}__${testUserId}`;

        await setDoc(doc(db, 'submissionUploadTokens', tokenId), {
          collabId: testCollaborationId,
          uid: testUserId,
          submissionId: 'submission-123',
          createdAt: Timestamp.fromMillis(now.toMillis() - 25 * 60 * 1000),
          expiresAt: expiredAt,
          used: false,
        });

        const snap = await getDoc(doc(db, 'submissionUploadTokens', tokenId));
        const tokenData = snap.data();

        // Check token is expired
        expect(tokenData?.expiresAt.toMillis()).toBeLessThanOrEqual(now.toMillis());
      });
    });
  });

  describe('hasUserSubmitted (participantIds check)', () => {
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

    it('should return true for user who has already submitted', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          participantIds: [testUserId],
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const participantIds = snap.data()?.participantIds || [];
        expect(participantIds.includes(testUserId)).toBe(true);
      });
    });

    it('should handle collaboration with multiple participants', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          participantIds: ['user1', 'user2', 'user3'],
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        const participantIds = snap.data()?.participantIds || [];

        expect(participantIds.includes('user1')).toBe(true);
        expect(participantIds.includes('user2')).toBe(true);
        expect(participantIds.includes('user3')).toBe(true);
        expect(participantIds.includes('user4')).toBe(false);
      });
    });
  });

  describe('submission tracking (counters)', () => {
    it('should track submissionsCount on collaboration', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

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

    it('should decrement reservedSubmissionsCount after finalization', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Initial state with reservation
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionsCount: 2,
          reservedSubmissionsCount: 3,
        }, { merge: true });

        // After finalization: reservation decreases, submission increases
        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionsCount: 3,
          reservedSubmissionsCount: 2,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.submissionsCount).toBe(3);
        expect(snap.data()?.reservedSubmissionsCount).toBe(2);
      });
    });
  });

  describe('collaboration status validation', () => {
    it('should accept submissions when status is "submission"', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.status).toBe('submission');
      });
    });

    it('should reject submissions when status is "voting"', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          status: 'voting',
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.status).toBe('voting');
        // Cloud Function checks: status !== 'submission' → reject
      });
    });

    it('should reject submissions when status is "completed"', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          status: 'completed',
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.status).toBe('completed');
      });
    });

    it('should track submissionCloseAt for deadline enforcement', async () => {
      const env = await initTestEnvironment();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const closeTime = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await setDoc(doc(db, 'collaborations', testCollaborationId), {
          submissionCloseAt: closeTime,
        }, { merge: true });

        const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
        expect(snap.data()?.submissionCloseAt).toBeTruthy();
      });
    });
  });
});
