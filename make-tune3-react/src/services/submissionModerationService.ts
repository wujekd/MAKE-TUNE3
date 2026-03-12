import { callFirebaseFunction } from './firebaseFunctions';
import type { CollaborationId, SubmissionModerationStatus, UserId } from '../types/collaboration';

export async function setSubmissionModeration(
  collaborationId: CollaborationId,
  submissionIdentifier: string,
  status: SubmissionModerationStatus,
  moderatorId: UserId
): Promise<SubmissionModerationStatus> {
  const data = await callFirebaseFunction<
    {
      collaborationId: CollaborationId;
      submissionIdentifier: string;
      status: SubmissionModerationStatus;
      moderatorId: UserId;
    },
    { status?: string }
  >('setSubmissionModeration', {
    collaborationId,
    submissionIdentifier,
    status,
    moderatorId
  });

  const result = data?.status ?? '';
  if (!['pending', 'approved', 'rejected'].includes(result)) {
    throw new Error('moderation-failed');
  }

  return result as SubmissionModerationStatus;
}
