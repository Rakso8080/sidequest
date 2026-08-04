from __future__ import annotations

from typing import List

import httpx
from fastapi import HTTPException

from ..config import GIPHY_API_KEY
from ..schemas import GifOut

GIPHY_BASE = "https://api.giphy.com/v1/gifs"


def fetch_gifs(q: str, limit: int = 24) -> List[GifOut]:
    if not GIPHY_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GIF search is not configured (add GIPHY_API_KEY to the server env)",
        )
    params = {
        "api_key": GIPHY_API_KEY,
        "limit": limit,
        "rating": "g",
        "lang": "en",
    }
    if q.strip():
        params["q"] = q.strip()
        url = f"{GIPHY_BASE}/search"
    else:
        url = f"{GIPHY_BASE}/trending"
    try:
        with httpx.Client(timeout=8) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json().get("data", [])
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Giphy is unreachable right now")

    out: List[GifOut] = []
    for g in data:
        images = g.get("images", {})
        down = images.get("downsized") or {}
        fixed = images.get("fixed_width_small") or {}
        url = down.get("url") or fixed.get("url")
        thumb = fixed.get("url") or url
        if not url:
            continue
        out.append(
            GifOut(
                url=url,
                thumb=thumb,
                width=fixed.get("width") or 0,
                height=fixed.get("height") or 0,
            )
        )
    return out
