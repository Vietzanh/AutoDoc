"""
Pure pymupdf page-level operations for the Insert Pages tool.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Union

import pymupdf


def insert_pages_custom(
    primary_doc_path: Union[str, Path],
    secondary_doc_path: Union[str, Path],
    dest_path: Union[str, Path],
    pages: List[dict],
    primary_doc_id: int,
    secondary_doc_id: int,
) -> str:
    """
    Assemble a new PDF from pages drawn from a primary and a secondary PDF.

    Parameters
    ----------
    primary_doc_path
        Path to the primary source PDF.
    secondary_doc_path
        Path to the secondary source PDF to insert from.
    dest_path
        Path where the modified PDF will be saved.
    pages
        List of dictionaries with 'original_index' and 'source_document_id'.
    primary_doc_id
        The ID of the primary document to match against source_document_id.
    secondary_doc_id
        The ID of the secondary document to match against source_document_id.

    Returns
    -------
    str
        The destination path.
    """
    primary_doc_path = Path(primary_doc_path)
    secondary_doc_path = Path(secondary_doc_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc_primary = pymupdf.open(str(primary_doc_path))
    doc_secondary = pymupdf.open(str(secondary_doc_path))
    writer = pymupdf.open()

    for page_def in pages:
        src_doc = doc_primary if page_def["source_document_id"] == primary_doc_id else doc_secondary
        if 0 <= page_def["original_index"] < len(src_doc):
            writer.insert_pdf(src_doc, from_page=page_def["original_index"], to_page=page_def["original_index"])

    writer.save(str(dest_path), garbage=4, deflate=True, clean=True)
    writer.close()
    doc_primary.close()
    doc_secondary.close()

    return str(dest_path)
