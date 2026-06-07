"""
Merge multiple PDF files into a single PDF.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Union

import pymupdf


def merge_pdfs(
    pdf_paths: List[Union[str, Path]],
    output_path: Union[str, Path],
    *,
    verbose: bool = True,
) -> str:
    """
    Merge an ordered list of PDF files into a single PDF.
    """
    if not pdf_paths:
        raise ValueError("pdf_paths must not be empty")

    source_paths = [Path(path).resolve() for path in pdf_paths]

    for path in source_paths:
        if not path.exists():
            raise FileNotFoundError(f"Source file not found: {path}")

    resolved_output_path = Path(output_path).resolve()
    resolved_output_path.parent.mkdir(parents=True, exist_ok=True)

    writer = pymupdf.open()

    total_input_pages = 0
    for index, source_path in enumerate(source_paths):
        reader = pymupdf.open(str(source_path))
        source_page_count = len(reader)
        total_input_pages += source_page_count

        if verbose:
            print(f"  [{index + 1}/{len(source_paths)}] {source_path.name}: {source_page_count} page(s)")

        writer.insert_pdf(reader)
        reader.close()

    writer.save(str(resolved_output_path), garbage=4, deflate=True, clean=True)
    writer.close()

    if verbose:
        print(f"Merged {len(source_paths)} file(s), {total_input_pages} total page(s) -> {resolved_output_path}")

    return str(resolved_output_path)


def merge_pdfs_in_place(
    pdf_paths: List[Union[str, Path]],
    output_path: Union[str, Path],
    *,
    delete_sources: bool = False,
    verbose: bool = True,
) -> str:
    """
    Same as ``merge_pdfs`` with an optional step to delete source files
    after a successful merge.
    """
    result = merge_pdfs(pdf_paths, output_path, verbose=verbose)

    if delete_sources:
        for path in pdf_paths:
            resolved_path = Path(path).resolve()
            if resolved_path.exists():
                resolved_path.unlink()
                if verbose:
                    print(f"  Deleted: {resolved_path}")

    return result
