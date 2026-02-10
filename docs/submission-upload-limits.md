# Backend Security Notes

This document summarizes backend security controls that enforce limits and prevent client-side bypasses.

## Why This Exists

Client-only checks are bypassable. To ensure limits are real, the server must be the only authority for:

- granting submission permissions
- writing submission records
- counting and enforcing project/submission limits

This protects the beta from abuse and ensures the UI reflects the true system state.

## High-Level Design (Submissions)

1. **Reserve** a submission slot (callable function).
2. **Upload** the audio file with a server-issued token (Storage rules verify token).
3. **Finalize** the submission (Storage trigger writes Firestore records).
4. **Cleanup** expired reservations (scheduled function).

## Effective Limit (Submissions)

The effective limit is:

- `submissionLimitOverride` if present on the collaboration (server-only field)
- otherwise `systemSettings/global.maxSubmissionsPerCollab`

Clients see only the effective limit and usage count, never the override.

## Firestore Collections (Submissions)

- `collaborations/{collabId}`
  - `submissionsCount`: total finalized submissions
  - `reservedSubmissionsCount`: active reservations (pre-upload)
  - `submissionLimitOverride` (optional, server-only)
- `collaborationDetails/{collabId}`
  - `submissions[]`: submission entries (server-only writes)
- `submissionUsers/{submissionId}`
  - one document per submission
- `submissionUploadTokens/{collabId}__{uid}`
  - server-issued token for uploads

## Cloud Functions (Submissions)

### `reserveSubmissionSlot` (callable)
Creates or refreshes a reservation token if:

- user is authenticated and not suspended
- submissions are enabled
- collaboration is in `submission` status and window is open
- user has not already submitted
- `submissionsCount + reservedSubmissionsCount < effectiveLimit`

Returns `tokenId` and `submissionId`. The token expires automatically.

### `finalizeSubmissionUpload` (Storage trigger)

Runs when `collabs/{collabId}/submissions/{submissionId}.{ext}` is uploaded.

Validates:
- token exists, not expired, not used
- token matches `collabId`, `uid`, `submissionId`, `fileExt`

Then writes:
- `submissionUsers/{submissionId}`
- adds submission entry to `collaborationDetails`
- increments `submissionsCount`
- decrements `reservedSubmissionsCount`
- adds `participantIds` entry
- marks token `used`

### `attachSubmissionMultitracks` (Storage trigger)

For `.../{submissionId}-multitracks.zip` uploads. Validates ownership and updates the submission entry in `collaborationDetails`.

### `cleanupSubmissionReservations` (scheduled)

Finds expired tokens, decrements `reservedSubmissionsCount`, deletes expired tokens.

### `setSubmissionModeration` (callable)

Moved from client transactions to server-side moderation to keep `collaborationDetails` writes server-only.

## Security Rules Summary

### Firestore (Submissions)

- Clients cannot write `submissionUsers`, `collaborationDetails` submissions, or submission counters.
- Clients can only increment `favoritesCount` and `votesCount`.
- `submissionUploadTokens` are server-only.

### Storage (Submissions)

- Submission uploads require `uploadTokenId` metadata and a valid token.
- Multitrack uploads require a valid token or a finalized submission owned by the user.

## Client Flow (Submission)

1. Call `reserveSubmissionSlot`.
2. Upload audio with metadata `{ ownerUid, uploadTokenId }`.
3. (Optional) Upload multitracks with metadata `{ ownerUid, uploadTokenId, submissionId }`.
4. UI reads `effectiveSubmissionLimit` and `submissionsUsedCount` from the collaboration data.

## Project Creation Limits

Project creation is **server-only**. The client cannot create `projects` documents directly.

Enforcement:

- Project creation happens via `createProjectWithUniqueName` Cloud Function.
- Firestore rules block direct client creates on `projects` and `projectNameIndex`.

Why:

- Prevents bypassing per-user limits by direct writes.
- Keeps `projectCount` consistent and controlled by the server.

## User Profile Write Restrictions

Users can only update safe fields on their own user profile:

- `collaborationIds`
- `username`

All of the following are **server-only**:

- `tier`
- `bonusProjects`
- `projectCount`
- `isAdmin`
- `suspended`
- `email`
- `createdAt`
- `uid`

This prevents users from escalating their limits or privileges.

## Additional Safety Fixes (Beta Hardening)

The following hardening changes were applied before beta:

1. **Collaboration details privacy**
   - Direct reads of `collaborationDetails` are now restricted to project owners and admins.
   - Public/anonymous access must use the Cloud Function (`getCollaborationData`) which filters submissions.

2. **Backing/docs uploads restricted**
   - Only the project owner can upload/replace `backing.*` and `docs/*` files.
   - Prevents overwriting assets in another user’s collaboration.

3. **Username integrity**
   - A user can only set `users.username` if they have claimed `usernames/{name}`.
   - Prevents bypassing username uniqueness by direct profile edits.

## Deployment Order

1. Deploy Cloud Functions.
2. Deploy updated frontend.
3. Deploy Firestore + Storage rules.

This order avoids locking out uploads before the new flow is available.
