from __future__ import annotations

import argparse
from pathlib import Path

from .config import HybridWeights, WarmFallbackWeights
from .extract import load_collaborations, load_interaction_events, load_users
from .features import (
    build_active_catalog,
    build_cf_scores,
    build_collaboration_history,
    build_completed_catalog,
    build_popularity_features,
    build_user_summary,
    build_user_project_affinity,
    build_user_tag_affinity,
)
from .score import score_candidates
from .writeback import write_recommendations_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the hybrid recommendation pipeline.")
    parser.add_argument(
        "--events",
        default="data/synthetic/interaction_events.csv",
        help="Path to interaction events CSV, relative to recommendation-system/ by default.",
    )
    parser.add_argument(
        "--collaborations",
        default="data/synthetic/collaborations.csv",
        help="Path to collaborations CSV, relative to recommendation-system/ by default.",
    )
    parser.add_argument(
        "--users",
        default="data/synthetic/users.csv",
        help="Path to users CSV, relative to recommendation-system/ by default.",
    )
    parser.add_argument(
        "--output",
        default="data/pipeline_v1/recommendations.csv",
        help="Where to write flattened recommendations CSV.",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Number of recommendations to keep per user.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    events_path = root / args.events
    collabs_path = root / args.collaborations
    users_path = root / args.users
    output_path = root / args.output

    events = load_interaction_events(events_path)
    collaborations = load_collaborations(collabs_path)
    users = load_users(users_path)

    history = build_collaboration_history(events, collaborations)
    user_summary = build_user_summary(users, events)
    active_catalog = build_active_catalog(collaborations)
    completed_catalog = build_completed_catalog(collaborations)
    popularity = build_popularity_features(history)
    project_affinity = build_user_project_affinity(history)
    tag_affinity = build_user_tag_affinity(history)
    cf_scores = build_cf_scores(history)

    recommendations = score_candidates(
        history=history,
        active_catalog=active_catalog,
        completed_catalog=completed_catalog,
        popularity=popularity,
        project_affinity=project_affinity,
        tag_affinity=tag_affinity,
        cf_scores=cf_scores,
        user_summary=user_summary,
        weights=HybridWeights(),
        warm_weights=WarmFallbackWeights(),
        top_n=args.top_n,
    )

    write_recommendations_csv(recommendations, output_path)

    print(f"events: {len(events)}")
    print(f"history rows: {len(history)}")
    print(f"users in scope: {len(user_summary)}")
    print(f"active catalog rows: {len(active_catalog)}")
    print(f"completed catalog rows: {len(completed_catalog)}")
    print(f"users scored: {recommendations['userId'].nunique()}")
    print("strategy distribution:")
    print(user_summary["strategyUsed"].value_counts().sort_index().to_string())
    print(f"rows written: {len(recommendations)}")
    print(f"output: {output_path}")


if __name__ == "__main__":
    main()
