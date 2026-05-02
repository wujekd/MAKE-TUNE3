import { Timestamp } from "firebase-admin/firestore";

export const INTERACTION_EVENTS_COLLECTION = "interactionEvents" as const;

export const INTERACTION_EVENT_TYPES = {
  SUBMISSION_LIKE: "submission_like",
  SUBMISSION_UNLIKE: "submission_unlike",
  SUBMISSION_FAVORITE: "submission_favorite",
  SUBMISSION_UNFAVORITE: "submission_unfavorite",
  SUBMISSION_VOTE: "submission_vote",
  COLLABORATION_LIKE: "collaboration_like",
  COLLABORATION_UNLIKE: "collaboration_unlike",
  COLLABORATION_FAVORITE: "collaboration_favorite",
  COLLABORATION_UNFAVORITE: "collaboration_unfavorite"
} as const;

export type InteractionEventType =
  (typeof INTERACTION_EVENT_TYPES)[keyof typeof INTERACTION_EVENT_TYPES];

export type InteractionEntityType = "submission" | "collaboration";

export interface InteractionEventMetadata {
  previousTrackPath?: string | null;
}

export interface InteractionEventInput {
  userId: string;
  projectId: string | null;
  collaborationId: string;
  trackPath: string | null;
  entityType: InteractionEntityType;
  eventType: InteractionEventType;
  metadata?: InteractionEventMetadata;
}

export interface InteractionEvent extends InteractionEventInput {
  createdAt: Timestamp;
}

interface ArrayChangeResult {
  changed: boolean;
  next: string[];
}

interface BooleanChangeResult {
  changed: boolean;
  next: boolean;
}

interface VoteChangeResult {
  changed: boolean;
  next: string;
  metadata?: InteractionEventMetadata;
}

export const buildInteractionEvent = (
  input: InteractionEventInput,
  createdAt: Timestamp
): InteractionEvent => {
  const event: InteractionEvent = {
    userId: input.userId,
    projectId: input.projectId ?? null,
    collaborationId: input.collaborationId,
    trackPath: input.trackPath ?? null,
    entityType: input.entityType,
    eventType: input.eventType,
    createdAt
  };

  if (input.metadata && Object.values(input.metadata).some((value) => value != null)) {
    event.metadata = input.metadata;
  }

  return event;
};

export const addValueIfMissing = (values: string[], value: string): ArrayChangeResult => {
  if (values.includes(value)) {
    return { changed: false, next: [...values] };
  }
  return { changed: true, next: [...values, value] };
};

export const removeValueIfPresent = (values: string[], value: string): ArrayChangeResult => {
  if (!values.includes(value)) {
    return { changed: false, next: [...values] };
  }
  return { changed: true, next: values.filter((entry) => entry !== value) };
};

export const setBooleanValue = (current: boolean, next: boolean): BooleanChangeResult => ({
  changed: current !== next,
  next
});

export const setFinalVote = (
  current: string | null | undefined,
  next: string
): VoteChangeResult => {
  const currentValue = typeof current === "string" && current.trim() ? current : null;
  if (currentValue === next) {
    return { changed: false, next };
  }

  return {
    changed: true,
    next,
    metadata: currentValue ? { previousTrackPath: currentValue } : undefined
  };
};
