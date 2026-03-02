# Make Tunes 

A music collaboration platform that only allows to communicate through musical ideas and doesnt have any unnecessary shit.

## Tech Stack

- React 19 + TypeScript + Vite
- Firebase Auth, Firestore, Storage, Functions
- Zustand for client state
- Vitest + Testing Library for tests

## Prerequisites

- Node.js 20+
- npm
- Firebase CLI (`npm i -g firebase-tools`)
- Java runtime for Firebase emulators (JDK 21 recommended)

## Environment Variables

Create `make-tune3-react/.env.local`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Quick Start

```bash
cd make-tune3-react
npm install
npm run dev
```

## Core Commands

```bash
cd ..
npm --prefix make-tune3-react run build
firebase deploy --only hosting
firebase deploy --only functions
```


```bash
# Build
npm run build

# Lint
npm run lint

# Unit tests
npm test

# Integration tests (starts/stops emulators automatically)
npm run test:integration

# Integration tests against already-running emulators
npm run test:integration:raw
```

## Emulator Workflow

Manual emulator controls are available when needed:

```bash
# Start Firestore + Storage emulators
npm run emulators

# Stop emulators
npm run emulators:stop

# Restart emulators
npm run emulators:restart
```