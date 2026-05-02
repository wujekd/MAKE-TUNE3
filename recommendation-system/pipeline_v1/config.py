from dataclasses import dataclass


@dataclass(frozen=True)
class HybridWeights:
    heuristic_mix: float = 0.65
    cf_mix: float = 0.35
    tag_weight: float = 0.60
    project_weight: float = 0.10
    popularity_weight: float = 0.30
    cf_signal_weight: float = 0.70
    cf_popularity_weight: float = 0.30


@dataclass(frozen=True)
class WarmFallbackWeights:
    tag_weight: float = 0.70
    project_weight: float = 0.20
    popularity_weight: float = 0.10


EVENT_WEIGHTS = {
    "submission_like": 1.0,
    "submission_favorite": 2.0,
    "submission_vote": 3.0,
    "collaboration_like": 0.75,
    "collaboration_favorite": 1.75,
}


POSITIVE_EVENT_TYPES = tuple(EVENT_WEIGHTS.keys())
ACTIVE_STATUSES = ("submission", "voting")
COMPLETED_STATUSES = ("completed",)

FALLBACK_POPULARITY_STRATEGY = "fallback_popularity"
FALLBACK_WARM_STRATEGY = "fallback_warm"
HYBRID_V1_STRATEGY = "hybrid_v1"
