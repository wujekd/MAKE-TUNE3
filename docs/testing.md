# Testing Guide

Unit and integration tests for the Make Tune 3 React.

## Quick Start

```bash
# Run unit tests
npm test

# Run integration tests (requires Firebase emulators)
npm run emulators  # In one terminal
npm run test:integration  # In another terminal
```

---

## Unit Tests

Unit tests run without Firebase emulators and test pure functions, components, and stores.

### Audio Engine Tests
**File:** `src/__tests__/unit/audio-engine.test.ts`

| Test | Description |
|------|-------------|
| initialization > should initialize with two audio elements | Verifies AudioEngine creates with two HTML audio elements |
| initialization > should have initial state with default values | Checks player1/player2/master have correct initial state |
| loadSource > should load source for player 1 | Tests loading audio source into player 1 |
| loadSource > should load source for player 2 | Tests loading audio source into player 2 |
| loadSource > should update state source property | Verifies state.player1.source is updated after load |
| loadSource > should reset player2 currentTime when loading player1 | Ensures player2 syncs when player1 loads |
| playSubmission > should load both sources and start playback | Tests dual-player playback for submission + backing |
| playSubmission > should update state to playing | Verifies isPlaying becomes true |
| playPastStage > should load both submission and backing sources | Tests past stage playback with both players |
| playPastStage > should update both players state to playing | Verifies both players are playing |
| playPastStage > should set pastStagePlayback flag to true | Checks pastStagePlayback flag is set |
| playPastStage > should set currentTrackId to provided index | Verifies track index is stored |
| pause > should pause both players | Tests pausing both audio elements |
| pause > should update state to not playing | Verifies isPlaying becomes false |
| volume control > should set volume for player 1 | Tests player 1 volume control |
| volume control > should set volume for player 2 | Tests player 2 volume control |
| volume control > should set master volume | Tests master volume control |
| state callbacks > should call state change callback when state updates | Verifies state change listeners are called |

---

### Playback Utils Tests
**File:** `src/__tests__/unit/playbackUtils.test.ts`

| Test | Description |
|------|-------------|
| formatTime > should format seconds as mm:ss | Converts 90 → "1:30" |
| formatTime > should pad seconds with leading zero | Converts 5 → "0:05" |
| formatTime > should handle decimal seconds | Truncates 30.7 → "0:30" |
| formatTime > should handle negative values | Handles negative input |
| calculateProgress > should calculate progress percentage | Returns (current/duration)*100 |
| calculateProgress > should handle zero duration | Returns 0 for duration=0 |
| calculateProgress > should handle decimal values | Handles floating point values |
| calculateProgress > should handle progress over 100% | Returns value >100 if exceeded |
| secondsToMilliseconds > should convert seconds to milliseconds | Converts 1 → 1000 |
| secondsToMilliseconds > should handle decimal seconds | Converts 1.5 → 1500 |
| millisecondsToSeconds > should convert milliseconds to seconds | Converts 1000 → 1 |
| millisecondsToSeconds > should handle decimal milliseconds | Converts 1500 → 1.5 |

---

### Audio URL Utils Tests
**File:** `src/__tests__/unit/audioUrlUtils.test.ts`

| Test | Description |
|------|-------------|
| resolveAudioUrl > should return empty string for empty path | Empty path returns "" |
| resolveAudioUrl > should return http URLs as-is | HTTP URLs pass through unchanged |
| resolveAudioUrl > should return test-audio paths as-is | Test paths bypass Firebase |
| resolveAudioUrl > should return non-collabs paths as-is | Non-collab paths pass through |
| resolveAudioUrl > should fetch and cache Firebase Storage URLs | Fetches and caches collabs/* paths |
| resolveAudioUrl > should return cached URL on second call | Returns cached URL without re-fetch |
| cache management > should clear cache | clearCache() works correctly |
| cache management > should return cache size | getCacheSize() returns correct count |
| cache management > should get cached URL | getCachedUrl() retrieves stored URLs |

---

### Track Utils Tests
**File:** `src/__tests__/unit/trackUtils.test.ts`

| Test | Description |
|------|-------------|
| createTrackFromFilePath > should create a submission track from file path | Creates track with category='submission' |
| createTrackFromFilePath > should create a pastStage track | Creates track with category='pastStage' |
| createTrackFromFilePath > should include submission settings when provided | Attaches EQ/HPF settings |
| createTrackFromFilePath > should extract title from file name | Converts "my-track.mp3" → "my-track" |
| createTrackFromFilePath > should handle paths without extension | Handles extensionless paths |
| filterByFavorites > should separate favorites from regular tracks | Splits tracks by favorite status |
| filterByFavorites > should return all tracks as regular when no favorites | Empty favorites returns all as regular |
| filterByFavorites > should handle empty track list | Returns empty arrays for empty input |
| findTrackByFilePath > should find track by file path | Returns matching track |
| findTrackByFilePath > should return undefined for non-existent track | Returns undefined for no match |
| findTrackByFilePath > should handle empty track list | Returns undefined for empty list |
| isTrackInList > should return true when track exists | Checks track presence |
| isTrackInList > should return false when track does not exist | Returns false for missing |
| isTrackInList > should handle empty list | Returns false for empty list |
| updateTrackApprovalStatus > should update approval status | Sets approved=true/false |
| updateTrackApprovalStatus > should update moderation status | Sets moderationStatus field |
| updateTrackApprovalStatus > should not modify other tracks | Only modifies target track |
| updateTrackApprovalStatus > should return new array (immutable) | Returns new array, original unchanged |

---

### File Service Tests
**File:** `src/__tests__/unit/fileService.test.ts`

| Test | Description |
|------|-------------|
| validateFileSize > should accept files under 100MB | Valid for files < max size |
| validateFileSize > should reject files over 100MB | Throws error for files > max size |
| validateFileSize > should accept files at exactly 100MB | Edge case at exact limit |
| validateFileSize > should handle zero-byte files | Accepts empty files |
| getPreferredAudioExtension > should return mp3 for .mp3 files | Detects mp3 from filename |
| getPreferredAudioExtension > should return wav for .wav files | Detects wav from filename |
| getPreferredAudioExtension > should return flac for .flac files | Detects flac from filename |
| getPreferredAudioExtension > should return aac for .aac files | Detects aac from filename |
| getPreferredAudioExtension > should return webm for .webm files | Detects webm from filename |
| getPreferredAudioExtension > should be case insensitive | Handles .MP3, .Wav, etc. |
| getPreferredAudioExtension (MIME) > should return mp3 for audio/mpeg | Detects from MIME type |
| getPreferredAudioExtension (MIME) > should return wav for audio/wav | Detects wav MIME |
| getPreferredAudioExtension (MIME) > should return flac for audio/flac | Detects flac MIME |
| getPreferredAudioExtension (MIME) > should return ogg for audio/ogg | Detects ogg MIME |
| getPreferredAudioExtension (MIME) > should return opus for audio/opus | Detects opus MIME |
| getPreferredAudioExtension (MIME) > should return m4a for audio/mp4 | Detects m4a MIME |
| getPreferredAudioExtension (MIME) > should return aac for audio/aac | Detects aac MIME |
| getPreferredAudioExtension (MIME) > should return webm for audio/webm | Detects webm MIME |
| fallback behavior > should return "audio" for unknown MIME types | Falls back for unknown types |
| fallback behavior > should handle files with multiple dots | Parses "my.test.file.mp3" correctly |
| edge cases > should handle files with disallowed extensions | Returns "audio" for .txt |
| edge cases > should handle files with no name | Uses MIME type fallback |

---

### Permissions Tests
**File:** `src/__tests__/unit/permissions.test.ts`

| Test | Description |
|------|-------------|
| canCreateProject > tier limits > should return false for free tier user with no bonus | Free tier = 0 limit |
| canCreateProject > tier limits > should allow beta tier user to create up to 3 projects | Beta tier = 3 limit |
| canCreateProject > tier limits > should allow premium tier user to create up to 100 projects | Premium tier = 100 limit |
| canCreateProject > bonus projects > should add bonus projects to tier limit | bonusProjects adds to limit |
| canCreateProject > bonus projects > should stack bonus with beta tier | 3 + bonus = total |
| canCreateProject > admin bypass > should always return true for admin users | Admins bypass limits |
| canCreateProject > edge cases > should return false for null user | Null user = false |
| canCreateProject > edge cases > should default to free tier when tier field is missing | Missing tier = free |
| canCreateProject > edge cases > should handle undefined bonusProjects as 0 | Missing bonus = 0 |
| canCreateProject > edge cases > should handle undefined projectCount as 0 | Missing count = 0 |
| getProjectAllowance > should return null for null user | Null user returns null |
| getProjectAllowance > should return correct allowance for free tier | Returns {current, limit, remaining} |
| getProjectAllowance > should return correct allowance for beta tier | Beta allowance = 3 |
| getProjectAllowance > should return correct allowance for premium tier | Premium allowance = 100 |
| getProjectAllowance > should include bonus projects in limit | limit = tierLimit + bonus |
| getProjectAllowance > should return Infinity limit for admin users | Admin = unlimited |
| getProjectAllowance > should default missing tier to free | Missing tier = free |
| getProjectAllowance > should handle missing projectCount as 0 | Missing = 0 |
| getProjectAllowance > should handle missing bonusProjects as 0 | Missing = 0 |

---

### Store Tests

#### useAudioStore Tests
**File:** `src/__tests__/unit/useAudioStore.test.ts`

| Test | Description |
|------|-------------|
| should initialize with null engine and state | Initial state verified |
| should set audio engine | setEngine() works |
| should set audio state | setState() works |
| should update engine and state independently | Independent updates work |

#### useUIStore Tests
**File:** `src/__tests__/unit/useUIStore.test.ts`

| Test | Description |
|------|-------------|
| should initialize with default state | isLoading/showAuth/debug = false |
| should update loading state | setLoading() works |
| should toggle showAuth | setShowAuth() works |
| should toggle debug mode | setDebug() works |

#### useCollaborationStore Tests
**File:** `src/__tests__/unit/useCollaborationStore.test.ts`

| Test | Description |
|------|-------------|
| places favorite file paths outside the regular track list | Favorites separated from regular |

#### appStore Tests
**File:** `src/__tests__/unit/appStore.test.ts`

| Test | Description |
|------|-------------|
| Collaboration Slice > should initialize with empty collaboration state | Initial state verified |
| Collaboration Slice > should set current project | setCurrentProject() works |
| Collaboration Slice > should set current collaboration | setCurrentCollaboration() works |
| Collaboration Slice > should find track by file path | getTrackByFilePath() works |
| Collaboration Slice > should return undefined for non-existent track | Returns undefined for missing |
| Collaboration Slice > should check if track is favorite | isTrackFavorite() works |
| Collaboration Slice > should check if track is listened | isTrackListened() works |
| Collaboration Slice > should return false for unauthenticated user | Returns false when no user |
| Collaboration Slice > should set listened ratio | setListenedRatio() works |
| Collaboration Slice > should handle null userCollaboration | No error for null |
| Playback Slice > should calculate time slider value | getTimeSliderValue() works |

---

### Component Tests

#### AuthRoute Tests
**File:** `src/__tests__/unit/AuthRoute.test.tsx`

| Test | Description |
|------|-------------|
| redirects authenticated users with usernames to the dashboard | User with username → /collabs |
| redirects authenticated users without usernames to onboarding | User without username → /onboarding/username |

#### DownloadBacking Tests
**File:** `src/__tests__/unit/DownloadBacking.test.tsx`

| Test | Description |
|------|-------------|
| downloads the backing track via Firebase storage and records the download | Tests full download flow |

---

## Integration Tests

Integration tests with Firebase emulators running on port 8080.

### Prerequisites
```bash
npm run emulators
```

### Voting Service Tests
**File:** `src/__tests__/integration/votingService.test.ts`

| Test | Description |
|------|-------------|
| collaboration status > should have voting status set correctly | Verifies voting status |
| collaboration status > should support different collaboration statuses | Tests published/completed |
| userCollaboration tracking > should create record with required fields | Creates with userId/collaborationId |
| userCollaboration tracking > should track listened tracks | listenedTracks array updates |
| userCollaboration tracking > should track final vote | finalVote field set |
| userCollaboration tracking > should allow vote changes | Vote can be changed |
| collaboration votesCount > should track votesCount | votesCount increments |
| users and permissions > should create user with correct tier | User tier stored |
| users and permissions > should track project ownership | Project ownerId correct |

---

### Collaboration Service Tests
**File:** `src/__tests__/integration/collaborationService.test.ts`

| Test | Description |
|------|-------------|
| createProject > should create a project with all required fields | Project CRUD - create |
| createProject > should persist the project to Firestore | Verifies persistence |
| createProject > should set timestamps correctly | createdAt/updatedAt set |
| getProject > should retrieve an existing project by ID | Project CRUD - read |
| getProject > should return null for non-existent project | Returns null for missing |
| getProject > should retrieve project with correct timestamp types | Timestamps are Firestore Timestamps |
| updateProject > should update project fields | Project CRUD - update |
| deleteProject > should delete a project | Project CRUD - delete |
| createCollaboration > should create collaboration with required fields | Collaboration CRUD - create |
| getCollaboration > should retrieve an existing collaboration | Collaboration CRUD - read |
| getCollaboration > should return null for non-existent collaboration | Returns null for missing |
| updateCollaboration > should update collaboration fields | Collaboration CRUD - update |
| deleteCollaboration > should delete a collaboration | Collaboration CRUD - delete |
| getCollaborationsByProject > should return empty array for project with no collaborations | Empty project handling |

---

### Submission Service Tests
**File:** `src/__tests__/integration/submissionService.test.ts`

Tests the 2-stage submission token system.

#### System Settings - Global Submission Switch
| Test | Description |
|------|-------------|
| should store submissionsEnabled setting | Verifies submissionsEnabled=false is stored |
| should store submissionsEnabled as true when enabled | Verifies submissionsEnabled=true is stored |
| should default to enabled when settings do not exist | Cloud Function defaults to true |

#### Submission Limits - maxSubmissionsPerCollab
| Test | Description |
|------|-------------|
| should store global maxSubmissionsPerCollab setting | Global limit stored in systemSettings |
| should support per-collaboration submissionLimitOverride | Per-collab override field |
| should track submissionsCount for limit enforcement | Validates submissionsCount + reservedCount >= limit |
| should allow submission when under limit | Validates submissionsCount + reservedCount < limit |

#### Submission Tokens - 2-Stage Reservation System
| Test | Description |
|------|-------------|
| should create submission token with required fields | Token: collabId, uid, submissionId, fileExt, settings, expiresAt |
| should mark token as used after successful upload | used=true, usedAt timestamp |
| should mark token as invalidated with reason when rejected | invalidReason field (e.g., "submissions-disabled") |
| should track token expiry time | expiresAt in future = valid |
| should detect expired token | expiresAt in past = expired |

#### hasUserSubmitted (participantIds check)
| Test | Description |
|------|-------------|
| should return false for new user (empty participantIds) | New user not in list |
| should return true for user who has already submitted | User in participantIds |
| should handle collaboration with multiple participants | Multi-user list checking |

#### Submission Tracking (counters)
| Test | Description |
|------|-------------|
| should track submissionsCount on collaboration | Completed submissions counter |
| should track reservedSubmissionsCount on collaboration | Active reservations counter |
| should decrement reservedSubmissionsCount after finalization | Reservation → submission transition |

#### Collaboration Status Validation
| Test | Description |
|------|-------------|
| should accept submissions when status is "submission" | status=submission → allowed |
| should reject submissions when status is "voting" | status=voting → rejected |
| should reject submissions when status is "completed" | status=completed → rejected |
| should track submissionCloseAt for deadline enforcement | Deadline timestamp tracking |

---


### User Service Tests
**File:** `src/__tests__/integration/userService.test.ts`

| Test | Description |
|------|-------------|
| getUserProfile > should read user profile | Reads user document |
| getUserProfile > should return null for non-existent user | Returns null for missing |
| getUserProfile > should read admin user with isAdmin flag | Admin flag detected |
| getUserCollaboration > should create and read userCollaboration | CRUD for userCollaboration |
| getUserCollaboration > should return null if does not exist | Returns null for missing |
| createUserCollaboration > should create with required fields | Required fields enforced |
| createUserCollaboration > should create with custom fields | Optional fields supported |
| updateUserCollaboration > should update fields | Update listenedTracks/ratio |
| userDownloads > should create userDownload record | Creates download record |
| userDownloads > should allow multiple download records | Increment download count |
| userDownloads > should return false for non-existent download | Returns false for missing |
| getUserCollaborations > should return empty for user with no collaborations | Empty collaboration list |

---

## Configuration

### Unit Test Config
**File:** `vitest.config.ts`
- Excludes `integration/**` directory

### Integration Test Config
**File:** `vitest.integration.config.ts`
- `fileParallelism: false` - Runs tests sequentially
- Includes only `src/__tests__/integration/**/*.test.ts`

---

## Running Specific Tests

```bash
# Run single test file
npm test -- --run src/__tests__/unit/audio-engine.test.ts

# Run tests matching pattern
npm run test:integration -- --testNamePattern="Voting"

# Run with watch mode
npm test -- --watch
```
