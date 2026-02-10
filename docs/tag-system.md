# Tag System Plan (Beta -> ML)

## Goals
- Single-dimension, user-created tags.
- Tags attach to collaborations only (projects inherit by aggregation).
- Keep the system minimal for beta, but structured for future recommendations.

## Phase 1: Minimal (Beta)
- **Listing**: show all collaborations (no recommendation logic).
- **Tags**: used only for filtering and display.
- **Creation**: users can add tags; tags are normalized and deduped.
- **Visibility**: only tags with `collaborationCount > 0` appear in filter/suggestions.
- **Project tags**: none. Project tags are derived from collaborations as needed.

Notes on pagination:
- For beta, streaming all collaborations is ok if total count is small.
- Keep API compatible with pagination (limit/offset or cursor) for later growth.

## Phase 2: Simple Recommendations
- **Signals**: user tags + likes + tag overlap with collaborations.
- **Logic**: score by shared tags and liked-collab similarity.
- **UI**: add a “Recommended” block while keeping “All collaborations”.

## Phase 3: ML Recommendations
- **Data**: stable IDs + tag graph + interaction events (views/likes/submissions).
- **Pipeline**: candidate generation (tag/interaction embeddings) + ranking.
- **Rollout**: feature-flag the model, keep a fallback list.

## Current Implementation (Beta)

### Data model (Firestore)
- **collaborations**
  - `tags`: display names (array)
  - `tagsKey`: normalized keys (array)
- **tags**
  - `name`: display string
  - `key`: canonical slug
  - `collaborationCount`: number of collaborations using the tag
  - `projectCount`: legacy (not used in beta)
  - `createdAt`, `lastUpdatedAt`

Projects still have `tags`/`tagsKey` fields for legacy compatibility but the UI no longer writes to them.

### Tag normalization
- Implemented in `TagUtils`:
  - lowercases, trims, replaces spaces with hyphens, removes non-alphanumerics.

### Tag counts
- Cloud Functions:
  - `syncTagsOnCollaborationWrite` updates `collaborationCount` in `tags`.
  - `syncTagsOnProjectWrite` remains for legacy data but is not exercised by UI.

### UI / Services
- **TagFilter** uses `TagService.getActiveCollaborationTags()` and displays only `collaborationCount`.
- **TagInput** suggestions come from active collaboration tags; new tags can be added by typing.
- **AdminTagsView** shows tag key + collaboration count (project count hidden).
- **ProjectsTab** no longer collects or submits tags when creating projects.

## Migration Notes
- Existing project tag counts may still exist in `tags.projectCount` from older data.
- They do not affect filtering because the UI ignores project counts.
- If desired later, add an admin tool to merge/deprecate tags or to rebuild counts.

## Future Hooks
- Add `user_collab_interactions` (view/like/submit) to power Phase 2 and Phase 3.
- Consider adding `tag_aliases` for merges or deprecations.
