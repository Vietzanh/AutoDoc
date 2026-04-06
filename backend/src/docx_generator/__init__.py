"""
DOCX generation module for PDF to DOCX reconstruction.
"""

from .processors import (
    process_text_block,
    process_figure_block,
    process_table_block,
    process_table_row,
    should_merge_with_previous_block,
)

__all__ = [
    "process_text_block",
    "process_figure_block",
    "process_table_block",
    "process_table_row",
    "should_merge_with_previous_block",
]
