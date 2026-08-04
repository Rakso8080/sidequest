from __future__ import annotations

from typing import Any, Dict

from ..models import Squad

DEFAULT_SETTINGS: Dict[str, Any] = {
    "voting_rule": "majority",  # majority | unanimous | quorum
    "quorum_pct": 60,
    "voting_hours": 24,
    "anonymous_votes": False,
    "punishment_due_days": 7,
    "categories": [
        "Fitness",
        "Social",
        "Creativity",
        "Adventure",
        "Mind/Skill",
        "Kindness",
        "Wildcard",
    ],
    "punishments": [
        "Buy the group coffee",
        "Post an embarrassing photo",
        "Do 20 pushups on camera",
        "Cook dinner for the squad",
        "Sing a song on a voice note",
        "Run a 5k",
        "Let the group pick your outfit for a day",
    ],
}

VALID_RULES = ("majority", "unanimous", "quorum")
VALID_DIFFICULTIES = ("easy", "medium", "hard")
VALID_PROOF_TYPES = ("photo", "video", "text", "self_report")


def get_settings(squad: Squad) -> Dict[str, Any]:
    merged = dict(DEFAULT_SETTINGS)
    merged.update(squad.settings or {})
    return merged


def sanitize_settings(values: Dict[str, Any]) -> Dict[str, Any]:
    """Validate incoming settings updates and merge with defaults."""
    clean: Dict[str, Any] = {}
    current = dict(DEFAULT_SETTINGS)
    current.update(values or {})

    rule = current.get("voting_rule")
    if rule in VALID_RULES:
        clean["voting_rule"] = rule
    qpct = current.get("quorum_pct")
    if isinstance(qpct, (int, float)) and 0 < qpct <= 100:
        clean["quorum_pct"] = int(qpct)
    hours = current.get("voting_hours")
    if isinstance(hours, (int, float)) and 1 <= hours <= 24 * 7:
        clean["voting_hours"] = int(hours)
    clean["anonymous_votes"] = bool(current.get("anonymous_votes", False))
    days = current.get("punishment_due_days")
    if isinstance(days, (int, float)) and 1 <= days <= 60:
        clean["punishment_due_days"] = int(days)

    cats = current.get("categories")
    if isinstance(cats, list):
        seen: list = []
        for c in cats:
            c = str(c).strip()
            if c and c not in seen:
                seen.append(c)
        if seen:
            clean["categories"] = seen

    puns = current.get("punishments")
    if isinstance(puns, list):
        cleaned = [str(p).strip() for p in puns if str(p).strip()]
        if cleaned:
            clean["punishments"] = cleaned

    return clean
