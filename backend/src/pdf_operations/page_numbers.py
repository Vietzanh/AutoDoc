"""
Pure pymupdf page-number insertion for single-page and facing-pages modes.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal, TypedDict, Union

import pymupdf

from src.utils.font_utils import get_text_length


class PageNumberConfig(TypedDict, total=False):
    mode: Literal["single", "facing"]
    position: Literal["top-left", "top-right", "bottom-left", "bottom-right"]
    start_number: int
    from_page: int   # 1-based page number to start numbering
    to_page: int     # 1-based page number to stop numbering
    total_pages: int
    format: Literal["number-only", "page-n", "page-n-of-p", "custom"]
    custom_text: str
    font_name: str
    font_size: float
    bold: bool
    italic: bool
    underline: bool
    color: str  # hex string e.g. "#000000"


# ── position helpers ──────────────────────────────────────────────────────────

def _horizontally_mirror(position: str) -> str:
    """Return the horizontally-mirrored corner position."""
    mirror_map = {
        "top-left": "top-right",
        "top-right": "top-left",
        "bottom-left": "bottom-right",
        "bottom-right": "bottom-left",
    }
    return mirror_map[position]


def _get_rect(page_rect, position: str, margin: float = 20) -> tuple[float, float, float, float]:
    """
    Return the (x0, y0, x1, y1) text rectangle for a corner position.

    Parameters
    ----------
    page_rect : pymupdf.Rect
        The page media box.
    position : str
        One of "top-left", "top-right", "bottom-left", "bottom-right".
    margin : float
        Distance from the page edge.

    Returns
    -------
    tuple[float, float, float, float]
        A small Rect usable for inserting text.
    """
    w = page_rect.width
    h = page_rect.height

    if position == "top-left":
        x0, y0 = margin, margin
        x1, y1 = margin + 80, margin + 25
    elif position == "top-right":
        x0, y0 = w - 80 - margin, margin
        x1, y1 = w - margin, margin + 25
    elif position == "bottom-left":
        x0, y0 = margin, h - 25 - margin
        x1, y1 = margin + 80, h - margin
    elif position == "bottom-right":
        x0, y0 = w - 80 - margin, h - 25 - margin
        x1, y1 = w - margin, h - margin
    else:
        x0, y0 = margin, margin
        x1, y1 = margin + 80, margin + 25

    return (x0, y0, x1, y1)


def _format_text(page_num: int, total: int, format: str, custom: str) -> str:
    """Build the display string for a page number."""
    if format == "number-only":
        return str(page_num)
    elif format == "page-n":
        return f"Page {page_num}"
    elif format == "page-n-of-p":
        return f"Page {page_num} of {total}"
    elif format == "custom":
        # Replace {n} and {p} placeholders
        text = custom.replace("{n}", str(page_num)).replace("{p}", str(total))
        return text
    return str(page_num)


def _get_font_flags(bold: bool, italic: bool, underline: bool) -> int:
    """
    Convert style flags to a pymupdf font flags integer.
    Bold=1, Italic=2.  Underline is handled separately via an annotation.
    """
    flags = 0
    if bold:
        flags |= 1
    if italic:
        flags |= 2
    return flags


def _get_true_fontname(base_font: str, bold: bool, italic: bool) -> str:
    """
    Map base font names to their proper PyMuPDF PostScript variants.
    """
    base = base_font.split("-")[0].lower()
    if base == "times":
        if bold and italic: return "Times-BoldItalic"
        if bold: return "Times-Bold"
        if italic: return "Times-Italic"
        return "Times-Roman"
    elif base == "courier":
        if bold and italic: return "Courier-BoldOblique"
        if bold: return "Courier-Bold"
        if italic: return "Courier-Oblique"
        return "Courier"
    else:  # Helvetica
        if bold and italic: return "Helvetica-BoldOblique"
        if bold: return "Helvetica-Bold"
        if italic: return "Helvetica-Oblique"
        return "Helvetica"


# ── main function ──────────────────────────────────────────────────────────────

def add_page_numbers(
    src_path: Union[str, Path],
    dest_path: Union[str, Path],
    config: PageNumberConfig,
) -> str:
    """
    Add page numbers to a PDF.

    Parameters
    ----------
    src_path
        Path to the source PDF.
    dest_path
        Path where the numbered PDF will be saved.
    config : PageNumberConfig
        - mode: "single" | "facing"
        - position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
        - start_number: int (default 1)
        - from_page: 1-based start page
        - to_page: 1-based end page
        - total_pages: total page count of the source PDF
        - format: "number-only" | "page-n" | "page-n-of-p" | "custom"
        - custom_text: text to use when format == "custom"
        - font_name: e.g. "Helvetica", "Times-Roman"
        - font_size: float
        - bold, italic, underline: bools
        - color: hex string e.g. "#000000"

    Returns
    -------
    str
        The destination path.
    """
    src_path = Path(src_path)
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(str(src_path))

    mode = config.get("mode", "single")
    position = config.get("position", "bottom-right")
    start_number = config.get("start_number", 1)
    from_page = config.get("from_page", 1)
    to_page = config.get("to_page", len(doc))
    total_pages = config.get("total_pages", len(doc))
    fmt = config.get("format", "number-only")
    custom_text = config.get("custom_text", "")
    font_name = config.get("font_name", "Helvetica")
    font_size = config.get("font_size", 10)
    bold = config.get("bold", False)
    italic = config.get("italic", False)
    underline_flag = config.get("underline", False)
    color_str = config.get("color", "#000000")

    # Parse hex color to RGB tuple (0-1 range for pymupdf)
    hex_color = color_str.lstrip("#")
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    color_tuple = (r, g, b)

    # Resolve actual font name based on style flags
    font_name = _get_true_fontname(font_name, bold, italic)
    font_flags = _get_font_flags(bold, italic, False)

    for display_idx in range(len(doc)):
        # display_idx is 0-based; page_number is 1-based
        page_num = display_idx + 1

        # Determine if this page is in the numbering range
        if page_num < from_page or page_num > to_page:
            continue

        page = doc[display_idx]

        # Determine the effective position for this page
        if mode == "facing":
            # Pairs (0,1), (2,3), ...:
            # even display_idx (0,2,4,...) → chosen position
            # odd  display_idx (1,3,5,...) → mirrored position
            if display_idx % 2 == 0:
                effective_pos = position
            else:
                effective_pos = _horizontally_mirror(position)
        else:
            effective_pos = position

        # Build the label text
        display_number = start_number + (page_num - from_page)
        label = _format_text(display_number, total_pages, fmt, custom_text)

        # Compute text rectangle manually based on exact text length
        point_size = font_size
        text_length = get_text_length(label, font_name, point_size)
        
        margin = 20
        w = page.rect.width
        h = page.rect.height

        if effective_pos == "top-left":
            x0, y0 = margin, margin
        elif effective_pos == "top-right":
            x0, y0 = w - margin - text_length, margin
        elif effective_pos == "bottom-left":
            x0, y0 = margin, h - font_size - margin
        elif effective_pos == "bottom-right":
            x0, y0 = w - margin - text_length, h - font_size - margin
        else:
            x0, y0 = margin, margin

        # pymupdf text insertion point is the bottom-left of the text
        # For top corners: y0 is already near the top edge
        # For bottom corners: y1 is the bottom edge; y position = y1 - font_size
        text_x = x0
        text_y = y0 + font_size  # pymupdf y goes downward; y0 is the text baseline

        # Insert text annotation
        try:
            page.insert_text(
                (text_x, text_y),
                label,
                fontname=font_name,
                fontsize=point_size,
                color=color_tuple,
                render_mode=0,
            )
        except Exception:
            # Fallback: insert at calculated baseline
            page.insert_text(
                (x0 + 2, y0 + font_size * 0.85),
                label,
                fontname=font_name,
                fontsize=point_size,
                color=color_tuple,
                render_mode=0,
            )

        # Add underline via a line annotation on the text
        if underline_flag:
            try:
                # Approximate underline position: a few pixels below the baseline
                line_y = text_y + 2
                annot = page.add_freetext_annot(
                    (x0, text_y - 2, x0 + text_length, text_y + 3),
                    "",
                    fontname=font_name,
                    fontsize=point_size,
                    fill_color=None,
                    text_color=color_tuple,
                )
                # Actually draw a line below the text
                line_rect = pymupdf.Rect(x0, line_y, x0 + text_length, line_y + 0.5)
                page.draw_line(
                    (line_rect.x0, line_rect.y0),
                    (line_rect.x1, line_rect.y1),
                    color=color_tuple,
                    width=0.5,
                )
            except Exception:
                pass

    doc.save(str(dest_path), garbage=4, deflate=True, clean=True)
    doc.close()

    return str(dest_path)