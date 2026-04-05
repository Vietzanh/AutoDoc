"""
Job routes — create, poll status, list, delete, download result.
"""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlmodel import Session

from src.models.database import get_session
from src.models.database_models import User, JobStatus
from src.models.schemas import (
    JobRead, JobListResponse,
    ReconstructRequest, CombineRequest,
    SplitRequest, SplitPartsResponse,
    OrganizeRequest, ExtractRequest,
)
from src.services.job_service import JobService
from src.services.document_service import DocumentService
from src.core.security import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _job_to_read(job) -> JobRead:
    return JobRead.model_validate(job)


def _check_ownership(job, user_id: int):
    if job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your job")


# ── Reconstruct ───────────────────────────────────────────────────────────────

@router.post("/reconstruct", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_reconstruct_job(
    request: ReconstructRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Start a PDF → DOCX reconstruction job.

    Upload the PDF first via POST /api/documents, then pass the returned
    document_id here. The job runs asynchronously; poll GET /api/jobs/{job_id}
    for status.
    """
    # Accept document_id in request body
    doc_id = request.document_id
    doc_service = DocumentService(session)
    doc = doc_service.get(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    service = JobService(session)
    job = service.create_reconstruct_job(
        user_id=current_user.id,
        document_id=doc_id,
        max_image_width=request.max_image_width,
        render_dpi=request.render_dpi,
    )
    return _job_to_read(job)


# ── Combine ───────────────────────────────────────────────────────────────────

@router.post("/combine", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_combine_job(
    request: CombineRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Start a combine PDFs job. Pass ordered list of document IDs."""
    doc_service = DocumentService(session)
    for doc_id in request.document_ids:
        doc = doc_service.get(doc_id)
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {doc_id} not found or not owned by you",
            )

    service = JobService(session)
    job = service.create_combine_job(
        user_id=current_user.id,
        document_ids=request.document_ids,
        output_filename=request.output_filename,
    )
    return _job_to_read(job)


# ── Split ───────────────────────────────────────────────────────────────────

@router.post("/split", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_split_job(
    request: SplitRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Start a split PDF job. Each split point marks the last page of that part."""
    doc_service = DocumentService(session)
    doc = doc_service.get(request.document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    service = JobService(session)
    job = service.create_split_job(
        user_id=current_user.id,
        document_id=request.document_id,
        split_points=request.split_points,
        output_filename=request.output_filename,
    )
    return _job_to_read(job)


@router.get("/{job_id}/parts", response_model=SplitPartsResponse)
def get_split_parts(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return the list of split parts after a split job completes."""
    service = JobService(session)
    job = service.get(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _check_ownership(job, current_user.id)

    if job.tool != "split":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a split job")

    if job.status != JobStatus.DONE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job not done yet")

    import json
    try:
        parts = json.loads(job.output_filename or "[]")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Corrupted parts data")

    return SplitPartsResponse(parts=parts)


# ── Organize ───────────────────────────────────────────────────────────────────

@router.post("/organize", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_organize_job(
    request: OrganizeRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Organize a PDF: delete, rotate, and/or reorder pages."""
    doc_service = DocumentService(session)
    doc = doc_service.get(request.document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not request.pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pages provided")

    service = JobService(session)
    job = service.create_organize_job(
        user_id=current_user.id,
        document_id=request.document_id,
        pages=[p.model_dump() for p in request.pages],
        output_filename=request.output_filename,
    )
    return _job_to_read(job)


# ── Extract ─────────────────────────────────────────────────────────────────────

@router.post("/extract", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_extract_job(
    request: ExtractRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Extract selected pages from a PDF as a separate file."""
    doc_service = DocumentService(session)
    doc = doc_service.get(request.document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not request.pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pages provided")

    service = JobService(session)
    job = service.create_extract_job(
        user_id=current_user.id,
        document_id=request.document_id,
        pages=[p.model_dump() for p in request.pages],
        output_filename=request.output_filename,
    )
    return _job_to_read(job)


# ── Poll / list / delete ─────────────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobRead)
def get_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Poll job status. Returns the job with current progress."""
    service = JobService(session)
    job = service.get(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _check_ownership(job, current_user.id)
    return _job_to_read(job)


@router.get("", response_model=JobListResponse)
def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all jobs for the current user."""
    service = JobService(session)
    jobs, total = service.list(current_user.id, status=status_filter)
    return JobListResponse(jobs=[_job_to_read(j) for j in jobs], total=total)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a job record and its output file."""
    service = JobService(session)
    job = service.get(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _check_ownership(job, current_user.id)

    # Remove output file(s)
    if job.output_path:
        p = Path(job.output_path)
        if p.is_dir():
            import shutil
            shutil.rmtree(p, ignore_errors=True)
        elif p.exists():
            p.unlink(missing_ok=True)

    from src.repositories.job_repository import JobRepository
    JobRepository(session).delete(job_id)


@router.get("/{job_id}/download")
def download_job_result(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Download the output file (or ZIP of split parts) produced by a completed job."""
    import io, zipfile

    service = JobService(session)
    job = service.get(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _check_ownership(job, current_user.id)

    if job.status != JobStatus.DONE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job not done yet — current status: {job.status}",
        )
    if not job.output_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output file not found")

    path = Path(job.output_path)

    # Split jobs: output_path is a directory of PDF parts — zip them up
    if job.tool == "split":
        if not path.is_dir():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Split output directory not found")
        # Use source doc name as zip name, falling back to job id
        zip_name = f"split_parts_{job_id}.zip"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for pdf_file in sorted(path.glob("*.pdf")):
                zf.write(pdf_file, pdf_file.name)
        buffer.seek(0)
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
        )

    # Non-split jobs: single output file
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output file missing from disk")

    mime = "application/pdf" if job.output_filename.endswith(".pdf") else \
           "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(
        path,
        media_type=mime,
        filename=job.output_filename,
    )
