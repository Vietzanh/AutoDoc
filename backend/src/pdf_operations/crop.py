"""
Crop pages — trim margins from PDF pages using pymupdf.
"""

import pymupdf


def crop_by_margins(
    doc_path: str,
    output_path: str,
    margins: dict,
    from_page: int = 1,
    to_page: int = 0,
) -> None:
    """
    Crop pages by trimming margins from each edge.

    Parameters
    ----------
    doc_path : str
        Path to the source PDF.
    output_path : str
        Path for the output PDF.
    margins : dict
        ``{top, bottom, left, right}`` — trim amounts **in points**.
    from_page : int
        1-based first page to crop (default: 1).
    to_page : int
        1-based last page to crop (default: 0 → last page).
    """
    top = margins.get("top", 0)
    bottom = margins.get("bottom", 0)
    left = margins.get("left", 0)
    right = margins.get("right", 0)

    with pymupdf.open(doc_path) as doc:
        if to_page <= 0:
            to_page = len(doc)

        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            if page_num < from_page or page_num > to_page:
                continue

            page = doc[page_idx]
            rect = page.mediabox  # original full page rectangle

            # Compute new crop box by shrinking from each edge
            new_x0 = rect.x0 + left
            new_y0 = rect.y0 + top
            new_x1 = rect.x1 - right
            new_y1 = rect.y1 - bottom

            # Validate the resulting rect is not empty or inverted
            if new_x0 >= new_x1 or new_y0 >= new_y1:
                raise ValueError(
                    f"Page {page_num}: margins too large — "
                    f"the resulting crop area would be empty or negative. "
                    f"Page size: {rect.width:.1f} × {rect.height:.1f} pts, "
                    f"margins: L={left}, R={right}, T={top}, B={bottom}"
                )

            page.set_cropbox(pymupdf.Rect(new_x0, new_y0, new_x1, new_y1))

        doc.save(output_path, garbage=4, deflate=True, clean=True)
