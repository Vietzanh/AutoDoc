"""
Document service — upload, list, delete.
"""

import uuid
import json
from typing import BinaryIO
from pathlib import Path

import pymupdf

from src.core.config import get_settings
from src.models.database_models import Document
from src.models.schemas import DocumentRead
from src.repositories.document_repository import DocumentRepository


class DocumentService:
    def __init__(self, session):
        self.session = session
        self.repo = DocumentRepository(session)
        self.settings = get_settings()

    def upload(
        self,
        user_id: int,
        file: BinaryIO,
        filename: str,
    ) -> Document:
        """Save uploaded file to disk and create DB record."""
        stored_name = f"{uuid.uuid4().hex}.pdf"
        file_path = self.settings.UPLOAD_DIR / str(user_id) / stored_name
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write bytes to disk
        content = file.read()
        file_path.write_bytes(content)

        # Count pages
        page_count = None
        try:
            doc = pymupdf.open(file_path)
            page_count = len(doc)
            doc.close()
        except Exception:
            pass

        doc = self.repo.create(
            user_id=user_id,
            original_filename=filename,
            stored_filename=stored_name,
            file_path=str(file_path),
            file_size=len(content),
            file_type="pdf",
            page_count=page_count,
        )
        return doc

    def list(self, user_id: int, offset: int = 0, limit: int = 20) -> tuple[list[Document], int]:
        return self.repo.get_by_user(user_id, offset=offset, limit=limit)

    def get(self, doc_id: int) -> Document | None:
        return self.repo.get(doc_id)

    def delete(self, doc_id: int, user_id: int) -> bool:
        doc = self.repo.get(doc_id)
        if not doc or doc.user_id != user_id:
            return False
        return self.repo.delete(doc_id)

    def get_output_path(self, job_id: int, filename: str) -> Path:
        out_dir = self.settings.OUTPUT_DIR / str(job_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        return out_dir / filename
