"""
Job service — orchestrates async PDF processing tasks.

Processing runs in a background thread to avoid blocking the FastAPI event loop.
"""

import json
import uuid
import threading
from pathlib import Path
from typing import Optional

import pymupdf

from src.core.config import get_settings
from src.models.database_models import Job, JobStatus, JobTool, Document
from src.repositories.job_repository import JobRepository
from src.repositories.document_repository import DocumentRepository


# ── Shared pipeline import ────────────────────────────────────────────────────
# Import existing pipeline logic directly — no duplication needed.
# The project root contains the original `src/` with pipeline, extract_layout, etc.
# We need to add the project root (AutoDoc/) to sys.path so that
# `from src.pipeline import ...` resolves to AutoDoc/src/pipeline.py.
import sys
from pathlib import Path as P

_PROJECT_ROOT = P(__file__).resolve().parent.root  # backend/src/services/ → backend/src/ → backend/
_AUTO_PARENT  = _PROJECT_ROOT.parent               # backend/src/ → backend/ → AutoDoc/

def _add_project_root_to_path():
    if str(_AUTO_PARENT) not in sys.path:
        sys.path.insert(0, str(_AUTO_PARENT))

_add_project_root_to_path()

from src.pipeline import PDFToDocxPipeline
from src.extract_layout import extract_pdf_layout


class JobService:
    def __init__(self, session):
        self.session = session
        self.repo = JobRepository(session)
        self.doc_repo = DocumentRepository(session)
        self.settings = get_settings()
        self._running_jobs: dict[int, threading.Thread] = {}

    # ── Create jobs ────────────────────────────────────────────────────────────

    def create_reconstruct_job(
        self,
        user_id: int,
        document_id: int,
        max_image_width: float = 6.0,
        render_dpi: int = 300,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.RECONSTRUCT.value,
            status=JobStatus.PENDING.value,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_reconstruct,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                max_image_width=max_image_width,
                render_dpi=render_dpi,
            ),
        )
        return job

    def create_combine_job(
        self,
        user_id: int,
        document_ids: list[int],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            tool=JobTool.COMBINE.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(document_ids),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_combine,
            kwargs=dict(
                job_id=job.id,
                document_ids=document_ids,
                output_filename=output_filename,
            ),
        )
        return job

    def create_split_job(
        self,
        user_id: int,
        document_id: int,
        split_points: list[int],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.SPLIT.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(split_points),
            # output_filename will be set to JSON parts list by _run_split
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_split,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                split_points=split_points,
                output_filename=output_filename,
            ),
        )
        return job

    # ── Status helpers ────────────────────────────────────────────────────────

    def get(self, job_id: int) -> Optional[Job]:
        return self.repo.get(job_id)

    def list(self, user_id: int, status: Optional[str] = None) -> tuple[list[Job], int]:
        return self.repo.get_by_user(user_id, status=status)

    # ── Background runner ─────────────────────────────────────────────────────

    def _start_background(self, job: Job, target, kwargs: dict) -> None:
        def wrapper():
            # Each thread needs its own DB session
            from src.models.database import get_engine
            from sqlmodel import Session
            session = Session(get_engine())
            try:
                target(**kwargs, _session=session)
            except Exception as exc:
                self._fail_job(kwargs["job_id"], session, str(exc))
            finally:
                session.close()

        t = threading.Thread(target=wrapper, daemon=True)
        self._running_jobs[job.id] = t
        t.start()

    # ── Reconstruct pipeline ──────────────────────────────────────────────────

    def _run_reconstruct(
        self,
        job_id: int,
        document_id: int,
        max_image_width: float,
        render_dpi: int,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus

        job_repo = JobRepository(_session)
        doc_repo = DocumentRepository(_session)

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=10)

        # Load document
        doc = doc_repo.get(document_id)
        if not doc:
            self._fail_job(job_id, _session, "Document not found")
            return

        pdf_path = Path(doc.file_path)
        if not pdf_path.exists():
            self._fail_job(job_id, _session, "PDF file not found on disk")
            return

        # Extract layout metadata
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=30)
        layout_dir = self.settings.DATA_DIR / "layouts" / str(job_id)
        layout_dir.mkdir(parents=True, exist_ok=True)

        try:
            extract_pdf_layout(
                pdf_path=str(pdf_path),
                output_dir=str(layout_dir),
                page_image_dpi=render_dpi,
                inline_image_dpi=600,
            )
        except Exception as exc:
            self._fail_job(job_id, _session, f"Layout extraction failed: {exc}")
            return

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=60)

        # Run pipeline
        output_filename = pdf_path.stem + ".docx"
        output_path = self.settings.OUTPUT_DIR / str(job_id) / output_filename
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            pipeline = PDFToDocxPipeline(
                model=None,
                style_map=None,
                max_image_width=max_image_width,
                dpi=render_dpi,
            )
            pipeline.process_pdf(
                pdf_path=str(pdf_path),
                output_path=str(output_path),
                json_base_path=str(layout_dir),
            )
        except Exception as exc:
            self._fail_job(job_id, _session, f"Pipeline failed: {exc}")
            return

        self._update(
            job_repo, job_id, JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Combine pipeline ─────────────────────────────────────────────────────

    def _run_combine(
        self,
        job_id: int,
        document_ids: list[int],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.combine import combine_pdfs  # backend/src/pdf_operations/ — canonical

        job_repo = JobRepository(_session)
        doc_repo = DocumentRepository(_session)

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=10)

        pdf_paths = []
        for doc_id in document_ids:
            doc = doc_repo.get(doc_id)
            if not doc:
                self._fail_job(job_id, _session, f"Document {doc_id} not found")
                return
            pdf_paths.append(Path(doc.file_path))

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=50)

        output_path = self.settings.OUTPUT_DIR / str(job_id) / output_filename
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            combine_pdfs(
                [str(p) for p in pdf_paths],
                str(output_path),
                verbose=False,
            )
        except Exception as exc:
            self._fail_job(job_id, _session, f"Combine failed: {exc}")
            return

        self._update(
            job_repo, job_id, JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Split runner ─────────────────────────────────────────────────────────

    def _run_split(
        self,
        job_id: int,
        document_id: int,
        split_points: list[int],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.split import split_by_points

        job_repo = JobRepository(_session)
        doc_repo = DocumentRepository(_session)

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=10)

        doc = doc_repo.get(document_id)
        if not doc:
            self._fail_job(job_id, _session, f"Document {document_id} not found")
            return

        pdf_path = Path(doc.file_path)
        if not pdf_path.exists():
            self._fail_job(job_id, _session, "PDF file not found on disk")
            return

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=30)

        output_dir = self.settings.OUTPUT_DIR / str(job_id)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Open PDF once to get page count and split
        import pymupdf
        with pymupdf.open(str(pdf_path)) as pdf:
            total = pdf.page_count
            try:
                part_paths = split_by_points(
                    str(pdf_path),
                    str(output_dir),
                    split_points,
                    base_name=output_filename,
                    verbose=False,
                )
            except Exception as exc:
                self._fail_job(job_id, _session, f"Split failed: {exc}")
                return

        parts_manifest = []
        prev = -1
        for i, point in enumerate(sorted(split_points)):
            pages_label = f"{prev + 2}-{point + 1}"
            parts_manifest.append({
                "filename": Path(part_paths[i]).name,
                "pages": pages_label,
            })
            prev = point
        # Final part
        pages_label = f"{prev + 2}-{total}"
        parts_manifest.append({
            "filename": Path(part_paths[-1]).name,
            "pages": pages_label,
        })

        self._update(
            job_repo, job_id, JobStatus.DONE.value,
            progress=100,
            output_path=str(output_dir),
            output_filename=json.dumps(parts_manifest),
        )

    # ── Internal helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _update(repo, job_id, status, progress=None, **kwargs):
        job = repo.get(job_id)
        if job:
            job.status = status
            if progress is not None:
                job.progress = progress
            for k, v in kwargs.items():
                setattr(job, k, v)
            from datetime import datetime
            job.updated_at = datetime.utcnow()
            repo.session.add(job)
            repo.session.commit()

    @staticmethod
    def _fail_job(job_id: int, session, error_message: str):
        JobService._update(JobRepository(session), job_id, JobStatus.FAILED.value, error_message=error_message)
