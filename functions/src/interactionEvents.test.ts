import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  INTERACTION_EVENT_TYPES,
  addValueIfMissing,
  buildInteractionEvent,
  removeValueIfPresent,
  setBooleanValue,
  setFinalVote
} from "./interactionEvents.js";

test("buildInteractionEvent normalizes nullable fields and preserves metadata", () => {
  const createdAt = Timestamp.fromMillis(1700000000000);
  const event = buildInteractionEvent({
    userId: "user-1",
    projectId: null,
    collaborationId: "collab-1",
    trackPath: "tracks/a.mp3",
    entityType: "submission",
    eventType: INTERACTION_EVENT_TYPES.SUBMISSION_VOTE,
    metadata: { previousTrackPath: "tracks/b.mp3" }
  }, createdAt);

  assert.deepEqual(event, {
    userId: "user-1",
    projectId: null,
    collaborationId: "collab-1",
    trackPath: "tracks/a.mp3",
    entityType: "submission",
    eventType: "submission_vote",
    createdAt,
    metadata: { previousTrackPath: "tracks/b.mp3" }
  });
});

test("addValueIfMissing only changes state for a real add", () => {
  assert.deepEqual(addValueIfMissing(["a", "b"], "c"), {
    changed: true,
    next: ["a", "b", "c"]
  });

  assert.deepEqual(addValueIfMissing(["a", "b"], "b"), {
    changed: false,
    next: ["a", "b"]
  });
});

test("removeValueIfPresent only changes state for a real remove", () => {
  assert.deepEqual(removeValueIfPresent(["a", "b"], "a"), {
    changed: true,
    next: ["b"]
  });

  assert.deepEqual(removeValueIfPresent(["a", "b"], "c"), {
    changed: false,
    next: ["a", "b"]
  });
});

test("setBooleanValue reports no-op boolean toggles", () => {
  assert.deepEqual(setBooleanValue(false, true), {
    changed: true,
    next: true
  });

  assert.deepEqual(setBooleanValue(true, true), {
    changed: false,
    next: true
  });
});

test("setFinalVote records changes and previous vote metadata", () => {
  assert.deepEqual(setFinalVote(null, "tracks/a.mp3"), {
    changed: true,
    next: "tracks/a.mp3",
    metadata: undefined
  });

  assert.deepEqual(setFinalVote("tracks/a.mp3", "tracks/a.mp3"), {
    changed: false,
    next: "tracks/a.mp3"
  });

  assert.deepEqual(setFinalVote("tracks/a.mp3", "tracks/b.mp3"), {
    changed: true,
    next: "tracks/b.mp3",
    metadata: { previousTrackPath: "tracks/a.mp3" }
  });
});
