from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadedFile

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.get("/{upload_id}")
def serve_upload(upload_id: int, db: Session = Depends(get_db)):
    uf = db.get(UploadedFile, upload_id)
    if uf is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=uf.data,
        media_type=uf.content_type,
        headers={"Cache-Control": "public, max-age=31536000"},
    )
