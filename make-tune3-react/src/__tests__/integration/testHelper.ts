/**
 * Test utilities for integration tests with Firebase emulators
 * Uses @firebase/rules-unit-testing for authenticated test context
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment, RulesTestContext } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection, addDoc, Timestamp, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export const PROJECT_ID = 'demo-test-project';

let testEnv: RulesTestEnvironment | null = null;

/**
 * Initialize the test environment with rules
 */
export async function initTestEnvironment(): Promise<RulesTestEnvironment> {
    if (testEnv) return testEnv;

    // Read rules from file
    const rulesPath = path.resolve(__dirname, '../../../../firestore.rules');
    let rules: string | undefined;

    try {
        rules = fs.readFileSync(rulesPath, 'utf8');
    } catch (e) {
        // Rules file may not be accessible in test environment
        console.warn('Could not read firestore.rules, using permissive rules');
    }

    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            host: 'localhost',
            port: 8080,
            rules,
        },
    });

    return testEnv;
}

/**
 * Get an authenticated test context for a specific user
 */
export async function getAuthenticatedContext(uid: string, email?: string): Promise<RulesTestContext> {
    const env = await initTestEnvironment();
    return env.authenticatedContext(uid, { email: email || `${uid}@test.com` });
}

/**
 * Get an unauthenticated test context
 */
export async function getUnauthenticatedContext(): Promise<RulesTestContext> {
    const env = await initTestEnvironment();
    return env.unauthenticatedContext();
}

/**
 * Clear all Firestore data in the emulator
 */
export async function clearFirestoreData(): Promise<void> {
    const env = await initTestEnvironment();
    await env.clearFirestore();
}

/**
 * Clean up the test environment after all tests
 */
export async function cleanupTestEnvironment(): Promise<void> {
    if (testEnv) {
        await testEnv.cleanup();
        testEnv = null;
    }
}

/**
 * Helper to create a test user document directly in Firestore (bypassing rules)
 * This is needed because user creation typically requires special handling
 */
export async function createTestUser(uid: string, data: {
    email?: string;
    isAdmin?: boolean;
    tier?: string;
    projectCount?: number;
    bonusProjects?: number;
} = {}): Promise<void> {
    const env = await initTestEnvironment();

    // Use withSecurityRulesDisabled to create the user document
    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'users', uid), {
            uid,
            email: data.email || `${uid}@test.com`,
            createdAt: Timestamp.now(),
            collaborationIds: [],
            isAdmin: data.isAdmin || false,
            tier: data.tier || 'beta',
            projectCount: data.projectCount || 0,
            bonusProjects: data.bonusProjects || 0,
        });
    });
}

/**
 * Helper to create a test project directly in Firestore (bypassing rules)
 * Projects can only be created server-side in production
 */
export async function createTestProject(ownerId: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
} = {}): Promise<string> {
    const env = await initTestEnvironment();
    let projectId = '';

    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const projectRef = doc(collection(db, 'projects'));
        projectId = projectRef.id;

        await setDoc(projectRef, {
            name: data.name || 'Test Project',
            description: data.description || 'Test project for integration tests',
            tags: [],
            tagsKey: [],
            ownerId,
            isActive: data.isActive !== undefined ? data.isActive : true,
            pastCollaborations: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    });

    return projectId;
}

/**
 * Helper to create a test collaboration directly in Firestore (bypassing rules)
 */
export async function createTestCollaboration(projectId: string, data: {
    name?: string;
    description?: string;
    status?: string;
    backingTrackPath?: string;
} = {}): Promise<string> {
    const env = await initTestEnvironment();
    let collabId = '';

    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const collabRef = doc(collection(db, 'collaborations'));
        collabId = collabRef.id;

        await setDoc(collabRef, {
            projectId,
            name: data.name || 'Test Collaboration',
            description: data.description || 'Test collaboration for integration tests',
            status: data.status || 'published',
            backingTrackPath: data.backingTrackPath || 'collabs/test/backing.mp3',
            tags: [],
            tagsKey: [],
            participantIds: [],
            submissions: [],
            submissionDuration: 7,
            votingDuration: 3,
            publishedAt: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    });

    return collabId;
}

/**
 * Get Firestore instance with security rules disabled (for admin operations)
 */
export async function getAdminFirestore(): Promise<Firestore> {
    const env = await initTestEnvironment();
    let db: Firestore | null = null;

    await env.withSecurityRulesDisabled(async (context) => {
        db = context.firestore() as unknown as Firestore;
    });

    if (!db) throw new Error('Failed to get admin Firestore');
    return db;
}

// Re-export Firestore utilities for convenience
export { doc, setDoc, getDoc, deleteDoc, collection, addDoc, Timestamp, serverTimestamp, query, where, getDocs };
