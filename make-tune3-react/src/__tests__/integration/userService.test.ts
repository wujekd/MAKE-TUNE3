import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../services/userService';
import { CollaborationService } from '../../services/collaborationService';
import { ProjectService } from '../../services/projectService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { UserProfile, Collaboration, Project } from '../../types/collaboration';
import { Timestamp } from 'firebase/firestore';

async function clearFirestoreData() {
  const response = await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/demo-test-project/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    console.warn('Failed to clear Firestore data:', response.statusText);
  }
}

describe('UserService Integration', () => {
  const testUserId = 'test-user-123';
  let testCollaborationId: string;
  let testProjectId: string;

  beforeEach(async () => {
    await clearFirestoreData();
    await new Promise(resolve => setTimeout(resolve, 130));
    
    const project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Test Project',
      description: 'Test project',
      ownerId: testUserId,
      isActive: true,
      pastCollaborations: [],
      tags: [],
      tagsKey: []
    };
    const createdProject = await ProjectService.createProject(project);
    testProjectId = createdProject.id;
    
    const collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Test Collaboration',
      description: 'Test description',
      projectId: testProjectId,
      status: 'unpublished',
      backingTrackPath: '',
      submissionDuration: 7,
      votingDuration: 3,
      publishedAt: null,
      participantIds: [],
      submissions: [],
      tags: [],
      tagsKey: []
    };
    const createdCollaboration = await CollaborationService.createCollaboration(collaboration);
    testCollaborationId = createdCollaboration.id;
  });

  afterEach(async () => {
    await clearFirestoreData();
    await new Promise(resolve => setTimeout(resolve, 130));
  });

  describe('getUserProfile', () => {
    it('should return null for non-existent user', async () => {
      const profile = await UserService.getUserProfile('non-existent-user');
      
      expect(profile).toBeNull();
    });
  });


  describe('addCollaborationToUser', () => {
    it('should throw error for non-existent user', async () => {
      await expect(
        UserService.addCollaborationToUser('non-existent-user', testCollaborationId)
      ).rejects.toThrow('User profile not found');
    });
  });

  describe('getUserCollaboration', () => {
    it('should return null if user collaboration does not exist', async () => {
      const userCollab = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      
      expect(userCollab).toBeNull();
    });

    it('should retrieve user collaboration after creation', async () => {
      await UserService.createUserCollaboration({
        userId: testUserId,
        collaborationId: testCollaborationId,
        favoriteTracks: [],
        listenedTracks: [],
        listenedRatio: 0
      });
      
      const userCollab = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      
      expect(userCollab).not.toBeNull();
      expect(userCollab!.userId).toBe(testUserId);
      expect(userCollab!.collaborationId).toBe(testCollaborationId);
      expect(userCollab!.favoriteTracks).toEqual([]);
      expect(userCollab!.listenedTracks).toEqual([]);
    });

    it('should return null for different user', async () => {
      await UserService.createUserCollaboration({
        userId: testUserId,
        collaborationId: testCollaborationId,
        favoriteTracks: [],
        listenedTracks: [],
        listenedRatio: 0
      });
      
      const userCollab = await UserService.getUserCollaboration('different-user', testCollaborationId);
      
      expect(userCollab).toBeNull();
    });
  });

  describe('createUserCollaboration', () => {
    it('should create user collaboration with default fields', async () => {
      await UserService.createUserCollaboration({
        userId: testUserId,
        collaborationId: testCollaborationId,
        favoriteTracks: [],
        listenedTracks: [],
        listenedRatio: 0
      });
      
      const userCollab = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      
      expect(userCollab).not.toBeNull();
      expect(userCollab!.lastInteraction).toBeDefined();
    });

    it('should create user collaboration with custom fields', async () => {
      await UserService.createUserCollaboration({
        userId: testUserId,
        collaborationId: testCollaborationId,
        favoriteTracks: ['track1', 'track2'],
        listenedTracks: ['track1'],
        listenedRatio: 0.5,
        finalVote: 'track1'
      });
      
      const userCollab = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      
      expect(userCollab!.favoriteTracks).toEqual(['track1', 'track2']);
      expect(userCollab!.listenedTracks).toEqual(['track1']);
      expect(userCollab!.listenedRatio).toBe(0.5);
      expect(userCollab!.finalVote).toBe('track1');
    });
  });

  describe('updateUserCollaboration', () => {
    beforeEach(async () => {
      await UserService.createUserCollaboration({
        userId: testUserId,
        collaborationId: testCollaborationId,
        favoriteTracks: [],
        listenedTracks: [],
        listenedRatio: 0
      });
    });

    it('should update user collaboration fields', async () => {
      await UserService.updateUserCollaboration(testUserId, testCollaborationId, {
        favoriteTracks: ['track1', 'track2']
      });
      
      const userCollab = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      expect(userCollab!.favoriteTracks).toEqual(['track1', 'track2']);
    });

    it('should update lastInteraction timestamp', async () => {
      const before = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      const beforeTime = before!.lastInteraction;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await UserService.updateUserCollaboration(testUserId, testCollaborationId, {
        listenedRatio: 0.5
      });
      
      const after = await UserService.getUserCollaboration(testUserId, testCollaborationId);
      const afterTime = after!.lastInteraction;
      
      expect(afterTime).not.toEqual(beforeTime);
    });

    it('should throw error for non-existent user collaboration', async () => {
      await expect(
        UserService.updateUserCollaboration('different-user', testCollaborationId, {
          listenedRatio: 0.5
        })
      ).rejects.toThrow('User collaboration not found');
    });
  });

  describe('hasDownloadedBacking', () => {
    it('should return false initially', async () => {
      const hasDownloaded = await UserService.hasDownloadedBacking(testUserId, testCollaborationId);
      
      expect(hasDownloaded).toBe(false);
    });

    it('should return true after marking downloaded', async () => {
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      
      const hasDownloaded = await UserService.hasDownloadedBacking(testUserId, testCollaborationId);
      
      expect(hasDownloaded).toBe(true);
    });

    it('should return false for different user', async () => {
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      
      const hasDownloaded = await UserService.hasDownloadedBacking('different-user', testCollaborationId);
      
      expect(hasDownloaded).toBe(false);
    });

    it('should return false for different collaboration', async () => {
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      
      const hasDownloaded = await UserService.hasDownloadedBacking(testUserId, 'different-collab');
      
      expect(hasDownloaded).toBe(false);
    });
  });

  describe('markBackingDownloaded', () => {
    it('should create download record', async () => {
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      
      const hasDownloaded = await UserService.hasDownloadedBacking(testUserId, testCollaborationId);
      expect(hasDownloaded).toBe(true);

      const ref = doc(db, 'userDownloads', `${testUserId}__${testCollaborationId}`);
      const snap = await getDoc(ref);
      expect(snap.exists()).toBe(true);
      expect((snap.data() as any).downloadCount).toBe(1);
    });

    it('should allow multiple download records', async () => {
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      await UserService.markBackingDownloaded(testUserId, testCollaborationId, 'backing/path.mp3');
      
      const hasDownloaded = await UserService.hasDownloadedBacking(testUserId, testCollaborationId);
      expect(hasDownloaded).toBe(true);

      const ref = doc(db, 'userDownloads', `${testUserId}__${testCollaborationId}`);
      const snap = await getDoc(ref);
      expect((snap.data() as any).downloadCount).toBe(2);
    });
  });

  describe('getUserCollaborations', () => {
    it('should return empty array for user with no collaborations', async () => {
      const collabs = await UserService.getUserCollaborations(testUserId);
      
      expect(collabs).toEqual([]);
    });
  });
});
