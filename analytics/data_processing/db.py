"""Connections for the analytics role.

PostgreSQL: SELECT on the product tables, write access only to
patient_daily_metrics and analytics_runs (granted by the backend migrator).
MongoDB: read-only. Neither connection can see users or refresh tokens, and
nothing here holds the data encryption key, so encrypted fields stay opaque.
"""

from __future__ import annotations

import os
from urllib.parse import quote_plus

import psycopg
from pymongo import MongoClient
from pymongo.database import Database


def _required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value or value.startswith("CHANGE_ME"):
        raise RuntimeError(f"{name} must be set")
    return value


def postgres() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        dbname=os.environ.get("POSTGRES_DB", "mmry"),
        user=_required("POSTGRES_ANALYTICS_USER"),
        password=_required("POSTGRES_ANALYTICS_PASSWORD"),
        application_name="mmry-analytics",
        connect_timeout=10,
    )


def mongo() -> tuple[MongoClient, Database]:
    db_name = os.environ.get("MONGO_DB", "mmry")
    uri = (
        f"mongodb://{quote_plus(_required('MONGO_ANALYTICS_USER'))}:{quote_plus(_required('MONGO_ANALYTICS_PASSWORD'))}"
        f"@{os.environ.get('MONGO_HOST', '127.0.0.1')}:{os.environ.get('MONGO_PORT', '27017')}/{db_name}?authSource={db_name}"
    )
    client: MongoClient = MongoClient(uri, appname="mmry-analytics", serverSelectionTimeoutMS=10_000)
    return client, client[db_name]
