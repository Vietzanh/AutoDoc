"""
Document routes — upload, list, get, delete.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlmodel import Session

from src.models.database import get_session
from src.models.database_models import User
from src.models.schemas import DocumentRead, DocumentListResponse, PageThumbnailsResponse
from src.services.document_service import DocumentService
from src.core.security import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF file."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported",
        )
    service = DocumentService(session)
    doc = service.upload(current_user.id, file.file, file.filename)
    return doc


@router.get("", response_model=DocumentListResponse)
def list_documents(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all documents for the current user (most recent first)."""
    service = DocumentService(session)
    docs, total = service.list(current_user.id, offset=offset, limit=limit)
    return DocumentListResponse(documents=[DocumentRead.model_validate(d) for d in docs], total=total)


@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a single document by ID."""
    service = DocumentService(session)
    doc = service.get(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/{doc_id}/thumbnails", response_model=PageThumbnailsResponse)
def get_document_thumbnails(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get page thumbnails for a document (for the Split tool UI)."""
    service = DocumentService(session)
    doc = service.get(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    thumbs = service.get_thumbnails(doc)
    return PageThumbnailsResponse(thumbnails=thumbs)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a document and its file from disk."""
    service = DocumentService(session)
    ok = service.delete(doc_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Download the original PDF file."""
    service = DocumentService(session)
    doc = service.get(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    from pathlib import Path
    path = Path(doc.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=doc.original_filename,
    )
