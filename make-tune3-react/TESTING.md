# Testing Guide

## Overview

This project uses **Vitest** for testing with two types of tests:
- **Unit Tests**: Test individual functions/components in isolation (with mocks)
- **Integration Tests**: Test multiple parts working together (with Firebase emulators)

📚 **New to integration testing?** See [INTEGRATION-TEST-TUTORIAL.md](./INTEGRATION-TEST-TUTORIAL.md) for a step-by-step guide.

## Setup

### Prerequisites

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Install project dependencies:
```bash
cd make-tune3-react
npm install
```

## Running Tests

### Unit Tests Only (No Emulators Needed)

```bash
cd make-tune3-react
npm test -- unit/
```

### Integration Tests (Requires Emulators)

**Note**: Integration tests use permissive test rules (`firestore.test.rules`, `storage.test.rules`) for the **emulators only**. Production deployments always use secure rules (`firestore.rules`, `storage.rules`).

**Step 1: Start Firebase Emulators**

In one terminal, from the project root (`MAKE-TUNE3/`):
```bash
firebase emulators:start
```

This starts:
- Firestore Emulator on port 8080 (using test rules)
- Storage Emulator on port 9199 (using test rules)
- Emulator UI on http://localhost:4000

**Security Note**: Test rules are ONLY used by emulators. Running `firebase deploy` will always deploy production rules, keeping your live database secure.

**Step 2: Run Integration Tests**

In another terminal, from `make-tune3-react/`:

```bash
npm test -- integration/
```

### All Tests

```bash
npm test
```

Watch mode (re-runs on file changes):
```bash
npm run test:watch
```

Run once and exit:
```bash
npm run test:run
```

With coverage report:
```bash
npm run test:coverage
```

Interactive UI:
```bash
npm run test:ui
```

## Test Structure

```
src/
  __tests__/
    unit/              # Unit tests (mocked dependencies)
      audio-engine.test.ts
    integration/       # Integration tests (real Firebase emulators)
      collaborationService.test.ts
  setupTests.ts        # Global test configuration
```

## Writing Tests

### Unit Tests

Test individual functions/classes with mocked dependencies.

Example:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Integration Tests

Test real Firebase operations using emulators.

Key patterns:

1. **Always clean up after tests**:
```typescript
const testIds: string[] = [];

afterEach(async () => {
  for (const id of testIds) {
    await deleteDoc(doc(db, 'collection', id));
  }
  testIds.length = 0;
});
```

2. **Track created resources**:
```typescript
const result = await CollaborationService.createProject(data);
testIds.push(result.id);
```

3. **Test the full flow**:
```typescript
const created = await service.create(data);
const retrieved = await service.get(created.id);
expect(retrieved).toEqual(created);
```

## Best Practices

### DO:
- Write tests before refactoring
- Test one thing per test case
- Use descriptive test names
- Clean up test data
- Test error cases
- Test edge cases

### DON'T:
- Share state between tests
- Depend on test execution order
- Use real Firebase (always use emulators for integration tests)
- Leave test data in emulators
- Test implementation details

## Common Patterns

### Testing Async Operations
```typescript
it('should create a project', async () => {
  const result = await service.createProject(data);
  expect(result.id).toBeDefined();
});
```

### Testing Timestamps
```typescript
const before = Date.now();
const result = await service.create(data);
const after = Date.now();

expect(result.createdAt.toMillis()).toBeGreaterThanOrEqual(before);
expect(result.createdAt.toMillis()).toBeLessThanOrEqual(after);
```

### Testing Uniqueness
```typescript
const item1 = await service.create(data1);
const item2 = await service.create(data2);
expect(item1.id).not.toBe(item2.id);
```

### Testing Persistence
```typescript
const created = await service.create(data);
const retrieved = await service.get(created.id);
expect(retrieved?.name).toBe(data.name);
```

## Debugging Tests

### View Emulator Data
Open http://localhost:4000 while emulators are running to see:
- Firestore collections and documents
- Storage files
- Logs

### Run Single Test File
```bash
npm test -- collaborationService.test.ts
```

### Run Single Test Case
```bash
npm test -- -t "should create a project"
```

### Enable Verbose Output
```bash
npm test -- --reporter=verbose
```

## Troubleshooting

### "Connection refused" errors
- Ensure Firebase emulators are running
- Check ports 8080 and 9199 are not in use

### Tests pass individually but fail together
- Check for shared state
- Ensure cleanup in `afterEach` is working
- Tests might be affecting each other

### Slow tests
- Integration tests are slower than unit tests (expected)
- Consider running unit tests separately: `npm test -- unit/`

### Flaky tests
- Check for timing issues
- Ensure proper cleanup
- Avoid hardcoded delays (use proper async/await)

