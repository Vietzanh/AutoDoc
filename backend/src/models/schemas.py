"""
Pydantic / SQLModel schemas for API request & response bodies.
"""

from datetime import datetime
from typing import Optional, Literal
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


class PageThumbnail(BaseModel):
    page_number: int
    image_base64: str  # data URL: "data:image/png;base64,..."
    width_pts: float = 0.0   # actual page width in points
    height_pts: float = 0.0  # actual page height in points


class PageThumbnailsResponse(BaseModel):
    thumbnails: list[PageThumbnail]


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
    output_filename: str = Field(
        default="",
        max_length=255,
        description="Name of the output DOCX file (defaults to the PDF filename with .docx extension)",
    )
    max_image_width: float = Field(default=6.0, ge=1.0, le=12.0)
    render_dpi: int = Field(default=300, ge=72, le=600)


class CombineRequest(BaseModel):
    document_ids: list[int] = Field(min_length=2, description="Ordered list of document IDs to combine")
    output_filename: str = Field(default="combined.pdf", max_length=255)


# ── Split ─────────────────────────────────────────────────────────────────────

class SplitRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    split_points: list[int] = Field(
        min_length=1,
        description=(
            "0-based page indices marking the end of each output file. "
            "E.g. [2, 4] with 5 pages → Part 1: pages 0-2, Part 2: pages 3-4."
        ),
    )
    output_filename: str = Field(
        default="split_part",
        max_length=255,
        description="Base name for output PDF parts. E.g. 'report' → report_part_1.pdf, report_part_2.pdf, ...",
    )


class SplitPart(BaseModel):
    filename: str
    pages: str  # human-readable range, e.g. "1-3"


class SplitPartsResponse(BaseModel):
    parts: list[SplitPart]


# ── Organize ───────────────────────────────────────────────────────────────────

class OrganizePage(BaseModel):
    """
    Represents a single page in the organize request.
    Pages are sent in their final display order; the server reconstructs the PDF
    in exactly that order, applying any per-page rotation.
    Supports pages from the primary document AND from inserted documents.
    """
    original_index: int = Field(
        description="0-based index of this page in its source PDF"
    )
    source_document_id: int = Field(
        description="ID of the PDF document this page comes from"
    )
    rotation: int = Field(
        default=0,
        description="Rotation to apply to this page: 0, 90, 180, or 270 degrees"
    )
    deleted: bool = Field(default=False, description="Whether this page is marked deleted")


class OrganizeRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    pages: list[OrganizePage] = Field(
        description="Pages in their final display order. Deleted pages are included with deleted=True."
    )
    output_filename: str = Field(
        default="organized.pdf",
        max_length=255,
        description="Name of the output PDF file"
    )


# ── Extract ────────────────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    pages: list[OrganizePage] = Field(
        description="Pages to extract (in their current order after organize modifications)"
    )
    output_filename: str = Field(
        default="extracted.pdf",
        max_length=255,
        description="Name of the output PDF file"
    )


# ── Reorder ────────────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    new_order: list[int] = Field(
        description=(
            "List of 0-based page indices in the desired output order. "
            "All pages must be present exactly once. E.g. [2, 0, 1] swaps page 3 to first."
        )
    )
    output_filename: str = Field(
        default="reordered.pdf",
        max_length=255,
        description="Name of the output PDF file"
    )


# ── Page Numbers ────────────────────────────────────────────────────────────────

PageNumberFormat = Literal["number-only", "page-n", "page-n-of-p", "custom"]
PageNumberPosition = Literal["top-left", "top-right", "bottom-left", "bottom-right"]
PageNumberMode = Literal["single", "facing"]


class TextStyle(BaseModel):
    font_name: str = Field(default="Helvetica")
    font_size: float = Field(default=10.0, ge=4.0, le=72.0)
    bold: bool = Field(default=False)
    italic: bool = Field(default=False)
    underline: bool = Field(default=False)
    color: str = Field(default="#000000", description="Hex color string e.g. #000000")


class PageNumberRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    mode: PageNumberMode = Field(default="single", description="'single' or 'facing'")
    position: PageNumberPosition = Field(
        default="bottom-right",
        description="Corner position for page numbers"
    )
    start_number: int = Field(default=1, ge=1, description="First page number to display")
    from_page: int = Field(default=1, ge=1, description="1-based first page to number")
    to_page: int = Field(default=0, ge=0, description="1-based last page to number (0 = last page)")
    format: PageNumberFormat = Field(
        default="number-only",
        description="'number-only' (recommended), 'page-n', 'page-n-of-p', or 'custom'"
    )
    custom_text: str = Field(
        default="Page {n}",
        max_length=255,
        description="Custom text containing {n} (page number) and/or {p} (total pages)"
    )
    text_style: TextStyle = Field(default_factory=TextStyle)
    output_filename: str = Field(
        default="numbered.pdf",
        max_length=255,
        description="Name of the output PDF file"
    )


# ── Crop ─────────────────────────────────────────────────────────────────────

class CropMargins(BaseModel):
    top: float = Field(default=0.0, ge=0.0, description="Top margin to trim in points")
    bottom: float = Field(default=0.0, ge=0.0, description="Bottom margin to trim in points")
    left: float = Field(default=0.0, ge=0.0, description="Left margin to trim in points")
    right: float = Field(default=0.0, ge=0.0, description="Right margin to trim in points")


class CropRequest(BaseModel):
    document_id: int = Field(description="ID of the source PDF document")
    margins: CropMargins = Field(default_factory=CropMargins, description="Trim margins in points")
    from_page: int = Field(default=1, ge=1, description="1-based first page to crop")
    to_page: int = Field(default=0, ge=0, description="1-based last page to crop (0 = last page)")
    output_filename: str = Field(
        default="cropped.pdf",
        max_length=255,
        description="Name of the output PDF file"
    )


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
