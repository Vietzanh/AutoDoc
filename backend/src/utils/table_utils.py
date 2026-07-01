"""
Table-related utility functions.
"""

from typing import List
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def is_same_line(b1, b2, tol=10):
    """
    Check if two blocks are on the same line.

    Args:
        b1: First block with bbox attribute
        b2: Second block with bbox attribute
        tol: Tolerance in points

    Returns:
        bool: True if blocks are on the same line
    """
    mid1 = (b1.bbox[1] + b1.bbox[3]) / 2.0
    mid2 = (b2.bbox[1] + b2.bbox[3]) / 2.0
    return abs(mid1 - mid2) <= tol


def horizontally_separated(b1, b2, min_gap=20):
    """
    Check if two blocks are horizontally separated.

    Args:
        b1: First block with bbox attribute
        b2: Second block with bbox attribute
        min_gap: Minimum gap in points

    Returns:
        bool: True if blocks are horizontally separated
    """
    left = min(b1.bbox[0], b2.bbox[0])
    right = max(b1.bbox[2], b2.bbox[2])
    width_sum = (b1.bbox[2] - b1.bbox[0]) + (b2.bbox[2] - b2.bbox[0])
    gap = (right - left) - width_sum
    return gap >= min_gap


def remove_table_borders(table):
    """
    Remove borders from a DOCX table.

    Args:
        table: docx.table.Table object
    """
    for row in table.rows:
        for cell in row.cells:
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            existing = tcPr.find(qn("w:tcBorders"))
            if existing:
                tcPr.remove(existing)
            tcBorders = OxmlElement('w:tcBorders')
            for pos in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
                elem = OxmlElement(f"w:{pos}")
                elem.set(qn('w:val'), 'nil')
                tcBorders.append(elem)
            tcPr.append(tcBorders)


def set_table_col_widths(table, col_widths_pts):
    """
    Set column widths for a DOCX table.

    Args:
        table: docx.table.Table object
        col_widths_pts: List of column widths in points
    """
    table.autofit = False
    for col_idx, w_pt in enumerate(col_widths_pts):
        twips = str(int(round(w_pt * 20)))
        for cell in table.columns[col_idx].cells:
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            existing = tcPr.find(qn("w:tcW"))
            if existing is not None:
                tcPr.remove(existing)
            tcW = OxmlElement("w:tcW")
            tcW.set(qn("w:w"), twips)
            tcW.set(qn("w:type"), "dxa")
            tcPr.append(tcW)


def extract_lines_from_block(block, y_tolerance_pt=2.0):
    """
    Extract lines from LayoutBlock for a column in table.

    Args:
        block: LayoutBlock object
        y_tolerance_pt: Vertical tolerance in points

    Returns:
        List[str]: List of text lines
    """
    elems = getattr(block, "elements", [])
    if not elems:
        return []
    spans = [{"bbox": e.bbox, "text": e.text} for e in elems]
    spans = sorted(spans, key=lambda s: (s["bbox"][1], s["bbox"][0]))
    lines = []
    current_line = [spans[0]]
    for s in spans[1:]:
        prev = current_line[-1]
        y_prev = prev["bbox"][1]
        y_curr = s["bbox"][1]
        if abs(y_curr - y_prev) > y_tolerance_pt:
            lines.append(current_line)
            current_line = [s]
        else:
            current_line.append(s)
    lines.append(current_line)
    text_lines = ["".join(span["text"] for span in line).strip() for line in lines]
    return text_lines


def is_bbox_contained(inner_bbox, outer_bbox, tol: float = 0.0):
    """
    Check if inner_bbox is completely contained within outer_bbox.

    Args:
        inner_bbox: Inner bounding box (x0, y0, x1, y1)
        outer_bbox: Outer bounding box (x0, y0, x1, y1)
        tol: Tolerance for bounding box boundaries

    Returns:
        bool: True if inner_bbox is contained in outer_bbox
    """
    x0_inner, y0_inner, x1_inner, y1_inner = inner_bbox
    x0_outer, y0_outer, x1_outer, y1_outer = outer_bbox
    return (x0_inner >= x0_outer - tol and y0_inner >= y0_outer - tol and
            x1_inner <= x1_outer + tol and y1_inner <= y1_outer + tol)


def get_containment_ratio(inner_bbox, outer_bbox) -> float:
    """
    Calculate what fraction of the inner_bbox's area is contained within outer_bbox.
    Useful for checking containment robustly despite YOLO bounding box noise.
    """
    x0_inner, y0_inner, x1_inner, y1_inner = inner_bbox
    x0_outer, y0_outer, x1_outer, y1_outer = outer_bbox

    inter_x0 = max(x0_inner, x0_outer)
    inter_y0 = max(y0_inner, y0_outer)
    inter_x1 = min(x1_inner, x1_outer)
    inter_y1 = min(y1_inner, y1_outer)

    inter_w = max(0.0, inter_x1 - inter_x0)
    inter_h = max(0.0, inter_y1 - inter_y0)
    inter_area = inter_w * inter_h
    
    if inter_area <= 0.0:
        return 0.0

    inner_area = max(0.0, x1_inner - x0_inner) * max(0.0, y1_inner - y0_inner)
    if inner_area <= 0.0:
        return 0.0

    return inter_area / inner_area
