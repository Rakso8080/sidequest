from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import UploadedFile


def save_upload(
    db: Session, data: bytes, filename: str, content_type: str
) -> str:
    """Persist an uploaded file and return its public URL.

    Files are stored in the database so they survive restarts on hosts with
    no persistent disk (e.g. free-tier web apps like Render).
    """
    uf = UploadedFile(
        filename=filename or "upload",
        content_type=content_type or "application/octet-stream",
        size=len(data),
        data=data,
    )
    db.add(uf)
    db.flush()
    return f"/uploads/{uf.id}"
