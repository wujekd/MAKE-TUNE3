from __future__ import annotations

import argparse
import json
import os
import ssl
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, request

import certifi
import pandas as pd

from pipeline_v1.config import HybridWeights, WarmFallbackWeights
from pipeline_v1.extract import prepare_collaborations, prepare_interaction_events, prepare_users
from pipeline_v1.features import (
    build_active_catalog,
    build_cf_scores,
    build_collaboration_history,
    build_completed_catalog,
    build_popularity_features,
    build_user_summary,
    build_user_project_affinity,
    build_user_tag_affinity,
)
from pipeline_v1.score import score_candidates


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the recommendation job against backend endpoints.")
    parser.add_argument(
        "--env-file",
        default="recommender.env",
        help="Local env file with endpoint URLs and token.",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Number of recommendations per user.",
    )
    parser.add_argument(
        "--model-version",
        default="hybrid-v1",
        help="Model version written back to the backend.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run export + scoring without uploading results.",
    )
    return parser


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def http_json(method: str, url: str, headers: dict[str, str], payload: Any | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(url=url, method=method, headers=headers, data=data)
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with request.urlopen(req, context=ssl_context) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


def fetch_export(export_url: str, token: str) -> dict[str, Any]:
    try:
        payload = http_json("GET", export_url, auth_headers(token))
    except error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Export failed with {err.code}: {body}") from err
    return dict(payload or {})


def build_recommendations(export_payload: dict[str, Any], top_n: int) -> pd.DataFrame:
    raw_events = pd.DataFrame(export_payload.get("interactionEvents", []))
    events = prepare_interaction_events(raw_events)
    collaborations = prepare_collaborations(pd.DataFrame(export_payload.get("collaborations", [])))
    raw_users = export_payload.get("users")
    if raw_users:
        users = prepare_users(pd.DataFrame(raw_users))
    else:
        raw_user_ids = []
        if "userId" in raw_events.columns:
            raw_user_ids = sorted(raw_events["userId"].dropna().astype(str).unique())
        users = prepare_users(pd.DataFrame({"userId": raw_user_ids}))

    history = build_collaboration_history(events, collaborations)
    user_summary = build_user_summary(users, events)
    active_catalog = build_active_catalog(collaborations)
    completed_catalog = build_completed_catalog(collaborations)
    popularity = build_popularity_features(history)
    project_affinity = build_user_project_affinity(history)
    tag_affinity = build_user_tag_affinity(history)
    cf_scores = build_cf_scores(history)

    return score_candidates(
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
        top_n=top_n,
    )


def build_import_payload(recommendations: pd.DataFrame, model_version: str) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    rows = []
    for user_id, group in recommendations.groupby("userId"):
        group_rows = []
        for row in group.sort_values("rank").itertuples(index=False):
            group_rows.append({
                "rank": int(row.rank),
                "collaborationId": str(row.collaborationId),
                "projectId": str(row.projectId),
                "score": round(float(row.finalScore), 6),
                "highlightedTrackPath": None,
            })
        rows.append({
            "userId": str(user_id),
            "collaborations": group_rows,
        })

    return {
        "generatedAt": generated_at,
        "modelVersion": model_version,
        "recommendations": rows,
    }


def upload_import(import_url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = http_json("POST", import_url, auth_headers(token), payload=payload)
    except error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Import failed with {err.code}: {body}") from err
    return dict(response or {})


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    env_path = root / args.env_file
    load_env_file(env_path)

    token = require_env("RECOMMENDATION_API_TOKEN")
    export_url = require_env("RECOMMENDATION_EXPORT_URL")
    import_url = require_env("RECOMMENDATION_IMPORT_URL")

    export_payload = fetch_export(export_url, token)
    recommendations = build_recommendations(export_payload, top_n=args.top_n)
    import_payload = build_import_payload(recommendations, model_version=args.model_version)

    print(f"events: {len(export_payload.get('interactionEvents', []))}")
    print(f"collaborations: {len(export_payload.get('collaborations', []))}")
    print(f"users in export: {len(export_payload.get('users', []))}")
    print(f"active collaborations in export: {sum(1 for row in export_payload.get('collaborations', []) if row.get('status') in ('submission', 'voting'))}")
    print(f"completed collaborations in export: {sum(1 for row in export_payload.get('collaborations', []) if row.get('status') == 'completed')}")
    print(f"users scored: {recommendations['userId'].nunique()}")
    print(f"recommendation rows: {len(recommendations)}")

    if args.dry_run:
        print("dry-run: skipped import")
        return

    response = upload_import(import_url, token, import_payload)
    print(f"users written: {response.get('usersWritten', 0)}")
    print(f"model version: {response.get('modelVersion', '')}")


if __name__ == "__main__":
    main()
