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
 * Voting Service Integration Tests
 * 
 * These tests verify the core voting flow data structures and transitions
 * using admin context for setup and verification.
 */
describe('Voting Service Integration', () => {
    let testProjectId: string;
    let testCollaborationId: string;
    const testUserId = 'test-voter-123';
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
        await createTestUser(testUserId, { email: 'voter@test.com', tier: 'beta' });

        // Create test project
        testProjectId = await createTestProject(testOwnerId, {
            name: 'Voting Test Project',
            description: 'Project for voting tests',
        });

        // Create collaboration in voting status
        testCollaborationId = await createTestCollaboration(testProjectId, {
            name: 'Voting Test Collaboration',
            description: 'Collaboration for voting tests',
            status: 'voting',
        });
    });

    afterEach(async () => {
        await clearFirestoreData();
    });

    describe('collaboration status', () => {
        it('should have voting status set correctly', async () => {
            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const snap = await getDoc(doc(db, 'collaborations', testCollaborationId));
                expect(snap.exists()).toBe(true);
                expect(snap.data()?.status).toBe('voting');
            });
        });

        it('should support different collaboration statuses', async () => {
            const publishedCollabId = await createTestCollaboration(testProjectId, {
                name: 'Published Collab',
                status: 'published',
            });
            const completedCollabId = await createTestCollaboration(testProjectId, {
                name: 'Completed Collab',
                status: 'completed',
            });

            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();

                const publishedSnap = await getDoc(doc(db, 'collaborations', publishedCollabId));
                expect(publishedSnap.data()?.status).toBe('published');

                const completedSnap = await getDoc(doc(db, 'collaborations', completedCollabId));
                expect(completedSnap.data()?.status).toBe('completed');
            });
        });
    });

    describe('userCollaboration tracking', () => {
        it('should create userCollaboration record with required fields', async () => {
            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

                await setDoc(userCollabRef, {
                    userId: testUserId,
                    collaborationId: testCollaborationId,
                    listenedTracks: [],
                    listenedRatio: 0,
                    lastInteraction: Timestamp.now(),
                });

                const snap = await getDoc(userCollabRef);
                expect(snap.exists()).toBe(true);
                expect(snap.data()?.userId).toBe(testUserId);
                expect(snap.data()?.collaborationId).toBe(testCollaborationId);
            });
        });

        it('should track listened tracks in userCollaboration', async () => {
            const track1 = `collabs/${testCollaborationId}/submissions/track1.mp3`;
            const track2 = `collabs/${testCollaborationId}/submissions/track2.mp3`;

            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

                await setDoc(userCollabRef, {
                    userId: testUserId,
                    collaborationId: testCollaborationId,
                    listenedTracks: [track1, track2],
                    listenedRatio: 1.0,
                    lastInteraction: Timestamp.now(),
                });

                const snap = await getDoc(userCollabRef);
                expect(snap.data()?.listenedTracks).toContain(track1);
                expect(snap.data()?.listenedTracks).toContain(track2);
                expect(snap.data()?.listenedRatio).toBe(1.0);
            });
        });

        it('should track final vote in userCollaboration', async () => {
            const votedTrack = `collabs/${testCollaborationId}/submissions/winner.mp3`;

            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

                await setDoc(userCollabRef, {
                    userId: testUserId,
                    collaborationId: testCollaborationId,
                    listenedTracks: [votedTrack],
                    listenedRatio: 1.0,
                    finalVote: votedTrack,
                    lastInteraction: Timestamp.now(),
                });

                const snap = await getDoc(userCollabRef);
                expect(snap.data()?.finalVote).toBe(votedTrack);
            });
        });

        it('should allow vote changes', async () => {
            const track1 = `collabs/${testCollaborationId}/submissions/track1.mp3`;
            const track2 = `collabs/${testCollaborationId}/submissions/track2.mp3`;

            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const userCollabRef = doc(db, 'userCollaborations', `${testUserId}_${testCollaborationId}`);

                // Initial vote
                await setDoc(userCollabRef, {
                    userId: testUserId,
                    collaborationId: testCollaborationId,
                    listenedTracks: [track1, track2],
                    listenedRatio: 1.0,
                    finalVote: track1,
                    lastInteraction: Timestamp.now(),
                });

                // Change vote
                await setDoc(userCollabRef, {
                    userId: testUserId,
                    collaborationId: testCollaborationId,
                    listenedTracks: [track1, track2],
                    listenedRatio: 1.0,
                    finalVote: track2,
                    lastInteraction: Timestamp.now(),
                }, { merge: true });

                const snap = await getDoc(userCollabRef);
                expect(snap.data()?.finalVote).toBe(track2);
            });
        });
    });

    describe('collaboration votesCount', () => {
        it('should track votesCount on collaboration', async () => {
            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                const collabRef = doc(db, 'collaborations', testCollaborationId);

                // Simulate vote count increment (done by Cloud Function in production)
                await setDoc(collabRef, { votesCount: 5 }, { merge: true });

                const snap = await getDoc(collabRef);
                expect(snap.data()?.votesCount).toBe(5);
            });
        });
    });

    describe('users and permissions', () => {
        it('should create user with correct tier', async () => {
            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();

                const userSnap = await getDoc(doc(db, 'users', testUserId));
                expect(userSnap.exists()).toBe(true);
                expect(userSnap.data()?.tier).toBe('beta');
            });
        });

        it('should track project ownership', async () => {
            const env = await initTestEnvironment();
            await env.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();

                const projectSnap = await getDoc(doc(db, 'projects', testProjectId));
                expect(projectSnap.exists()).toBe(true);
                expect(projectSnap.data()?.ownerId).toBe(testOwnerId);
            });
        });
    });
});
