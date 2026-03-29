"""
Pydantic / SQLModel schemas for API request & response bodies.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6)


class UserRead(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str  # user id as string


# ── Auth body ─────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str  # can be username or email
    password: str


# ── Document ───────────────────────────────────────────────────────────────────

class DocumentRead(BaseModel):
    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    file_path: str
    file_size: int
    file_type: str
    page_count: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentRead]
    total: int


# ── Job ───────────────────────────────────────────────────────────────────────

class JobRead(BaseModel):
    id: int
    user_id: int
    document_id: Optional[int] = None
    tool: str
    status: str
    input_document_ids: str
    output_filename: Optional[str] = None
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    progress: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: list[JobRead]
    total: int


class ReconstructRequest(BaseModel):
    document_id: int = Field(description="ID of the uploaded PDF document")
    max_image_width: float = Field(default=6.0, ge=1.0, le=12.0)
    render_dpi: int = Field(default=300, ge=72, le=600)


class CombineRequest(BaseModel):
    document_ids: list[int] = Field(min_length=2, description="Ordered list of document IDs to combine")
    output_filename: str = Field(default="combined.pdf", max_length=255)


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
