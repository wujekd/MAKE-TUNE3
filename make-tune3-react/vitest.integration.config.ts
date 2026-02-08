
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/setupTests.ts',
        include: ['src/__tests__/integration/**/*.test.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
        ],
        // Run test files sequentially to avoid Firestore emulator state conflicts
        fileParallelism: false,
        sequence: {
            shuffle: false,
        },
    },
})
