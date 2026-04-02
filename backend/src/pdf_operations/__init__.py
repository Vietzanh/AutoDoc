"""
PDF operations module — pure pymupdf transformations (no ML).

Canonical location: backend/src/pdf_operations/
Reference (read-only): AutoDoc/src/pdf_operations/
"""

from .combine import combine_pdfs
from .organize import (
    delete_pages,
    extract_pages,
    insert_pages,
    reorder_pages,
    rotate_pages,
)

__all__ = [
    "combine_pdfs",
    "delete_pages",
    "extract_pages",
    "insert_pages",
    "reorder_pages",
    "rotate_pages",
]
