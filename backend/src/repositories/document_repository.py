"""
Data access layer for documents.
"""

from typing import Optional
from pathlib import Path

from sqlmodel import Session, select, func

from src.models.database_models import Document
from src.core.config import get_settings


class DocumentRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.session.add(doc)
        self.session.commit()
        self.session.refresh(doc)
        return doc

    def get(self, doc_id: int) -> Optional[Document]:
        return self.session.get(Document, doc_id)

    def get_by_user(self, user_id: int, offset: int = 0, limit: int = 20) -> tuple[list[Document], int]:
        query = select(Document).where(Document.user_id == user_id).order_by(Document.created_at.asc())
        count_query = select(func.count()).select_from(Document).where(Document.user_id == user_id)

        total = self.session.exec(count_query).one()
        results = self.session.exec(query.offset(offset).limit(limit)).all()
        return list(results), total

    def delete(self, doc_id: int) -> bool:
        doc = self.session.get(Document, doc_id)
        if not doc:
            return False
        # Remove file from disk
        p = Path(doc.file_path)
        if p.exists():
            p.unlink()
        self.session.delete(doc)
        self.session.commit()
        return True
