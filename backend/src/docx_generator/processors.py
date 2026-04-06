"""
Processors for different block types in DOCX generation.
"""

import os
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

from src.utils import (
    clean_font_name,
    round_font_size,
    get_section_heading_level,
    remove_table_borders,
    set_table_col_widths,
    is_same_line,
    horizontally_separated,
)
from src.yolo.iou_matching import TextElement, LayoutBlock


def should_merge_with_previous_block(prev_block, curr_block):
    """
    Check if current text block should be merged with previous block into same paragraph.
    """
    if not prev_block or not curr_block:
        return False

    prev_text = prev_block.text if hasattr(prev_block, 'text') else ""
    curr_text = curr_block.text if hasattr(curr_block, 'text') else ""

    if not prev_text or not curr_text:
        return False

    prev_ends_with_space = prev_text.rstrip().endswith(" ")
    prev_no_sentence_end = prev_text.rstrip()[-1] not in ".!?"

    if prev_ends_with_space:
        return True

    curr_starts_lowercase = curr_text.strip() and curr_text.strip()[0].islower()
    return prev_no_sentence_end and curr_starts_lowercase


def process_figure_block(docx_doc, block, page_image, scale_x, scale_y, max_image_width, page_idx):
    """
    Process a figure block by extracting and inserting the image.
    """
    image_path = block.extra.get("image_path") if hasattr(block, "extra") else None

    if image_path and os.path.exists(image_path):
        p = docx_doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run()
        run.add_picture(image_path, width=max_image_width)
        return True

    if page_image is None:
        return False

    x0_pdf, y0_pdf, x1_pdf, y1_pdf = block.bbox
    x0 = int(max(0, x0_pdf * scale_x))
    y0 = int(max(0, y0_pdf * scale_y))
    x1 = int(min(page_image.shape[1], x1_pdf * scale_x))
    y1 = int(min(page_image.shape[0], y1_pdf * scale_y))

    crop_img = page_image[y0:y1, x0:x1]
    if crop_img.size == 0:
        return False

    temp_image_path = f"temp_crop_page{page_idx}.png"
    cv2.imwrite(temp_image_path, cv2.cvtColor(crop_img, cv2.COLOR_RGB2BGR))
    p = docx_doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(temp_image_path, width=max_image_width)

    if os.path.exists(temp_image_path):
        os.remove(temp_image_path)

    return True


def process_table_block(docx_doc, block, page_image, scale_x, scale_y, max_image_width, page_idx):
    """
    Process a table block by cropping and inserting the table as an image.
    """
    if page_image is None:
        return False

    x0_pdf, y0_pdf, x1_pdf, y1_pdf = block.bbox
    x0 = int(max(0, x0_pdf * scale_x))
    y0 = int(max(0, y0_pdf * scale_y))
    x1 = int(min(page_image.shape[1], x1_pdf * scale_x))
    y1 = int(min(page_image.shape[0], y1_pdf * scale_y))

    crop_img = page_image[y0:y1, x0:x1]
    if crop_img.size == 0:
        return False

    temp_image_path = f"temp_table_page{page_idx}.png"
    cv2.imwrite(temp_image_path, cv2.cvtColor(crop_img, cv2.COLOR_RGB2BGR))

    p = docx_doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(temp_image_path, width=max_image_width)

    if os.path.exists(temp_image_path):
        os.remove(temp_image_path)

    return True


def process_table_row(docx_doc, row, section, page_width_pts):
    """
    Process a row of blocks as a table.
    """
    min_x_pt = min(b.bbox[0] for b in row)
    max_x_pt = max(b.bbox[2] for b in row)
    doc_left_margin_pt = section.left_margin.pt
    doc_right_margin_pt = section.right_margin.pt

    table_start_x = doc_left_margin_pt
    table_end_x = page_width_pts - doc_right_margin_pt
    table_total_width_pt = table_end_x - table_start_x

    num_cols = len(row)
    table = docx_doc.add_table(rows=1, cols=num_cols)
    table.autofit = False
    remove_table_borders(table)

    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    tbl = table._tbl
    tblPr = tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.append(tblPr)

    for e in tblPr.findall(qn("w:tblInd")):
        tblPr.remove(e)

    tblInd = OxmlElement("w:tblInd")
    tblInd.set(qn("w:w"), "0")
    tblInd.set(qn("w:type"), "dxa")
    tblPr.append(tblInd)

    block_widths = []
    block_positions = []
    for b in row:
        block_w = max(1.0, (b.bbox[2] - b.bbox[0]))
        block_widths.append(block_w)
        block_positions.append((b.bbox[0], b.bbox[2]))

    first_block_start = block_positions[0][0]
    last_block_end = block_positions[-1][1]
    total_block_span = last_block_end - first_block_start

    col_widths_pt = []
    if total_block_span > 0 and len(block_widths) > 0:
        for i, block_w in enumerate(block_widths):
            proportion = block_w / total_block_span
            col_width = proportion * table_total_width_pt
            col_widths_pt.append(max(1.0, col_width))

        current_total = sum(col_widths_pt)
        if current_total < table_total_width_pt:
            remaining = table_total_width_pt - current_total
            for i in range(len(col_widths_pt)):
                proportion = block_widths[i] / sum(block_widths) if sum(block_widths) > 0 else 1.0 / len(block_widths)
                col_widths_pt[i] += proportion * remaining
    else:
        col_width_per_col = table_total_width_pt / num_cols
        col_widths_pt = [col_width_per_col] * num_cols

    set_table_col_widths(table, col_widths_pt)

    for col_idx, block in enumerate(row):
        cell = table.rows[0].cells[col_idx]
        cell.text = ""

        if not block.elements:
            continue

        elems = block.elements
        spans = [{"bbox": e.bbox, "text": e.text, "element": e} for e in elems]
        spans = sorted(spans, key=lambda s: (s["bbox"][1], s["bbox"][0]))

        lines = []
        current_line = [spans[0]]
        y_tolerance_pt = 2.0

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

        for line in lines:
            p = cell.add_paragraph()
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

            for span in line:
                elem = span["element"]
                text_content = span["text"]
                if not text_content.endswith(" "):
                    text_content += " "

                run = p.add_run(text_content)
                run.font.name = "Times New Roman"

                if elem.font_size is not None:
                    rounded_size = round_font_size(elem.font_size)
                    run.font.size = Pt(rounded_size)

                if elem.font_flags is not None:
                    run.bold = (elem.font_flags & 16) != 0
                    run.italic = (elem.font_flags & 8) != 0

    return max(b.bbox[3] for b in row)


def process_text_block(
    docx_doc, block, block_type, first_title_processed,
    style_map, doc_left_margin_in, row, prev_row_y1, last_paragraph=None
):
    """
    Process a text block (title, plain text, captions, etc.).
    """
    if block_type == "title":
        if not first_title_processed:
            first_title_processed = True
        else:
            block_type = "section_header"

    style_info = style_map.get(block_type, {"style": "Normal"})
    if style_info is None:
        return None, block_type, first_title_processed, block.bbox[3], False

    x0_pdf, y0_pdf, x1_pdf, y1_pdf = block.bbox

    section = docx_doc.sections[0]
    try:
        doc_right_margin_in = section.right_margin.inches
    except Exception:
        doc_right_margin_in = section.right_margin.pt / 72.0
    page_width_in = section.page_width.pt / 72.0

    x0_in = x0_pdf / 72
    x1_in = x1_pdf / 72
    indent_from_margin_in = max(0.0, x0_in - doc_left_margin_in - (5.0 / 72.0))
    right_edge_in = page_width_in - doc_right_margin_in
    right_indent_from_margin_in = max(0.0, right_edge_in - x1_in - (5.0 / 72.0))

    should_merge = (last_paragraph is not None)

    style_name = style_info["style"]

    if should_merge and last_paragraph is not None:
        p = last_paragraph
    else:
        if style_name.startswith("Heading"):
            base_level = int(style_name.split()[-1])
            if block_type == "section_header":
                heading_text = getattr(block, "text", "") or ""
                heading_level = get_section_heading_level(heading_text, default_level=base_level)
            else:
                heading_level = base_level
            p = docx_doc.add_heading(level=heading_level)
        else:
            p = docx_doc.add_paragraph(style=style_name)

        p.paragraph_format.left_indent = Inches(indent_from_margin_in)
        p.paragraph_format.right_indent = Inches(right_indent_from_margin_in)

        if block == row[0] and prev_row_y1 > 0:
            vertical_gap = max(0, (y0_pdf - prev_row_y1))
            p.paragraph_format.space_before = Pt(vertical_gap)
        else:
            p.paragraph_format.space_before = Pt(0)

        p.paragraph_format.space_after = Pt(2)

        if block_type == "title":
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif block_type in ["figure_caption", "table_caption"]:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        elif block_type not in ["formula_caption"] and not style_name.startswith("Heading"):
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    if not block.elements:
        return p, block_type, first_title_processed, y1_pdf, should_merge

    span_to_block_idx = block.extra.get("span_to_block_idx")

    if span_to_block_idx is not None:
        text_block_groups: Dict[int, List[Tuple[TextElement, int]]] = {}

        span_to_original_order = block.extra.get("span_to_original_order")

        for elem_idx, elem in enumerate(block.elements):
            block_idx = span_to_block_idx.get(elem_idx, 0)
            if block_idx not in text_block_groups:
                text_block_groups[block_idx] = []

            if span_to_original_order and elem_idx in span_to_original_order:
                _, original_span_idx = span_to_original_order[elem_idx]
            else:
                original_span_idx = elem_idx

            text_block_groups[block_idx].append((elem, original_span_idx))

        sorted_block_indices = sorted(text_block_groups.keys())

        for group_idx, block_idx in enumerate(sorted_block_indices):
            group_with_order = sorted(text_block_groups[block_idx], key=lambda x: x[1])
            group = [elem for elem, _ in group_with_order]

            if group_idx > 0:
                p = docx_doc.add_paragraph(style=style_name)
                p.paragraph_format.left_indent = Inches(indent_from_margin_in)
                p.paragraph_format.right_indent = Inches(right_indent_from_margin_in)
                p.paragraph_format.space_after = Pt(2)
                if block_type == "title":
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif block_type in ["figure_caption", "table_caption"]:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                elif block_type not in ["formula_caption"] and not style_name.startswith("Heading"):
                    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

            for elem in group:
                text_content = elem.text
                if not text_content.endswith(" "):
                    text_content += " "
                run = p.add_run(text_content)
                run.font.name = "Times New Roman"
                if elem.font_size is not None:
                    rounded_size = round_font_size(elem.font_size)
                    run.font.size = Pt(rounded_size)
                if elem.font_flags is not None:
                    run.bold = (elem.font_flags & 16) != 0
                    run.italic = (elem.font_flags & 8) != 0
    else:
        font_sizes = [e.font_size for e in block.elements if e.font_size is not None]
        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12.0
        vertical_gap_threshold = avg_font_size * 1.5

        text_block_groups = []
        current_group = [block.elements[0]]

        for i in range(1, len(block.elements)):
            prev_elem = block.elements[i - 1]
            curr_elem = block.elements[i]

            vertical_gap = curr_elem.bbox[1] - prev_elem.bbox[3]

            if vertical_gap > vertical_gap_threshold:
                text_block_groups.append(current_group)
                current_group = [curr_elem]
            else:
                current_group.append(curr_elem)

        if current_group:
            text_block_groups.append(current_group)

        for group_idx, group in enumerate(text_block_groups):
            if group_idx > 0:
                p = docx_doc.add_paragraph(style=style_name)
                p.paragraph_format.left_indent = Inches(indent_from_margin_in)
                p.paragraph_format.right_indent = Inches(right_indent_from_margin_in)
                p.paragraph_format.space_after = Pt(2)
                if block_type == "title":
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif block_type in ["figure_caption", "table_caption"]:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                elif block_type not in ["formula_caption"] and not style_name.startswith("Heading"):
                    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

            for elem in group:
                text_content = elem.text
                if not text_content.endswith(" "):
                    text_content += " "
                run = p.add_run(text_content)
                run.font.name = "Times New Roman"
                if elem.font_size is not None:
                    rounded_size = round_font_size(elem.font_size)
                    run.font.size = Pt(rounded_size)
                if elem.font_flags is not None:
                    run.bold = (elem.font_flags & 16) != 0
                    run.italic = (elem.font_flags & 8) != 0

    return p, block_type, first_title_processed, y1_pdf, should_merge
