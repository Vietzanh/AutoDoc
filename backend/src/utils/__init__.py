"""
Utility functions for PDF to DOCX reconstruction.
"""

from .font_utils import clean_font_name, round_font_size
from .heading_utils import get_section_heading_level
from .table_utils import (
    is_same_line,
    horizontally_separated,
    remove_table_borders,
    set_table_col_widths,
    extract_lines_from_block,
    is_bbox_contained,
    get_containment_ratio,
)

__all__ = [
    "clean_font_name",
    "round_font_size",
    "get_section_heading_level",
    "is_same_line",
    "horizontally_separated",
    "remove_table_borders",
    "set_table_col_widths",
    "extract_lines_from_block",
    "is_bbox_contained",
    "get_containment_ratio",
]
