from __future__ import annotations

from ast import literal_eval
from pathlib import Path

import pandas as pd

from .config import POSITIVE_EVENT_TYPES


def _parse_list_cell(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    try:
        parsed = literal_eval(text)
    except (SyntaxError, ValueError):
        return []
    if isinstance(parsed, list):
        return [str(item) for item in parsed]
    return []


def prepare_interaction_events(events: pd.DataFrame) -> pd.DataFrame:
    events = events.copy()
    for column in ("userId", "projectId", "collaborationId", "eventType", "createdAt", "tags"):
        if column not in events.columns:
            if column == "tags":
                events[column] = pd.Series([[] for _ in range(len(events))], dtype="object")
            else:
                events[column] = pd.Series(dtype="object")
    events = events[events["eventType"].isin(POSITIVE_EVENT_TYPES)].copy()
    events["createdAt"] = pd.to_datetime(events["createdAt"], utc=True)
    events["tags"] = events["tags"].apply(_parse_list_cell)
    return events


def load_interaction_events(path: str | Path) -> pd.DataFrame:
    events = pd.read_csv(path)
    return prepare_interaction_events(events)


def prepare_users(users: pd.DataFrame) -> pd.DataFrame:
    users = users.copy()
    if "userId" not in users.columns:
        if "id" not in users.columns:
            raise KeyError("users input must include either 'userId' or 'id'")
        users = users.rename(columns={"id": "userId"})
    users = users[["userId"]].dropna().copy()
    users["userId"] = users["userId"].astype(str)
    return users.drop_duplicates().reset_index(drop=True)


def load_users(path: str | Path) -> pd.DataFrame:
    users = pd.read_csv(path)
    return prepare_users(users)


def prepare_collaborations(collabs: pd.DataFrame) -> pd.DataFrame:
    collabs = collabs.copy()
    for column in ("id", "projectId", "name", "status", "tags", "tagsKey", "publishedAt"):
        if column not in collabs.columns:
            if column in {"tags", "tagsKey"}:
                collabs[column] = pd.Series([[] for _ in range(len(collabs))], dtype="object")
            else:
                collabs[column] = pd.Series(dtype="object")
    collabs["tags"] = collabs["tags"].apply(_parse_list_cell)
    collabs["tagsKey"] = collabs["tagsKey"].apply(_parse_list_cell)
    return collabs.rename(columns={"id": "collaborationId"})


def load_collaborations(path: str | Path) -> pd.DataFrame:
    collabs = pd.read_csv(path).copy()
    return prepare_collaborations(collabs)
