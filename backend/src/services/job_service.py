"""
Job service — orchestrates async PDF processing tasks.

Processing runs in a background thread to avoid blocking the FastAPI event loop.
"""

import json
import uuid
import threading
from pathlib import Path
from typing import List, Optional

import pymupdf

from src.core.config import get_settings
from src.models.database_models import Job, JobStatus, JobTool, Document
from src.repositories.job_repository import JobRepository
from src.repositories.document_repository import DocumentRepository


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
        document_ids: List[int],
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
        split_points: List[int],
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

    def create_organize_job(
        self,
        user_id: int,
        document_id: int,
        pages: List[dict],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.ORGANIZE.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(pages),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_organize,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                pages=pages,
                output_filename=output_filename,
            ),
        )
        return job

    def create_extract_job(
        self,
        user_id: int,
        document_id: int,
        pages: List[dict],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.EXTRACT.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(pages),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_extract,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                pages=pages,
                output_filename=output_filename,
            ),
        )
        return job

    # ── Status helpers ────────────────────────────────────────────────────────

    def get(self, job_id: int) -> Optional[Job]:
        return self.repo.get(job_id)

    def list(self, user_id: int, status: Optional[str] = None) -> tuple[List[Job], int]:
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
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Combine pipeline ─────────────────────────────────────────────────────

    def _run_combine(
        self,
        job_id: int,
        document_ids: List[int],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.combine import (
            combine_pdfs,
        )  # backend/src/pdf_operations/ — canonical

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
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Split runner ─────────────────────────────────────────────────────────

    def _run_split(
        self,
        job_id: int,
        document_id: int,
        split_points: List[int],
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
            parts_manifest.append(
                {
                    "filename": Path(part_paths[i]).name,
                    "pages": pages_label,
                }
            )
            prev = point
        # Final part
        pages_label = f"{prev + 2}-{total}"
        parts_manifest.append(
            {
                "filename": Path(part_paths[-1]).name,
                "pages": pages_label,
            }
        )

        self._update(
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_dir),
            output_filename=json.dumps(parts_manifest),
        )

    # ── Organize runner ──────────────────────────────────────────────────────

    def _run_organize(
        self,
        job_id: int,
        document_id: int,
        pages: List[dict],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.organize import (
            delete_pages,
            rotate_pages,
            reorder_pages,
        )

        job_repo = JobRepository(_session)
        doc_repo = DocumentRepository(_session)

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=5)

        doc = doc_repo.get(document_id)
        if not doc:
            self._fail_job(job_id, _session, "Document not found")
            return

        pdf_path = Path(doc.file_path)
        if not pdf_path.exists():
            self._fail_job(job_id, _session, "PDF file not found on disk")
            return

        # Working directory for intermediate files
        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        temp_path = work_dir / "temp_original.pdf"

        # ── Step 1: delete ────────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=15)
        deleted_indices = [p["original_index"] for p in pages if p.get("deleted")]
        if deleted_indices:
            delete_pages(str(pdf_path), str(temp_path), deleted_indices)
            src = temp_path
        else:
            # Just copy the original to temp_path so subsequent steps read from it
            import shutil

            shutil.copy2(str(pdf_path), str(temp_path))
            src = temp_path

        # ── Step 2: rotate remaining pages ────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=35)
        remaining = [p for p in pages if not p.get("deleted")]
        to_rotate = {
            p["original_index"]: p["rotation"]
            for p in remaining
            if p.get("rotation", 0) not in (0, 360)
        }
        if to_rotate:
            rotated_path = work_dir / "rotated.pdf"
            # After deletion the temp file has pages renumbered 0..N-1.
            # Map original_index → temp-file position (cumulative count of non-deleted pages before it).
            deleted_set = set(deleted_indices)
            temp_index_map = {}
            temp_idx = 0
            for orig_i in range(len(pages)):
                if orig_i not in deleted_set:
                    temp_index_map[orig_i] = temp_idx
                    temp_idx += 1
            temp_rotations = {
                temp_index_map[orig_i]: delta for orig_i, delta in to_rotate.items()
            }
            rotate_pages(str(src), str(rotated_path), temp_rotations)
            src = rotated_path

        # ── Step 3: reorder ───────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=60)
        # After deletion (+ optional rotation), the temp file has pages 0..N-1
        # in original-index order. `remaining` is in display order.
        # new_order maps temp-file position → original_index in the display order.
        deleted_set = set(deleted_indices)
        temp_index_map = {}
        temp_idx = 0
        for orig_i in range(len(pages)):
            if orig_i not in deleted_set:
                temp_index_map[orig_i] = temp_idx
                temp_idx += 1
        # new_order: for each page in display order, what original_index does it come from?
        new_order = [p["original_index"] for p in remaining]

        output_path = work_dir / output_filename
        if new_order != list(range(len(new_order))):
            reorder_pages(str(src), str(output_path), new_order)
        else:
            # No reorder needed — just copy the rotated (or original) file
            import shutil

            shutil.copy2(str(src), str(output_path))

        # ── Done ───────────────────────────────────────────────────────────────
        self._update(
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Extract runner ─────────────────────────────────────────────────────────

    def _run_extract(
        self,
        job_id: int,
        document_id: int,
        pages: List[dict],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.organize import (
            delete_pages,
            rotate_pages,
            extract_pages,
        )

        job_repo = JobRepository(_session)
        doc_repo = DocumentRepository(_session)

        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=5)

        doc = doc_repo.get(document_id)
        if not doc:
            self._fail_job(job_id, _session, "Document not found")
            return

        pdf_path = Path(doc.file_path)
        if not pdf_path.exists():
            self._fail_job(job_id, _session, "PDF file not found on disk")
            return

        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        # ── Step 1: rotate ────────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=25)
        to_rotate = {
            p["original_index"]: p["rotation"]
            for p in pages
            if p.get("rotation", 0) not in (0, 360)
        }
        rotated_path = work_dir / "rotated.pdf"
        if to_rotate:
            rotate_pages(str(pdf_path), str(rotated_path), to_rotate)
            src = rotated_path
        else:
            import shutil

            shutil.copy2(str(pdf_path), str(rotated_path))
            src = rotated_path

        # ── Step 2: extract ────────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=60)
        output_path = work_dir / output_filename
        extract_indices = [p["original_index"] for p in pages]
        extract_pages(str(src), str(output_path), extract_indices)

        # ── Done ───────────────────────────────────────────────────────────────
        self._update(
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
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
        JobService._update(
            JobRepository(session),
            job_id,
            JobStatus.FAILED.value,
            error_message=error_message,
        )
