/// <reference types="vite/client" />

/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

declare global {
    var firebaseApp: any;
    var firebaseDb: any;
    var firebaseStorage: any;
  }