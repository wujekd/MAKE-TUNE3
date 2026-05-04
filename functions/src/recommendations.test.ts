import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  buildHydratedRecommendationItems,
  getStoredRecommendationItemsFromDoc,
  sanitizeStoredRecommendationItems,
} from "./recommendations.js";

test("sanitizeStoredRecommendationItems keeps valid rows sorted by rank", () => {
  const items = sanitizeStoredRecommendationItems([
    {
      rank: 3,
      collaborationId: "collab-3",
      projectId: "project-3",
      score: 0.31,
      highlightedTrackPath: "",
    },
    {
      rank: 1,
      collaborationId: "collab-1",
      projectId: "project-1",
      score: "0.91",
      highlightedTrackPath: "tracks/a.wav",
    },
    {
      rank: 0,
      collaborationId: "bad-collab",
      projectId: "project-2",
      score: 0.5,
    },
  ]);

  assert.deepEqual(items, [
    {
      rank: 1,
      collaborationId: "collab-1",
      projectId: "project-1",
      score: 0.91,
      highlightedTrackPath: "tracks/a.wav",
    },
    {
      rank: 3,
      collaborationId: "collab-3",
      projectId: "project-3",
      score: 0.31,
      highlightedTrackPath: null,
    },
  ]);
});

test("buildHydratedRecommendationItems filters missing and non-public collaborations", () => {
  const recommendationDoc = {
    generatedAt: "2026-05-04T10:00:00.000Z",
    modelVersion: "hybrid-v1",
    recommendations: [
      {
        rank: 1,
        collaborationId: "collab-visible",
        projectId: "project-visible",
        score: 0.8842,
        highlightedTrackPath: "submissions/lead.wav",
      },
      {
        rank: 2,
        collaborationId: "collab-missing",
        projectId: "project-missing",
        score: 0.71,
        highlightedTrackPath: null,
      },
      {
        rank: 3,
        collaborationId: "collab-hidden",
        projectId: "project-hidden",
        score: 0.62,
        highlightedTrackPath: null,
      },
    ],
  };

  const collaborationMap = new Map<string, Record<string, unknown>>([
    ["collab-visible", {
      name: "Open Collaboration",
      status: "submission",
      description: "Fresh stems",
      tags: ["house", "club"],
      projectId: "project-visible",
      backingTrackPath: "backings/open.wav",
      publishedAt: Timestamp.fromMillis(1700000000000),
      submissionCloseAt: Timestamp.fromMillis(1700003600000),
      votingCloseAt: Timestamp.fromMillis(1700007200000),
      updatedAt: Timestamp.fromMillis(1700001800000),
      submissionDuration: 3600,
      votingDuration: 3600,
    }],
    ["collab-hidden", {
      name: "Draft Collaboration",
      status: "unpublished",
      projectId: "project-hidden",
    }],
  ]);

  const projectMap = new Map<string, Record<string, unknown>>([
    ["project-visible", { name: "Visible Project" }],
  ]);

  const items = buildHydratedRecommendationItems({
    recommendationDoc,
    collaborationMap,
    projectMap,
  });

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    collaborationId: "collab-visible",
    collaborationName: "Open Collaboration",
    collaborationStatus: "submission",
    collaborationDescription: "Fresh stems",
    collaborationTags: ["house", "club"],
    projectId: "project-visible",
    projectName: "Visible Project",
    rank: 1,
    score: 0.8842,
    highlightedTrackPath: "submissions/lead.wav",
    backingTrackPath: "backings/open.wav",
    publishedAt: 1700000000000,
    submissionCloseAt: 1700003600000,
    votingCloseAt: 1700007200000,
    updatedAt: 1700001800000,
    submissionDurationSeconds: 3600,
    votingDurationSeconds: 3600,
    generatedAt: "2026-05-04T10:00:00.000Z",
    modelVersion: "hybrid-v1",
  });
});

test("getStoredRecommendationItemsFromDoc falls back to legacy collaborations field", () => {
  const items = getStoredRecommendationItemsFromDoc({
    generatedAt: Timestamp.fromMillis(1700000000000),
    modelVersion: "legacy-v1",
    collaborations: [
      {
        rank: 1,
        collaborationId: "collab-legacy",
        projectId: "project-legacy",
        score: 0.44,
        highlightedTrackPath: null,
      },
    ],
  });

  assert.deepEqual(items, [
    {
      rank: 1,
      collaborationId: "collab-legacy",
      projectId: "project-legacy",
      score: 0.44,
      highlightedTrackPath: null,
    },
  ]);
});
