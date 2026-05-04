from __future__ import annotations

import pandas as pd

from .config import (
    FALLBACK_POPULARITY_STRATEGY,
    FALLBACK_WARM_STRATEGY,
    HYBRID_V1_STRATEGY,
    HybridWeights,
    WarmFallbackWeights,
    SEEN_PENALTY,
)


ACTIVE_CATALOG_TIER = "active"
COMPLETED_CATALOG_TIER = "completed_fallback"

OUTPUT_COLUMNS = [
    "userId",
    "rank",
    "projectId",
    "collaborationId",
    "name",
    "status",
    "tagsKey",
    "positiveEventCount",
    "strategyUsed",
    "catalogTier",
    "isBackfill",
    "tagScoreNorm",
    "projectAffinityNorm",
    "popularityScoreNorm",
    "heuristicScore",
    "cfScoreNorm",
    "cfScore",
    "finalScore",
]


def _empty_recommendations() -> pd.DataFrame:
    return pd.DataFrame(columns=OUTPUT_COLUMNS)


def _build_candidate_frame(
    history: pd.DataFrame,
    catalog: pd.DataFrame,
    popularity: pd.DataFrame,
    project_affinity: pd.DataFrame,
    tag_affinity: dict[str, dict[str, float]],
    cf_scores: pd.DataFrame,
    user_summary: pd.DataFrame,
    weights: HybridWeights,
    warm_weights: WarmFallbackWeights,
    catalog_tier: str,
    is_backfill: bool,
) -> pd.DataFrame:
    if user_summary.empty or catalog.empty:
        return pd.DataFrame()

    seen = history[["userId", "collaborationId"]].drop_duplicates().assign(seen=1)
    candidates = (
        user_summary.assign(_k=1)
        .merge(catalog.assign(_k=1), on="_k")
        .drop(columns="_k")
    )
    candidates = candidates.merge(seen, on=["userId", "collaborationId"], how="left")
    candidates["seenPenalty"] = candidates["seen"].notna().map({True: SEEN_PENALTY, False: 1.0})
    candidates = candidates.drop(columns="seen", errors="ignore")
    if candidates.empty:
        return candidates

    candidates = candidates.merge(
        popularity,
        on=["collaborationId", "projectId"],
        how="left",
    )
    candidates["popularityScoreNorm"] = candidates["popularityScoreNorm"].fillna(0.0)

    candidates = candidates.merge(
        project_affinity,
        on=["userId", "projectId"],
        how="left",
    )
    candidates["projectAffinityNorm"] = candidates["projectAffinityNorm"].fillna(0.0)

    def tag_score(user_id: str, tags: list[str]) -> float:
        pref = tag_affinity.get(user_id, {})
        if not tags:
            return 0.0
        return sum(pref.get(tag, 0.0) for tag in tags) / len(tags)

    candidates["tagScoreRaw"] = [
        tag_score(user_id, tags)
        for user_id, tags in zip(candidates["userId"], candidates["tagsKey"])
    ]
    tag_max = candidates.groupby("userId")["tagScoreRaw"].transform("max").replace(0, 1)
    candidates["tagScoreNorm"] = candidates["tagScoreRaw"] / tag_max

    candidates["heuristicScore"] = (
        weights.tag_weight * candidates["tagScoreNorm"]
        + weights.project_weight * candidates["projectAffinityNorm"]
        + weights.popularity_weight * candidates["popularityScoreNorm"]
    )
    candidates["warmScore"] = (
        warm_weights.tag_weight * candidates["tagScoreNorm"]
        + warm_weights.project_weight * candidates["projectAffinityNorm"]
        + warm_weights.popularity_weight * candidates["popularityScoreNorm"]
    )

    cf = cf_scores[["userId", "collaborationId", "cfScoreRaw", "cfScoreNorm"]].copy()
    cf = cf.merge(
        popularity[["collaborationId", "popularityScoreNorm"]].rename(
            columns={"popularityScoreNorm": "cfPopularityNorm"}
        ),
        on="collaborationId",
        how="left",
    )
    cf["cfPopularityNorm"] = cf["cfPopularityNorm"].fillna(0.0)
    cf["cfScore"] = (
        weights.cf_signal_weight * cf["cfScoreNorm"]
        + weights.cf_popularity_weight * cf["cfPopularityNorm"]
    )

    candidates = candidates.merge(
        cf[["userId", "collaborationId", "cfScoreNorm", "cfScore"]],
        on=["userId", "collaborationId"],
        how="left",
    )
    candidates["cfScoreNorm"] = pd.to_numeric(candidates["cfScoreNorm"], errors="coerce").fillna(0.0)
    candidates["cfScore"] = pd.to_numeric(candidates["cfScore"], errors="coerce").fillna(0.0)

    candidates["hybridScore"] = (
        weights.heuristic_mix * candidates["heuristicScore"]
        + weights.cf_mix * candidates["cfScore"]
    )

    candidates["finalScore"] = candidates["hybridScore"]
    candidates.loc[
        candidates["strategyUsed"] == FALLBACK_POPULARITY_STRATEGY,
        "finalScore",
    ] = candidates["popularityScoreNorm"]
    candidates.loc[
        candidates["strategyUsed"] == FALLBACK_WARM_STRATEGY,
        "finalScore",
    ] = candidates["warmScore"]
    candidates.loc[
        candidates["strategyUsed"] == HYBRID_V1_STRATEGY,
        "finalScore",
    ] = candidates["hybridScore"]

    candidates["finalScore"] = candidates["finalScore"] * candidates["seenPenalty"]

    candidates["catalogTier"] = catalog_tier
    candidates["isBackfill"] = is_backfill
    return candidates


def _rank_catalog(candidates: pd.DataFrame, top_n: int) -> pd.DataFrame:
    if candidates.empty:
        return candidates.copy()

    return (
        candidates.sort_values(
            ["userId", "finalScore", "popularityScoreNorm", "collaborationId"],
            ascending=[True, False, False, True],
        )
        .groupby("userId")
        .head(top_n)
        .copy()
    )


def score_candidates(
    history: pd.DataFrame,
    active_catalog: pd.DataFrame,
    completed_catalog: pd.DataFrame,
    popularity: pd.DataFrame,
    project_affinity: pd.DataFrame,
    tag_affinity: dict[str, dict[str, float]],
    cf_scores: pd.DataFrame,
    user_summary: pd.DataFrame,
    weights: HybridWeights,
    warm_weights: WarmFallbackWeights | None = None,
    top_n: int = 10,
) -> pd.DataFrame:
    warm_weights = warm_weights or WarmFallbackWeights()
    if top_n <= 0:
        return _empty_recommendations()

    active_candidates = _build_candidate_frame(
        history=history,
        catalog=active_catalog,
        popularity=popularity,
        project_affinity=project_affinity,
        tag_affinity=tag_affinity,
        cf_scores=cf_scores,
        user_summary=user_summary,
        weights=weights,
        warm_weights=warm_weights,
        catalog_tier=ACTIVE_CATALOG_TIER,
        is_backfill=False,
    )
    completed_candidates = _build_candidate_frame(
        history=history,
        catalog=completed_catalog,
        popularity=popularity,
        project_affinity=project_affinity,
        tag_affinity=tag_affinity,
        cf_scores=cf_scores,
        user_summary=user_summary,
        weights=weights,
        warm_weights=warm_weights,
        catalog_tier=COMPLETED_CATALOG_TIER,
        is_backfill=True,
    )

    ranked_active = _rank_catalog(active_candidates, top_n=top_n)
    ranked_completed = _rank_catalog(completed_candidates, top_n=top_n)
    recommendations = pd.concat([ranked_active, ranked_completed], ignore_index=True, sort=False)
    if recommendations.empty:
        return _empty_recommendations()

    recommendations["catalogPriority"] = recommendations["catalogTier"].map(
        {
            ACTIVE_CATALOG_TIER: 0,
            COMPLETED_CATALOG_TIER: 1,
        }
    ).fillna(99)

    recommendations = (
        recommendations.sort_values(
            [
                "userId",
                "catalogPriority",
                "finalScore",
                "popularityScoreNorm",
                "collaborationId",
            ],
            ascending=[True, True, False, False, True],
        )
        .groupby("userId")
        .head(top_n)
        .copy()
    )
    recommendations["rank"] = recommendations.groupby("userId").cumcount() + 1

    return recommendations[OUTPUT_COLUMNS]
