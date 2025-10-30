# Make Tune 3 System Documentation

## System Overview
- Single Page Application built with React, TypeScript, and Vite; core routes cover collaboration browsing, voting, moderation, submission, and results (`src/views/VotingView.tsx:159`, `src/views/ModerationView.tsx:44`, `src/views/SubmissionView.tsx:94`, `src/views/CompletedView.tsx:51`).
- Zustand powers domain stores for authentication, collaboration data, playback, and UI shell; `AppShell` unifies navigation, breadcrumbs, and auth controls (`src/stores/useAuthStore.ts:21`, `src/stores/useCollaborationStore.ts:63`, `src/components/AppShell.tsx:31`).
- Firebase underpins persistence: Auth (user accounts), Firestore (projects/collaborations), Storage (audio assets), and Functions (submission summaries) (`src/services/authService.ts:1`, `src/services/projectService.ts:1`, `src/services/collaborationService.ts:1`, `src/services/submissionService.ts:129`).

## Features & Workflows

### Authentication & Onboarding
- Email/password and Google sign-in supported via auth store actions; login form forwards credentials or triggers Google OAuth (`src/components/auth/LoginForm.tsx:38`, `src/stores/useAuthStore.ts:25`, `src/stores/useAuthStore.ts:51`).
- Registration requires username and matching passwords before persisting the profile (`src/components/auth/RegisterForm.tsx:45`, `src/components/auth/RegisterForm.tsx:23`, `src/stores/useAuthStore.ts:39`).
- Users without usernames are redirected to onboarding to claim one before entering the main experience (`src/components/AuthRoute.tsx:13`, `src/views/UsernameOnboarding.tsx:43`).

### Discovery & Project Setup
- Collaboration list fetches all entries, maps status to routes, and highlights items needing moderation (`src/views/DashboardView.tsx:20`, `src/views/DashboardView.tsx:57`, `src/views/DashboardView.tsx:72`).
- “My Projects” panel loads ownership-scoped projects, offers creation with validation, and links to edit pages (`src/components/MyProjects.tsx:25`, `src/components/MyProjects.tsx:73`, `src/components/MyProjects.tsx:111`).
- `ProjectEditView` hosts collaboration management: listing, selecting, creating, editing, publishing, deleting, and downloading winners (`src/views/ProjectEditView.tsx:25`, `src/components/CollaborationDetails.tsx:95`, `src/components/CollaborationDetails.tsx:120`, `src/components/CollaborationDetails.tsx:140`).

### Collaboration Participation
- Voting view resolves collaboration by route, loads authenticated or anonymous data, and renders context headers plus submission carousel (`src/views/VotingView.tsx:47`, `src/views/VotingView.tsx:54`, `src/views/VotingView.tsx:170`).
- Favorites, listens, and final votes sync through collaboration store methods backed by `InteractionService` (`src/stores/useCollaborationStore.ts:313`, `src/services/interactionService.ts:18`, `src/stores/useCollaborationStore.ts:370`).
- Project history component exposes past-stage tracks sourced from project metadata (`src/stores/useCollaborationStore.ts:264`, `src/components/ProjectHistory.tsx:16`).

### Submission, Moderation, and Results
- Submission view enforces backing download (recorded via `UserService`), enables preview against backing, and uploads with captured EQ/volume (`src/views/SubmissionView.tsx:119`, `src/components/DownloadBacking.tsx:13`, `src/components/UploadSubmission.tsx:54`).
- `SubmissionService` prevents duplicate submissions, updates participation metadata, and records settings alongside file paths (`src/services/submissionService.ts:25`, `src/services/submissionService.ts:43`, `src/services/submissionService.ts:94`).
- Moderation view loads collaboration tracks and provides approve/reject controls for the currently playing submission (`src/views/ModerationView.tsx:54`, `src/components/ModerationPanel.tsx:36`, `src/components/ModerationPanel.tsx:43`).
- Completed view surfaces winner playback (applying stored EQ) and vote standings (`src/views/CompletedView.tsx:66`, `src/views/CompletedView.tsx:80`).
- `CollabData` card summarizes submissions and votes for quick analytics (`src/components/CollabData.tsx:21`, `src/components/CollabData.tsx:27`).

## State & Data Model
- Collaboration domain types define projects, collaborations, tracks, submissions, and user-collaboration documents (`src/types/collaboration.ts:6`).
- `TrackUtils` offers pure helpers for track creation, favorite filtering, lookups, and approval updates (`src/utils/TrackUtils.ts:12`, `src/utils/TrackUtils.ts:35`, `src/utils/TrackUtils.ts:63`).
- `useCollaborationStore` centralizes collaboration state (projects, tracks, favorites, moderation actions) and delegates to services for data fetching and interactions (`src/stores/useCollaborationStore.ts:63`, `src/stores/useCollaborationStore.ts:106`, `src/stores/useCollaborationStore.ts:313`, `src/stores/useCollaborationStore.ts:395`).
- `useAuthStore` wraps Firebase auth events and exposes sign-in/out/reset helpers; on sign-out it also clears collaboration state (`src/stores/useAuthStore.ts:21`, `src/stores/useAuthStore.ts:63`, `src/stores/useAuthStore.ts:69`).

## Audio Engine Integration
- `AudioEngineContext` provides the custom audio engine and reactive state to consumers; components call engine methods for playback, preloading, EQ, and mute control (`src/views/VotingView.tsx:64`, `src/views/VotingView.tsx:101`, `src/views/SubmissionView.tsx:24`, `src/components/Mixer.tsx:144`).
- `Mixer` links UI sliders, transport controls, and EQ toggles to playback store handlers and engine callbacks (`src/components/Mixer.tsx:88`, `src/components/Mixer.tsx:144`, `src/components/Mixer.tsx:151`).
- `SubmissionEQ` manipulates individual EQ bands and high-pass filters via engine setters (`src/components/SubmissionEQ.tsx:21`, `src/components/SubmissionEQ.tsx:91`, `src/components/SubmissionEQ.tsx:116`).

## Firebase Services
- `AuthService` encapsulates registration, login, Google sign-in, username claims, sign-out, and password reset (`src/services/authService.ts:1`).
- `ProjectService` and `CollaborationService` handle Firestore CRUD with timestamps, moderation flags, and helper queries (`src/services/projectService.ts:1`, `src/services/collaborationService.ts:1`).
- `SubmissionService` uploads backing/submission files to Storage, updates collaboration docs, records submission metadata, and exposes a callable for listing user submissions (`src/services/submissionService.ts:11`, `src/services/submissionService.ts:73`, `src/services/submissionService.ts:129`).
- `UserService` and `InteractionService` manage `userCollaborations` documents for listens, favorites, votes, and backing downloads (`src/services/userService.ts:1`, `src/services/interactionService.ts:5`).
- `DataService` coordinates batched loads for collaboration view models (authenticated or anonymous) (`src/services/dataService.ts:6`, `src/services/dataService.ts:19`).

## UI Components
- `AppShell` renders breadcrumbs, action buttons, auth menu, and developer toggles while hosting route outlet content (`src/components/AppShell.tsx:31`, `src/components/AppShell.tsx:82`, `src/components/AppShell.tsx:120`).
- Collaboration widgets—Favorites, ModerationPanel, ProjectHistory, CollabData—consume store state or audio context to display track-centric information (`src/components/Favorites.tsx:67`, `src/components/ModerationPanel.tsx:36`, `src/components/ProjectHistory.tsx:16`, `src/components/CollabData.tsx:21`).
- Submission workflow components `DownloadBacking` and `UploadSubmission` cover asset retrieval and upload with progress and error feedback (`src/components/DownloadBacking.tsx:10`, `src/components/UploadSubmission.tsx:25`).

## Testing & Tooling
- Vitest powers the test suite; documentation in `INTEGRATION-TESTING-GUIDE.md` guides setup, and refactor notes outline the transition from the monolithic app store to modular slices (`make-tune3-react/INTEGRATION-TESTING-GUIDE.md`, `make-tune3-react/APPSTORE-REFACTORING-PLAN.md`).

## Known Gaps & Recommendations
- Implement real moderation state changes: `approveSubmission` and `rejectSubmission` call a stubbed method and do not persist approval flags yet (`src/stores/useCollaborationStore.ts:395`, `src/services/submissionService.ts:137`).
- Flesh out password recovery by wiring the UI to `resetPassword` and surfacing success/error feedback (`src/components/auth/ForgotPassword.tsx:7`, `src/stores/useAuthStore.ts:81`).
- Harden error handling and reduce console noise; many async flows only log failures without user-visible states (`src/views/DashboardView.tsx:19`, `src/views/VotingView.tsx:117`).
- Replace remaining `any` casts with typed helpers/guards to strengthen TypeScript coverage, especially around Firestore data and submission entries (`src/stores/useCollaborationStore.ts:121`, `src/services/submissionService.ts:94`).
