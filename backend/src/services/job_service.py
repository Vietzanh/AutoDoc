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
        output_filename: str = "",
        max_image_width: float = 6.0,
        render_dpi: int = 100,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.RECONSTRUCT.value,
            status=JobStatus.PENDING.value,
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_reconstruct,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                output_filename=output_filename,
                max_image_width=max_image_width,
                render_dpi=render_dpi,
            ),
        )
        return job

    def create_merge_job(
        self,
        user_id: int,
        document_ids: List[int],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            tool=JobTool.MERGE.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(document_ids),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_merge,
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

    def create_reorder_job(
        self,
        user_id: int,
        document_id: int,
        new_order: List[int],
        output_filename: str,
    ) -> Job:
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.REORDER.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(new_order),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_reorder,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                new_order=new_order,
                output_filename=output_filename,
            ),
        )
        return job

    def create_crop_job(
        self,
        user_id: int,
        document_id: int,
        margins: dict,
        from_page: int,
        to_page: int,
        output_filename: str,
    ) -> Job:
        config = dict(
            margins=margins,
            from_page=from_page,
            to_page=to_page,
        )
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.CROP.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(config),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_crop,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                config=config,
                output_filename=output_filename,
            ),
        )
        return job

    def create_page_numbers_job(
        self,
        user_id: int,
        document_id: int,
        mode: str,
        position: str,
        start_number: int,
        from_page: int,
        to_page: int,
        total_pages: int,
        fmt: str,
        custom_text: str,
        font_name: str,
        font_size: float,
        bold: bool,
        italic: bool,
        underline: bool,
        color: str,
        output_filename: str,
    ) -> Job:
        config = dict(
            mode=mode,
            position=position,
            start_number=start_number,
            from_page=from_page,
            to_page=to_page,
            total_pages=total_pages,
            format=fmt,
            custom_text=custom_text,
            font_name=font_name,
            font_size=font_size,
            bold=bold,
            italic=italic,
            underline=underline,
            color=color,
        )
        job = self.repo.create(
            user_id=user_id,
            document_id=document_id,
            tool=JobTool.PAGE_NUMBERS.value,
            status=JobStatus.PENDING.value,
            input_document_ids=json.dumps(config),
            output_filename=output_filename,
            progress=0,
        )
        self._start_background(
            job,
            target=self._run_page_numbers,
            kwargs=dict(
                job_id=job.id,
                document_id=document_id,
                config=config,
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
        output_filename: str,
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

        # Extract layout metadata is now done in-memory within the pipeline
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=30)

        # Run pipeline
        # Determine output filename — use given name, or derive from original PDF filename
        if output_filename:
            out_name = output_filename
        else:
            # Use original_filename (e.g. "Quarterly Report Q1 2024") instead of
            # stored UUID name so the DOCX has a meaningful default filename.
            out_name = doc.original_filename.rsplit(".", 1)[0] + ".docx"
        if not out_name.lower().endswith(".docx"):
            out_name += ".docx"
        output_path = self.settings.OUTPUT_DIR / str(job_id) / out_name
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            pipeline = PDFToDocxPipeline(
                model=None,
                style_map=None,
                max_image_width=max_image_width,
                dpi=render_dpi,
            )
            
            def _progress_cb(pct: int):
                self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=pct)
                
            pipeline.process_pdf(
                pdf_path=str(pdf_path),
                output_path=str(output_path),
                progress_callback=_progress_cb
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
            output_filename=out_name,
        )

    # ── Merge pipeline ───────────────────────────────────────────────────────

    def _run_merge(
        self,
        job_id: int,
        document_ids: List[int],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.merge import merge_pdfs

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
            merge_pdfs(
                [str(p) for p in pdf_paths],
                str(output_path),
                verbose=False,
            )
        except Exception as exc:
            self._fail_job(job_id, _session, f"Merge failed: {exc}")
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
    # Handles pages from the primary document AND from any inserted documents.

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

        # Load all source documents
        all_doc_ids = list({p["source_document_id"] for p in pages})
        doc_map: dict[int, Path] = {}
        for doc_id in all_doc_ids:
            doc = doc_repo.get(doc_id)
            if not doc:
                self._fail_job(job_id, _session, f"Document {doc_id} not found")
                return
            p = Path(doc.file_path)
            if not p.exists():
                self._fail_job(job_id, _session, f"PDF file for document {doc_id} not found on disk")
                return
            doc_map[doc_id] = p

        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        # ── Step 1: combine all source PDFs into one temp file in display order ──
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=15)

        # Group pages by source doc and compute per-doc display index offset
        # We build a combined PDF in display order using insert_pages logic
        combined_path = work_dir / "combined.pdf"
        import pymupdf

        writer = pymupdf.open()
        for p in pages:
            src_doc_id = p["source_document_id"]
            src_doc = pymupdf.open(str(doc_map[src_doc_id]))
            if 0 <= p["original_index"] < len(src_doc):
                writer.insert_pdf(src_doc, from_page=p["original_index"], to_page=p["original_index"])
            src_doc.close()
        writer.save(str(combined_path), garbage=4, deflate=True, clean=True)
        writer.close()

        # After combining, combined.pdf pages are 0..N-1 in display order
        # Map display index → rotation
        display_rotation_map: dict[int, int] = {}
        display_deleted_set: set[int] = set()
        for display_idx, p in enumerate(pages):
            if p.get("deleted"):
                display_deleted_set.add(display_idx)
            elif p.get("rotation", 0) not in (0, 360):
                display_rotation_map[display_idx] = p["rotation"]

        # ── Step 2: delete ────────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=40)
        if display_deleted_set:
            temp_path = work_dir / "temp_after_delete.pdf"
            delete_pages(str(combined_path), str(temp_path), sorted(display_deleted_set))
            src = temp_path
        else:
            import shutil
            temp_path = work_dir / "temp_after_delete.pdf"
            shutil.copy2(str(combined_path), str(temp_path))
            src = temp_path

        # Rebuild rotation map after deletion (shift indices)
        # deleted pages are removed from the file; renumber the rotation map
        src = Path(src)
        with pymupdf.open(str(src)) as pdf:
            total_pages = pdf.page_count

        new_rotation_map: dict[int, int] = {}
        if display_rotation_map:
            del_idx = sorted(display_deleted_set)
            del_set = set(del_idx)
            new_idx = 0
            for old_idx in range(len(pages)):
                if old_idx in del_set:
                    continue
                if old_idx in display_rotation_map:
                    new_rotation_map[new_idx] = display_rotation_map[old_idx]
                new_idx += 1

        # ── Step 3: rotate ───────────────────────────────────────────────────
        self._update(job_repo, job_id, JobStatus.PROCESSING.value, progress=65)
        if new_rotation_map:
            rotated_path = work_dir / "rotated.pdf"
            rotate_pages(str(src), str(rotated_path), new_rotation_map)
            src = rotated_path

        # ── Step 4: reorder (no-op — already in display order after combine) ─
        output_path = work_dir / output_filename
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

    # ── Reorder runner ───────────────────────────────────────────────────────

    def _run_reorder(
        self,
        job_id: int,
        document_id: int,
        new_order: List[int],
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.organize import reorder_pages

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

        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        output_path = work_dir / output_filename

        try:
            reorder_pages(str(pdf_path), str(output_path), new_order)
        except Exception as exc:
            self._fail_job(job_id, _session, f"Reorder failed: {exc}")
            return

        self._update(
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Crop runner ────────────────────────────────────────────────────────────

    def _run_crop(
        self,
        job_id: int,
        document_id: int,
        config: dict,
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.crop import crop_by_margins

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

        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        output_path = work_dir / output_filename

        try:
            crop_by_margins(
                doc_path=str(pdf_path),
                output_path=str(output_path),
                margins=config.get("margins", {}),
                from_page=config.get("from_page", 1),
                to_page=config.get("to_page", 0),
            )
        except Exception as exc:
            self._fail_job(job_id, _session, f"Crop failed: {exc}")
            return

        self._update(
            job_repo,
            job_id,
            JobStatus.DONE.value,
            progress=100,
            output_path=str(output_path),
            output_filename=output_filename,
        )

    # ── Page Numbers runner ─────────────────────────────────────────────────────

    def _run_page_numbers(
        self,
        job_id: int,
        document_id: int,
        config: dict,
        output_filename: str,
        _session,
    ) -> None:
        from src.models.database_models import JobStatus
        from src.pdf_operations.page_numbers import add_page_numbers

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

        work_dir = self.settings.OUTPUT_DIR / str(job_id)
        work_dir.mkdir(parents=True, exist_ok=True)

        output_path = work_dir / output_filename

        try:
            add_page_numbers(str(pdf_path), str(output_path), config)
        except Exception as exc:
            self._fail_job(job_id, _session, f"Page numbers failed: {exc}")
            return

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
