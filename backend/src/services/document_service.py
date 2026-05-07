"""
Document service — upload, list, delete.
"""

import uuid
import json
from typing import BinaryIO
from typing import List
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

    def get_thumbnails(self, doc: Document, *, thumb_width: int = 200) -> List[dict]:
        """
        Render each page of the PDF as a base64-encoded PNG thumbnail.

        Returns
        -------
        list[dict]
            [{page_number: 1, image_base64: "<data:...>"}, ...]
        """
        import base64
        import io

        pdf_path = Path(doc.file_path)
        if not pdf_path.exists():
            return []

        thumbnails = []
        with pymupdf.open(str(pdf_path)) as pdf:
            for page_num, page in enumerate(pdf, start=1):
                # Calculate zoom to get thumb_width at 72 DPI (screen scale)
                zoom = thumb_width / page.rect.width
                mat = pymupdf.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                buf = io.BytesIO(pix.tobytes("png"))
                b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                thumbnails.append({
                    "page_number": page_num,
                    "image_base64": f"data:image/png;base64,{b64}",
                    "width_pts": round(page.rect.width, 2),
                    "height_pts": round(page.rect.height, 2),
                })
        return thumbnails

    def get_output_path(self, job_id: int, filename: str) -> Path:
        out_dir = self.settings.OUTPUT_DIR / str(job_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        return out_dir / filename
