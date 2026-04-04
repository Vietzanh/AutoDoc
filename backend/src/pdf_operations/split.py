"""
Split a PDF into multiple parts based on page boundaries.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Union

import pymupdf


def split_by_points(
    src_path: Union[str, Path],
    output_dir: Union[str, Path],
    split_points: List[int],
    base_name: str = "part",
    *,
    verbose: bool = True,
) -> List[str]:
    """
    Split a PDF at the given 0-based page boundaries.

    Each entry in ``split_points`` marks the last page index of that part.
    Pages are 1-indexed in the filenames for readability.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    output_dir
        Directory where output part files will be written.
    split_points
        Sorted list of 0-based last-page indices for each part.
        E.g. [2, 4] with 5 pages → Part 1: pages 1-3, Part 2: pages 4-5.
        The final part runs from (split_points[-1] + 1) to the end.
    base_name
        Filename prefix for output parts. E.g. "part" → part_1.pdf, part_2.pdf.

    Returns
    -------
    list[str]
        Paths to the generated PDF files.

    Raises
    ------
    ValueError
        If ``split_points`` is empty or not sorted.
    """
    src_path = Path(src_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(src_path))
    total_pages = len(doc)

    if not split_points:
        raise ValueError("split_points must not be empty")

    # Validate sorted
    for i in range(1, len(split_points)):
        if split_points[i] <= split_points[i - 1]:
            raise ValueError("split_points must be strictly increasing")

    # Build ranges: (from_page_0based, to_page_0based)
    ranges: List[tuple[int, int]] = []
    prev = -1
    for point in split_points:
        if point < 0 or point >= total_pages:
            raise ValueError(f"Split point {point} is out of range (0 to {total_pages - 1})")
        ranges.append((prev + 1, point))
        prev = point
    # Final part
    ranges.append((prev + 1, total_pages - 1))

    output_paths: List[str] = []
    writer = pymupdf.open()

    for i, (from_page, to_page) in enumerate(ranges, start=1):
        writer = pymupdf.open()
        writer.insert_pdf(doc, from_page=from_page, to_page=to_page)

        part_path = output_dir / f"{base_name}_{i:03d}.pdf"
        writer.save(str(part_path), garbage=4, deflate=True, clean=True)
        writer.close()

        output_paths.append(str(part_path))
        if verbose:
            print(f"  Part {i}: pages {from_page + 1}–{to_page + 1} → {part_path.name}")

    doc.close()
    return output_paths
