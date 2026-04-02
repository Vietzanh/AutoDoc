"""
Combine multiple PDF files into a single PDF.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Union

import pymupdf


def combine_pdfs(
    pdf_paths: List[Union[str, Path]],
    output_path: Union[str, Path],
    *,
    verbose: bool = True,
) -> str:
    """
    Merge an ordered list of PDF files into a single PDF.

    Parameters
    ----------
    pdf_paths : List[str | Path]
        Ordered list of paths to source PDF files. Files are inserted
        in the given order; duplicate paths are allowed.
    output_path : str | Path
        Destination path for the merged PDF.
    verbose : bool
        If True, print page counts and progress messages.

    Returns
    -------
    str
        The resolved output path (same as ``output_path``).

    Raises
    ------
    FileNotFoundError
        If any source file does not exist.
    ValueError
        If ``pdf_paths`` is empty.
    """
    if not pdf_paths:
        raise ValueError("pdf_paths must not be empty")

    pdf_paths = [Path(p).resolve() for p in pdf_paths]

    # Validate all files exist
    for p in pdf_paths:
        if not p.exists():
            raise FileNotFoundError(f"Source file not found: {p}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Create a new blank PDF as the destination
    writer = pymupdf.open()

    total_input_pages = 0
    for i, src_path in enumerate(pdf_paths):
        reader = pymupdf.open(str(src_path))
        src_page_count = len(reader)
        total_input_pages += src_page_count

        if verbose:
            print(f"  [{i + 1}/{len(pdf_paths)}] {src_path.name}: {src_page_count} page(s)")

        writer.insert_pdf(reader)
        reader.close()

    writer.save(str(output_path), garbage=4, deflate=True, clean=True)
    writer.close()

    if verbose:
        print(f"Merged {len(pdf_paths)} file(s), {total_input_pages} total page(s) -> {output_path}")

    return str(output_path)


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def combine_pdfs_in_place(
    pdf_paths: List[Union[str, Path]],
    output_path: Union[str, Path],
    *,
    delete_sources: bool = False,
    verbose: bool = True,
) -> str:
    """
    Same as ``combine_pdfs`` with an optional step to delete source files
    after a successful merge.

    Parameters
    ----------
    delete_sources : bool
        If True, delete each source PDF after it has been inserted.
        Use with caution — this permanently removes files.
    """
    result = combine_pdfs(pdf_paths, output_path, verbose=verbose)

    if delete_sources:
        for p in pdf_paths:
            p = Path(p).resolve()
            if p.exists():
                p.unlink()
                if verbose:
                    print(f"  Deleted: {p}")

    return result
