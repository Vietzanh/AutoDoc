"""
SQLModel table definitions.
"""

from datetime import datetime
from enum import Enum

from sqlmodel import SQLModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class JobTool(str, Enum):
    RECONSTRUCT = "reconstruct"       # PDF → DOCX
    COMBINE = "combine"               # Combine PDFs
    SPLIT = "split"                   # Split PDF
    ORGANIZE = "organize"             # Organize pages
    EXTRACT = "extract"               # Extract pages
    CROP = "crop"                     # Crop pages
    PAGE_NUMBERS = "page_numbers"     # Number pages


class User(SQLModel, table=True):
    """User account."""
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    username: str = Field(unique=True, index=True, max_length=100)
    hashed_password: str = Field(max_length=255)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Document(SQLModel, table=True):
    """A PDF or DOCX file owned by a user."""
    __tablename__ = "documents"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    original_filename: str = Field(max_length=255)
    stored_filename: str = Field(max_length=255)   # UUID-based on disk
    file_path: str = Field(max_length=512)           # absolute path on server
    file_size: int = Field(default=0)               # bytes
    file_type: str = Field(default="pdf", max_length=20)  # pdf / docx
    page_count: int | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Job(SQLModel, table=True):
    """An async processing job (PDF→DOCX, combine, split, etc.)."""
    __tablename__ = "jobs"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    document_id: int | None = Field(default=None, foreign_key="document.id", index=True)
    tool: str = Field(max_length=50)                # JobTool enum value
    status: str = Field(default=JobStatus.PENDING.value, max_length=20)
    input_document_ids: str = Field(default="[]")   # JSON list of doc IDs (for combine)
    output_filename: str | None = Field(default=None, max_length=255)
    output_path: str | None = Field(default=None, max_length=512)
    error_message: str | None = Field(default=None, max_length=1000)
    progress: int = Field(default=0)                 # 0–100
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
