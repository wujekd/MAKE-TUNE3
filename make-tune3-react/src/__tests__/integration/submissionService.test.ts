import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SubmissionService } from '../../services/submissionService';
import { CollaborationService } from '../../services/collaborationService';
import { ProjectService } from '../../services/projectService';
import type { Collaboration, Project } from '../../types/collaboration';
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

describe('SubmissionService Integration', () => {
  let testProjectId: string;
  let testCollaborationId: string;
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    await clearFirestoreData();
    await new Promise(resolve => setTimeout(resolve, 130));
    
    const project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Test Project',
      description: 'Test project for submission tests',
      tags: [],
      tagsKey: [],
      ownerId: testUserId,
      isActive: true,
      pastCollaborations: []
    };
    
    const createdProject = await ProjectService.createProject(project);
    testProjectId = createdProject.id;
    
    const collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Test Collaboration',
      description: 'Test description',
      tags: [],
      tagsKey: [],
      projectId: testProjectId,
      status: 'unpublished',
      backingTrackPath: '',
      submissionDuration: 7,
      votingDuration: 3,
      publishedAt: null,
      participantIds: [],
      submissions: []
    };
    
    const createdCollaboration = await CollaborationService.createCollaboration(collaboration);
    testCollaborationId = createdCollaboration.id;
  });

  afterEach(async () => {
    await clearFirestoreData();
    await new Promise(resolve => setTimeout(resolve, 130));
  });

  describe('hasUserSubmitted', () => {
    it('should return false for new user', async () => {
      const hasSubmitted = await SubmissionService.hasUserSubmitted(testCollaborationId, testUserId);
      
      expect(hasSubmitted).toBe(false);
    });

    it('should return false for different user', async () => {
      const hasSubmitted = await SubmissionService.hasUserSubmitted(testCollaborationId, 'different-user-456');
      
      expect(hasSubmitted).toBe(false);
    });

    it('should handle non-existent collaboration', async () => {
      const hasSubmitted = await SubmissionService.hasUserSubmitted('non-existent-collab', testUserId);
      
      expect(hasSubmitted).toBe(false);
    });

    it('should handle collaboration with no participantIds', async () => {
      const collab = await CollaborationService.getCollaboration(testCollaborationId);
      expect(collab).not.toBeNull();
      expect(collab!.participantIds).toEqual([]);
      
      const hasSubmitted = await SubmissionService.hasUserSubmitted(testCollaborationId, testUserId);
      
      expect(hasSubmitted).toBe(false);
    });

    it('should handle collaboration with multiple participants', async () => {
      await CollaborationService.updateCollaboration(testCollaborationId, {
        participantIds: ['user1', 'user2', 'user3']
      });
      
      const hasSubmitted1 = await SubmissionService.hasUserSubmitted(testCollaborationId, 'user1');
      const hasSubmitted2 = await SubmissionService.hasUserSubmitted(testCollaborationId, 'user2');
      const hasSubmitted3 = await SubmissionService.hasUserSubmitted(testCollaborationId, 'user3');
      const hasSubmittedOther = await SubmissionService.hasUserSubmitted(testCollaborationId, 'user4');
      
      expect(hasSubmitted1).toBe(false);
      expect(hasSubmitted2).toBe(false);
      expect(hasSubmitted3).toBe(false);
      expect(hasSubmittedOther).toBe(false);
    });
  });
});

