## Authentication & Onboarding
- **As a visitor, I want to create an account with email, password, and username so I can join collaborations.**  
  The sign-up form enforces matching passwords, collects the username, then persists the profile through `signUp` (`src/components/auth/RegisterForm.tsx:45`, `src/components/auth/RegisterForm.tsx:23`, `src/components/auth/RegisterForm.tsx:31`, `src/stores/useAuthStore.ts:39`, `src/stores/useAuthStore.ts:42`).

- **As a returning user, I want to sign in with email/password or Google so I can resume work quickly.**  
  The login form handles credential submission, while the Google button routes through `signInWithGoogle` (`src/components/auth/LoginForm.tsx:38`, `src/components/auth/LoginForm.tsx:24`, `src/components/auth/LoginForm.tsx:77`, `src/stores/useAuthStore.ts:25`, `src/stores/useAuthStore.ts:51`).

- **As a newly registered user, I want to claim a unique username before entering the app so collaborators can recognise me.**  
  Users without a username are redirected to onboarding, which validates and saves the handle (`src/components/AuthRoute.tsx:13`, `src/components/AuthRoute.tsx:15`, `src/views/UsernameOnboarding.tsx:43`, `src/views/UsernameOnboarding.tsx:55`).

- **As any visitor, I want a single auth surface where I can swap between login, registration, or password reset modes so I can recover access without losing context.**  
  The shared auth view toggles between dedicated forms while maintaining mode-specific state (`src/views/auth/AuthView.tsx:35`, `src/views/auth/AuthView.tsx:41`, `src/views/auth/AuthView.tsx:45`).

## Discovery & Project Setup
- **As a visitor, I want to browse current collaborations and land on the correct workflow for each status so I can participate at the right stage.**  
  The collaboration list pulls all entries and maps the status to the appropriate route (`src/views/DashboardView.tsx:20`, `src/views/DashboardView.tsx:57`).

- **As a moderator, I want a quick view of collaborations needing review so I can prioritise moderation.**  
  The list highlights items with pending submissions and deep-links to moderation (`src/views/DashboardView.tsx:24`, `src/views/DashboardView.tsx:72`, `src/views/DashboardView.tsx:78`).

- **As a project owner, I want to manage my projects and create new ones from the dashboard so I can spin up collaborations.**  
  The panel loads projects for the signed-in user, exposes creation, and persists via `ProjectService` (`src/components/MyProjects.tsx:25`, `src/components/MyProjects.tsx:73`, `src/components/MyProjects.tsx:111`).

- **As a project owner, I want to configure collaboration details—durations, moderation requirements, and backing tracks—so each cycle fits my schedule.**  
  The creation form captures settings, creates the collaboration, and uploads the backing track (`src/components/CreateCollaboration.tsx:18`, `src/components/CreateCollaboration.tsx:84`, `src/components/CreateCollaboration.tsx:97`).

- **As a project owner, I want to review, publish, or delete collaborations so I can control their lifecycle.**  
  The edit view loads project collaborations, shows countdowns, and updates status or removal through `CollaborationService` (`src/views/ProjectEditView.tsx:25`, `src/components/CollaborationDetails.tsx:95`, `src/components/CollaborationDetails.tsx:120`, `src/components/CollaborationDetails.tsx:140`).

## Collaboration Participation
- **As any listener, I want the app to load collaboration data whether I am signed in or anonymous so I can audition submissions immediately.**  
  The store offers authenticated and anonymous loaders backed by the shared `DataService` (`src/stores/useCollaborationStore.ts:106`, `src/stores/useCollaborationStore.ts:162`, `src/services/dataService.ts:6`, `src/services/dataService.ts:19`).

- **As a participant, I want the collaboration view to frame the current project/collaboration context while audio loads, giving me orientation before voting.**  
  The voting view reads the route, fetches collaboration data, and renders project headings when ready (`src/views/VotingView.tsx:47`, `src/views/VotingView.tsx:54`, `src/views/VotingView.tsx:170`).

- **As a participant, I want to curate favourites and cast a final vote so I can keep track of top submissions.**  
  The store syncs favourites and votes with backend interactions, and the favourites UI reserves a final slot (`src/stores/useCollaborationStore.ts:313`, `src/services/interactionService.ts:18`, `src/stores/useCollaborationStore.ts:370`, `src/components/Favorites.tsx:80`).

- **As a participant, I want listens to be tracked automatically while I audition tracks so the system knows when I'm eligible to vote.**  
  Playback callbacks mark tracks as listened via the store and interaction service (`src/views/VotingView.tsx:64`, `src/stores/useCollaborationStore.ts:287`, `src/services/interactionService.ts:5`).

- **As a returning fan, I want to explore past-stage tracks to understand the collaboration history.**  
  Project history pulls past tracks from the project data and triggers playback of earlier winners (`src/stores/useCollaborationStore.ts:264`, `src/components/ProjectHistory.tsx:16`, `src/components/ProjectHistory.tsx:23`).

- **As a listener, I want transport controls, level meters, EQ, and mute toggles so I can mix submissions against the backing track.**  
  The mixer ties UI controls to playback handlers and embeds EQ plus mute toggles for adjustments (`src/components/Mixer.tsx:88`, `src/components/Mixer.tsx:144`, `src/components/SubmissionEQ.tsx:21`).

## Submission, Moderation & Results
- **As a contributor, I want to download the official backing before uploading so I can ensure alignment.**  
  The submission view enforces a download-first flow and records completion with the user service (`src/views/SubmissionView.tsx:119`, `src/components/DownloadBacking.tsx:13`, `src/components/DownloadBacking.tsx:33`).

- **As a contributor, I want to preview my track alongside the backing and upload with my mix settings captured so judges hear my intent.**  
  The upload module previews through the audio engine, gathers EQ/volume, and uploads via `SubmissionService` with progress feedback (`src/components/UploadSubmission.tsx:31`, `src/components/UploadSubmission.tsx:54`, `src/services/submissionService.ts:34`).

- **As a contributor, I want the platform to block duplicate submissions so competitions stay fair.**  
  The submission service checks previous participation and rejects re-uploads when a submission exists (`src/services/submissionService.ts:25`, `src/services/submissionService.ts:43`).

- **As a moderator, I want a focused workspace where I can play a submission and approve or reject it while listening.**  
  The moderation view loads tracks for review, and the panel surfaces approve/reject controls for the currently playing audio (`src/views/ModerationView.tsx:54`, `src/components/ModerationPanel.tsx:36`, `src/components/ModerationPanel.tsx:44`).

- **As a participant, I want a completed view that highlights the winner, lets me replay it with stored settings, and shows vote standings.**  
  The completed screen derives the winner, applies saved EQ/volume, and renders ranked results (`src/views/CompletedView.tsx:28`, `src/views/CompletedView.tsx:66`, `src/views/CompletedView.tsx:80`).

- **As a stakeholder, I want quick collaboration metrics (submissions, votes) so I can assess engagement.**  
  The collaboration data card calculates counts from submission and results arrays for quick scanning (`src/components/CollabData.tsx:6`, `src/components/CollabData.tsx:27`).
