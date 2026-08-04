from __future__ import annotations

"""XP / level system. Level is derived from total points via a soft curve."""

import math

LEVELS = [
    (0, "Rookie", "🐣"),
    (50, "Go-Getter", "🐥"),
    (150, "Challenger", "⚡"),
    (300, "Rising Star", "🌟"),
    (500, "Quest Addict", "🎯"),
    (800, "Squad Legend", "🔥"),
    (1200, "Fearless", "🦁"),
    (1800, "Unstoppable", "🚀"),
    (2500, "SideQuest King", "👑"),
    (4000, "Mythic", "💎"),
]


def level_for(points: int) -> int:
    for i, (threshold, *_rest) in enumerate(LEVELS):
        if points < threshold:
            return max(1, i)
    return len(LEVELS)


def title_for(points: int) -> str:
    level = level_for(points)
    return LEVELS[level - 1][1]


def icon_for(points: int) -> str:
    level = level_for(points)
    return LEVELS[level - 1][2]


def progress_for(points: int) -> dict:
    """Progress toward the next level as a fraction."""
    level = level_for(points)
    lo, hi = LEVELS[level - 1][0], LEVELS[min(level, len(LEVELS) - 1)][0]
    span = hi - lo
    if span <= 0:
        return {"fraction": 1.0, "into": 0, "span": 0, "level": level}
    return {
        "fraction": min(1.0, (points - lo) / span),
        "into": points - lo,
        "span": span,
        "level": level,
    }
