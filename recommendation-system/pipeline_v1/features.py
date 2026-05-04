from __future__ import annotations

import numpy as np
import pandas as pd

from .config import (
    ACTIVE_STATUSES,
    COMPLETED_STATUSES,
    EVENT_WEIGHTS,
    FALLBACK_POPULARITY_STRATEGY,
    FALLBACK_WARM_STRATEGY,
    HYBRID_V1_STRATEGY,
)


def build_collaboration_history(
    events: pd.DataFrame,
    collaborations: pd.DataFrame,
) -> pd.DataFrame:
    events = events.copy()
    events["eventWeight"] = events["eventType"].map(EVENT_WEIGHTS).fillna(0.0)

    feature_table = (
        events.groupby(["userId", "projectId", "collaborationId", "eventType"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    for event_type in EVENT_WEIGHTS:
        if event_type not in feature_table.columns:
            feature_table[event_type] = 0

    totals = (
        events.groupby(["userId", "projectId", "collaborationId"], as_index=False)["eventWeight"]
        .sum()
        .rename(columns={"eventWeight": "totalEventWeight"})
    )

    last_event = (
        events.groupby(["userId", "projectId", "collaborationId"], as_index=False)["createdAt"]
        .max()
        .rename(columns={"createdAt": "lastEventAt"})
    )

    collab_meta = collaborations[
        ["collaborationId", "projectId", "name", "status", "tags", "tagsKey", "publishedAt"]
    ].copy()

    history = (
        feature_table
        .merge(totals, on=["userId", "projectId", "collaborationId"], how="left")
        .merge(last_event, on=["userId", "projectId", "collaborationId"], how="left")
        .merge(collab_meta, on=["collaborationId", "projectId"], how="left")
    )

    return history.sort_values(
        ["userId", "lastEventAt", "totalEventWeight"],
        ascending=[True, False, False],
    )


def build_user_summary(users: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    summary = users[["userId"]].drop_duplicates().copy()

    positive_counts = (
        events.groupby("userId")
        .size()
        .rename("positiveEventCount")
        .reset_index()
    )
    summary = summary.merge(positive_counts, on="userId", how="left")
    summary["positiveEventCount"] = summary["positiveEventCount"].fillna(0).astype(int)
    summary["strategyUsed"] = np.select(
        [
            summary["positiveEventCount"] == 0,
            summary["positiveEventCount"].between(1, 4),
            summary["positiveEventCount"] >= 5,
        ],
        [
            FALLBACK_POPULARITY_STRATEGY,
            FALLBACK_WARM_STRATEGY,
            HYBRID_V1_STRATEGY,
        ],
        default=FALLBACK_POPULARITY_STRATEGY,
    )
    return summary.sort_values("userId").reset_index(drop=True)


def build_active_catalog(collaborations: pd.DataFrame) -> pd.DataFrame:
    return collaborations[collaborations["status"].isin(ACTIVE_STATUSES)].copy()


def build_completed_catalog(collaborations: pd.DataFrame) -> pd.DataFrame:
    return collaborations[collaborations["status"].isin(COMPLETED_STATUSES)].copy()


def build_popularity_features(history: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        history.groupby(["collaborationId", "projectId"], as_index=False)[
            [
                "collaboration_favorite",
                "collaboration_like",
                "submission_favorite",
                "submission_like",
                "submission_vote",
            ]
        ]
        .sum()
    )

    grouped["popularityScore"] = (
        1.75 * grouped["collaboration_favorite"]
        + 0.75 * grouped["collaboration_like"]
        + 2.00 * grouped["submission_favorite"]
        + 1.00 * grouped["submission_like"]
        + 3.00 * grouped["submission_vote"]
    )

    max_score = grouped["popularityScore"].max() or 1.0
    grouped["popularityScoreNorm"] = grouped["popularityScore"] / max_score
    return grouped[["collaborationId", "projectId", "popularityScoreNorm"]]


def build_user_project_affinity(history: pd.DataFrame) -> pd.DataFrame:
    affinity = (
        history.groupby(["userId", "projectId"], as_index=False)["totalEventWeight"]
        .sum()
        .rename(columns={"totalEventWeight": "projectAffinity"})
    )

    per_user_max = affinity.groupby("userId")["projectAffinity"].transform("max").replace(0, 1)
    affinity["projectAffinityNorm"] = affinity["projectAffinity"] / per_user_max
    return affinity[["userId", "projectId", "projectAffinityNorm"]]


def build_user_tag_affinity(history: pd.DataFrame) -> dict[str, dict[str, float]]:
    rows: list[dict[str, object]] = []
    for row in history[["userId", "tagsKey", "totalEventWeight"]].itertuples(index=False):
        raw_tags = row.tagsKey
        if not isinstance(raw_tags, list) or not raw_tags:
            continue
        tags = raw_tags
        per_tag = row.totalEventWeight / len(tags)
        for tag in tags:
            rows.append({"userId": row.userId, "tag": tag, "weight": per_tag})

    if not rows:
        return {}

    affinity = pd.DataFrame(rows).groupby(["userId", "tag"], as_index=False)["weight"].sum()
    return {
        str(user_id): dict(zip(df["tag"], df["weight"]))
        for user_id, df in affinity.groupby("userId")
    }


def build_cf_scores(history: pd.DataFrame) -> pd.DataFrame:
    interactions = (
        history.groupby(["userId", "collaborationId"], as_index=False)["totalEventWeight"]
        .sum()
    )
    matrix = interactions.pivot(
        index="userId",
        columns="collaborationId",
        values="totalEventWeight",
    ).fillna(0.0)

    user_ids = matrix.index.tolist()
    item_ids = matrix.columns.tolist()
    if not user_ids or not item_ids:
        return pd.DataFrame(columns=["userId", "collaborationId", "cfScoreRaw", "cfScoreNorm"])

    x = matrix.to_numpy(dtype=float)
    item_matrix = x.T
    norms = np.linalg.norm(item_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    sim = (item_matrix / norms) @ (item_matrix / norms).T
    np.fill_diagonal(sim, 0.0)
    sim_df = pd.DataFrame(sim, index=item_ids, columns=item_ids)

    rows: list[dict[str, object]] = []
    for user_id, series in matrix.iterrows():
        seen = series[series > 0]
        if seen.empty:
            continue
        seen_vector = seen.to_numpy(dtype=float)
        scores = sim_df[seen.index].mul(seen_vector, axis=1).sum(axis=1)
        for collab_id, score in scores.items():
            rows.append(
                {
                    "userId": user_id,
                    "collaborationId": collab_id,
                    "cfScoreRaw": float(score),
                }
            )

    cf = pd.DataFrame(rows)
    if cf.empty:
        return pd.DataFrame(columns=["userId", "collaborationId", "cfScoreRaw", "cfScoreNorm"])

    per_user_max = cf.groupby("userId")["cfScoreRaw"].transform("max").replace(0, 1)
    cf["cfScoreNorm"] = cf["cfScoreRaw"] / per_user_max
    return cf
