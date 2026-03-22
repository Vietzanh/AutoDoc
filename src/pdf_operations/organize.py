"""
Pure pymupdf page-level operations for the Organize Pages tool.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Tuple, Union

import pymupdf


def delete_pages(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    indices: List[int],
) -> str:
    """
    Delete pages at the given 0-based indices from the PDF.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    dest_path
        Path where the modified PDF will be saved.
    indices
        0-based page indices to delete.

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    indices_set = set(indices)
    doc = pymupdf.open(str(src_path))
    writer = pymupdf.open()

    for page_num in range(len(doc)):
        if page_num not in indices_set:
            writer.insert_pdf(doc, from_page=page_num, to_page=page_num)

    writer.save(str(dest_path), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    return str(dest_path)


def rotate_pages(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    rotations: dict[int, int],
) -> str:
    """
    Apply per-page rotations to a PDF.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    dest_path
        Path where the modified PDF will be saved.
    rotations
        Map of 0-based page index → rotation in degrees (90, 180, 270).
        Rotations are cumulative with existing page rotation.

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(src_path))
    for page_num, delta in rotations.items():
        if 0 <= page_num < len(doc):
            page = doc[page_num]
            page.set_rotation(page.rotation + delta)

    doc.save(str(dest_path), garbage=4, deflate=True, clean=True)
    doc.close()

    return str(dest_path)


def extract_pages(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    indices: List[int],
) -> str:
    """
    Extract pages at the given 0-based indices to a new PDF.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    dest_path
        Path where the extracted PDF will be saved.
    indices
        0-based page indices to extract.

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(src_path))
    writer = pymupdf.open()

    for page_num in sorted(indices):
        if 0 <= page_num < len(doc):
            writer.insert_pdf(doc, from_page=page_num, to_page=page_num)

    writer.save(str(dest_path), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    return str(dest_path)


def insert_pages(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    insert_at: int,
    insert_src_path: Union[str, Path],
    insert_src_range: Tuple[int, int] = (0, -1),
) -> str:
    """
    Insert pages from another PDF at a given position in the source PDF.

    Parameters
    ----------
    src_path
        Path to the base PDF.
    dest_path
        Path where the modified PDF will be saved.
    insert_at
        0-based index in the base PDF before which pages will be inserted.
    insert_src_path
        Path to the PDF whose pages will be inserted.
    insert_src_range
        (from_page, to_page) 0-based inclusive range in the insert source.
        Pass (0, -1) to insert all pages.

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    insert_src_path = Path(insert_src_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    src_doc = pymupdf.open(str(src_path))
    insert_doc = pymupdf.open(str(insert_src_path))
    writer = pymupdf.open()

    from_page, to_page = insert_src_range
    if to_page == -1:
        to_page = len(insert_doc) - 1

    # Pages before insert point
    for i in range(insert_at):
        writer.insert_pdf(src_doc, from_page=i, to_page=i)

    # Inserted pages
    for i in range(from_page, to_page + 1):
        writer.insert_pdf(insert_doc, from_page=i, to_page=i)

    # Pages from insert point onwards
    for i in range(insert_at, len(src_doc)):
        writer.insert_pdf(src_doc, from_page=i, to_page=i)

    writer.save(str(dest_path), garbage=4, deflate=True, clean=True)
    writer.close()
    src_doc.close()
    insert_doc.close()

    return str(dest_path)


def reorder_pages(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    new_order: List[int],
) -> str:
    """
    Reorder pages in a PDF according to a new index list.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    dest_path
        Path where the reordered PDF will be saved.
    new_order
        List of 0-based source page indices in the desired order.
        Length must match the source page count.

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(src_path))
    writer = pymupdf.open()

    for page_num in new_order:
        if 0 <= page_num < len(doc):
            writer.insert_pdf(doc, from_page=page_num, to_page=page_num)

    writer.save(str(dest_path), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    return str(dest_path)
