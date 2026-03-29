"""
Data access layer for jobs.
"""

from typing import Optional
from datetime import datetime

from sqlmodel import Session, select, func

from src.models.database_models import Job, JobStatus


class JobRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, **kwargs) -> Job:
        job = Job(**kwargs)
        self.session.add(job)
        self.session.commit()
        self.session.refresh(job)
        return job

    def get(self, job_id: int) -> Optional[Job]:
        return self.session.get(Job, job_id)

    def get_by_user(
        self,
        user_id: int,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Job], int]:
        query = select(Job).where(Job.user_id == user_id)
        count_query = select(func.count()).select_from(Job).where(Job.user_id == user_id)

        if status:
            query = query.where(Job.status == status)
            count_query = count_query.where(Job.status == status)

        query = query.order_by(Job.created_at.desc()).offset(offset).limit(limit)
        total = self.session.exec(count_query).one()
        results = self.session.exec(query).all()
        return list(results), total

    def update_status(
        self,
        job_id: int,
        status: str,
        error_message: Optional[str] = None,
        output_path: Optional[str] = None,
        output_filename: Optional[str] = None,
        progress: Optional[int] = None,
    ) -> Optional[Job]:
        job = self.session.get(Job, job_id)
        if not job:
            return None
        job.status = status
        job.updated_at = datetime.utcnow()
        if error_message is not None:
            job.error_message = error_message
        if output_path is not None:
            job.output_path = output_path
        if output_filename is not None:
            job.output_filename = output_filename
        if progress is not None:
            job.progress = progress
        self.session.add(job)
        self.session.commit()
        self.session.refresh(job)
        return job

    def delete(self, job_id: int) -> bool:
        job = self.session.get(Job, job_id)
        if not job:
            return False
        self.session.delete(job)
        self.session.commit()
        return True
