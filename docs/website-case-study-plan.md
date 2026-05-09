

Make Tunes: A Full-Stack Music Collaboration Platform

**Short description**

Make Tunes is a music collaboration platform designed around a simple constraint: users collaborate through musical ideas first. The system supports project creation, backing track uploads, submissions, voting, moderation, admin tooling, and a recommendation pipeline built from user interaction data.

**Portfolio framing**

This project is strongest when framed as more than a React/Firebase app. It combines product design, full-stack application development, audio handling, serverless backend logic, moderation workflows, testing, and AI/recommendation-system thinking.

## Target Audience

The page should work for:

- recruiters looking for evidence of full-stack engineering ability
- technical interviewers who want to understand the architecture
- other developers who want to skim the system design
- non-technical visitors who just need to understand what the project does

Keep the first half product-focused and readable. Put the deeper technical detail further down the page.

## Recommended Page Structure

### 1. Hero Section

Purpose: explain the project in a few seconds.

Include:

- project name
- one-sentence product description
- your role
- core stack chips
- links to GitHub, live demo, video demo, or screenshots if available

Suggested copy:

> Make Tunes is a full-stack music collaboration platform where users create projects, upload backing tracks, submit ideas, vote on outcomes, and discover collaborations through recommendation logic.

Suggested stack chips:

- React
- TypeScript
- Firebase
- Cloud Functions
- Firestore
- Firebase Storage
- Vitest
- Python
- Recommendation Systems
- FastAPI / PyTorch

### 2. Project Overview

Purpose: explain what the system is and why it exists.

Include:

- the idea behind music-first collaboration
- what users can do
- what makes the project technically interesting
- current status, such as prototype, beta, personal project, or coursework-linked system

Suggested copy:

> I built Make Tunes to explore what an online music collaboration platform feels like when the product is focused on the music itself rather than chat, follower counts, or social-media style interaction. Users move through a structured workflow: projects are created, backing tracks are uploaded, collaborators submit ideas, the community votes, and completed collaborations become part of the wider discovery loop.



### 4. Core Features

Purpose: give a fast overview of the product.

Recommended feature list:

- Authentication and username onboarding
- Project creation and management
- Collaboration stages: submission, voting, completed
- Backing track and submission uploads
- Waveform generation and audio preview support
- Voting flow for submitted tracks
- Dashboard with active, completed, and recommended collaborations
- Tag filtering and tag management
- Reporting and moderation workflows
- Admin views for users, projects, tags, reports, settings, and interaction events
- Recommendation delivery based on interaction data

Possible layout: use a compact grid of feature cards, with one or two sentences each.

### 5. System Architecture

Purpose: show how the full system fits together.

Suggested diagram:

```text
React + TypeScript frontend
        |
        v
Firebase Auth
        |
        v
Firestore service layer
        |
        v
Cloud Functions
        |
        +--> Firebase Storage for audio files
        +--> Waveform generation
        +--> Tag synchronization
        +--> Interaction event logging
        +--> Recommendation hydration
        +--> Moderation and admin workflows
        |
        v
Recommendation pipeline / HSD service
```

Suggested copy:

> The frontend is built with React and TypeScript, while Firebase provides authentication, database storage, file storage, hosting, and serverless backend functions. I kept the frontend organized around service modules so Firebase calls and business logic are not scattered directly through UI components.

Important architecture points:

- React views are split by workflow: dashboard, submission, voting, completed, admin, moderation, and account.
- Firebase Auth handles identity.
- Firestore stores users, projects, collaborations, submissions, tags, reports, settings, interaction events, and recommendations.
- Firebase Storage stores backing tracks and submission audio.
- Cloud Functions enforce backend rules, generate derived data, and handle sensitive operations.
- Python recommendation scripts process interaction data into app-facing recommendations.

### 6. Frontend Implementation

Purpose: show application engineering quality.

Include:

- React 19, TypeScript, Vite
- route-based views
- lazy loading for larger pages
- Zustand for client state
- service layer for Firebase operations
- custom hooks for audio, collaboration loading, prefetching, and responsive behavior
- modular admin and moderation views

Suggested copy:

> The frontend is structured as a real application rather than a collection of pages. Views are organized around product workflows, while Firebase access is handled through service modules. This made the UI easier to test and kept backend-specific details out of the components.

Mention examples:

- `DashboardView` for browsing collaborations and recommendations
- `SubmissionView` for uploading or managing musical submissions
- `VotingView` for ranking or selecting submissions
- `ModerationView` and admin views for operational workflows

### 7. Backend And Firebase

Purpose: show that the backend does meaningful work.

Include:

- Firebase Auth
- Firestore
- Storage
- Cloud Functions
- security rules
- emulator workflow
- backend enforcement of limits and permissions

Backend responsibilities:

- checking whether users are suspended
- enforcing project/submission settings
- reserving upload permissions
- processing audio uploads
- generating waveform metadata
- syncing tags when collaborations change
- recording interaction events
- hydrating stored recommendations
- supporting reports and moderation
- exposing admin/system settings functionality

Suggested copy:

> Cloud Functions handle the parts of the system that should not be trusted to the client: upload reservations, user status checks, tag synchronization, derived waveform data, recommendation delivery, and moderation-related updates.

### 8. Audio Handling

Purpose: highlight the domain-specific part of the project.

Include:

- backing track uploads
- submission uploads
- supported audio formats
- Firebase Storage
- waveform metadata
- client-side preload/prefetch logic
- separation between raw audio and lightweight display data

Suggested copy:

> The audio pipeline is one of the most domain-specific parts of the system. Audio files are stored in Firebase Storage, while backend functions generate waveform metadata that the frontend can use for lightweight visual previews. This keeps the interface responsive without repeatedly loading full audio files just to render track shapes.

### 9. Recommendation System

Purpose: present the AI/recommendation work clearly.

Explain it as a hybrid recommender:

- interaction events are collected from user behavior
- user history is converted into useful features
- tags and project affinity contribute to ranking
- collaborative filtering adds user-behavior similarity
- popularity and fallback logic help with sparse data
- results are written back as top-N recommendation lists

Suggested pipeline diagram:

```text
User interactions
        |
        v
Interaction events
        |
        v
Feature building
        |
        +--> user tag affinity
        +--> project affinity
        +--> popularity features
        +--> collaborative filtering scores
        |
        v
Hybrid scoring
        |
        v
Top-N recommendations per user
        |
        v
Firestore recommendation documents
        |
        v
Dashboard recommendations panel
```

Suggested copy:

> The recommendation system is built as a hybrid pipeline. It combines collaborative filtering, tag affinity, project affinity, interaction history, and popularity-based fallback scoring. This lets the system generate useful recommendations even when a user has limited history, while still improving as more interaction data becomes available.

Mention implementation details:

- Python pipeline for extraction, feature building, scoring, and writeback
- synthetic data notebooks used during development
- top-N recommendations per user
- Cloud Function hydration before recommendations reach the frontend
- model/version metadata for future iteration

### 10. Moderation And Safety

Purpose: show that you thought beyond happy-path product flows.

Include:

- reporting flows
- admin report review
- resolved reports
- suspended user checks
- system settings
- experimental hate-speech detection service

Suggested copy:

> I treated moderation as part of the system design rather than an afterthought. The app includes reporting flows, admin review screens, user suspension checks, global settings, and an experimental hate-speech detection service that can be integrated into backend workflows.

For the AI service:

- standalone FastAPI service
- PyTorch model artifact
- research and service folders kept separate
- API token/backend identity controls
- intended as a preview integration bundle

### 11. Data Model

Purpose: give technical readers enough structure without listing every field.

Important collections:

- `users`: profiles, account state, roles, limits, moderation status
- `projects`: user-created music projects
- `collaborations`: project-linked collaboration rounds and workflow state
- `submissions`: uploaded musical ideas for a collaboration
- `tags`: normalized tag records and usage counts
- `interactionEvents`: normalized behavior data for recommendations and analytics
- `recommendations`: precomputed recommendation lists
- `reports`: user reports for moderation
- `systemSettings`: global feature flags and platform limits
- `hsdEvents`: hate-speech detection related events

Suggested copy:

> I used interaction events as a bridge between the product and the recommendation system. Instead of hard-coding recommendations from UI state, user behavior is logged in a normalized format that can later be used by analytics, ranking, or ML workflows.

### 12. Testing And Quality

Purpose: show engineering discipline.

Include:

- unit tests with Vitest
- React Testing Library
- Firebase emulator integration tests
- Cloud Function tests
- Firestore and Storage rules testing
- build and lint workflow

Suggested copy:

> I used Firebase emulators for integration tests so Firestore and Storage behavior could be tested locally without touching production data. This was especially useful for validating service-layer behavior, permissions, and workflow state changes.

Mention useful commands at the bottom only if the website page is intended for developers:

```bash
npm run build
npm run lint
npm test
npm run test:integration
```

### 13. Engineering Decisions

Purpose: explain tradeoffs and judgment.

Good decisions to mention:

- using Firebase to move quickly while still having real backend enforcement
- keeping frontend Firebase access behind services
- treating interaction data as a first-class system concept
- keeping the beta tag system simple but compatible with future recommendations
- building recommendation fallbacks for sparse data
- separating the hate-speech detection service from the main app
- using emulators for local integration tests

Suggested copy:

> A lot of the project was about choosing the right level of complexity. For example, the tag system is intentionally simple in the beta version, but the data shape still supports future recommendation and filtering work. Similarly, the recommendation pipeline can work with synthetic or exported data before needing a fully automated production ML workflow.

### 14. Challenges

Purpose: make the project feel real.

Possible challenges:

- designing clear collaboration stages
- handling audio uploads safely
- keeping Firestore data consistent across client and backend updates
- generating useful recommendations with sparse user histories
- making moderation and admin tooling part of the product
- testing Firebase workflows locally
- balancing product simplicity with technical ambition

Suggested copy:

> One of the harder parts was designing the project around creative workflow stages instead of generic social actions. The system needed enough structure to support submissions, voting, completion, and recommendations, but not so much structure that it stopped feeling lightweight for musicians.

### 15. What I Learned

Purpose: connect the project to your growth as a graduate engineer.

Include:

- full-stack product architecture
- Firebase backend patterns
- audio upload and processing workflows
- recommendation-system feature design
- moderation and safety considerations
- local testing with emulators
- separating research code from production-facing services

Suggested copy:

> This project helped me connect product design with system design. I had to think about the user workflow, the backend rules that protect it, the data model that supports it, and the recommendation signals that make the platform feel more personal over time.

### 16. Future Improvements

Purpose: show ambition without pretending everything is finished.

Good future work:

- deploy and harden the recommendation pipeline
- add recommendation evaluation metrics
- improve audio player and waveform UX
- add richer admin analytics
- add notification workflows
- improve search and pagination
- experiment with audio embeddings or music-similarity models
- refine the hate-speech detection integration
- add more observability around Cloud Functions
- improve mobile audio workflows

Suggested copy:

> The next step would be to make the recommendation pipeline more production-like: scheduled runs, evaluation metrics, clearer model/version tracking, and better admin visibility into what the system is recommending and why.

## Suggested Visuals

Add these if possible:

- dashboard screenshot
- submission flow screenshot
- voting flow screenshot
- admin or moderation screenshot
- recommendation panel screenshot
- architecture diagram
- recommendation pipeline diagram
- optional short demo video or GIF

Avoid using too many screenshots. Three strong screenshots plus two diagrams is better than a long image dump.

## Suggested Website Navigation

For a single case-study page:

1. Overview
2. Product
3. Architecture
4. Recommendation System
5. Moderation
6. Testing
7. Learnings
8. Roadmap

For a larger documentation section:

- `Overview`
- `Architecture`
- `Frontend`
- `Backend`
- `Audio Pipeline`
- `Recommendation System`
- `Moderation`
- `Testing`
- `Roadmap`

## Copy Style Guide

Use:

- short paragraphs
- direct language
- first person where it helps
- concrete examples
- honest status notes
- clear technical nouns

Avoid:

- vague claims like "cutting-edge" or "revolutionary"
- long stack lists without context
- over-explaining implementation details above the fold
- pretending prototype parts are production-scale
- too much academic language

Good tone:

> I built this to explore how a music collaboration platform could feel if the product focused on structured creative stages rather than social noise.

Less good tone:

> This revolutionary platform transforms the music collaboration industry using state-of-the-art AI.

## Strong Final Summary

Use something like this near the end of the page:

> Make Tunes gave me a chance to build across the full stack: a React interface, Firebase backend, serverless workflows, audio storage and waveform processing, moderation tools, and a hybrid recommendation system. The most interesting part was connecting product behavior to useful data, so the system could move from simple collaboration workflows toward more personalized discovery.

