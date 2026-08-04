from __future__ import annotations

"""Lightweight idempotent migrations.

`Base.metadata.create_all` only creates missing *tables*; it never alters
existing ones. The live Postgres DB has tables from earlier deploys, so any
new column needs an explicit ALTER TABLE. This runs once at startup and is
safe to re-run (IF NOT EXISTS / column-exists checks on both SQLite+PG).
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)


def _columns(engine: Engine, table: str) -> set:
    insp = inspect(engine)
    try:
        cols = insp.get_columns(table)
        return {c["name"] for c in cols}
    except Exception:
        return set()


_COLUMNS = {
    "users": {
        "status_text": "VARCHAR(120)",
        "status_emoji": "VARCHAR(8)",
        "pronouns": "VARCHAR(40)",
        "banner_color": "VARCHAR(9)",
        "last_seen": "TIMESTAMP",
        "last_read_id": "INTEGER DEFAULT 0",
        "streak_shields": "INTEGER DEFAULT 0",
    },
    "chat_messages": {
        "reply_to_id": "INTEGER",
        "gif_url": "VARCHAR(500)",
        "gif_thumb": "VARCHAR(500)",
        "edited": "BOOLEAN DEFAULT false",
        "pinned": "BOOLEAN DEFAULT false",
    },
    "quests": {
        "squad_quest": "BOOLEAN DEFAULT false",
    },
}

_TABLES = {
    "chat_reactions": """
        CREATE TABLE IF NOT EXISTS chat_reactions (
            id INTEGER PRIMARY KEY,
            message_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji VARCHAR(16) NOT NULL,
            created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP)
        )
    """,
}


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        for table, ddl in _TABLES.items():
            conn.execute(text(ddl))
        for table, cols in _COLUMNS.items():
            existing = _columns(engine, table)
            if not existing:
                continue
            for name, ddl in cols.items():
                if name in existing:
                    continue
                try:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
                    )
                    log.info("Migrated: %s.%s", table, name)
                except Exception as exc:  # pragma: no cover - defensive
                    log.warning("Migration %s.%s failed: %s", table, name, exc)
