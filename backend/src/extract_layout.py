"""
Extract per-page layout metadata from a PDF into the same JSON format used by the pipeline.

This module is a code version of the logic in `src/extract_data_layout.ipynb`:
- Save `page_{i}_layout.json` containing text blocks (with spans) and image blocks (with bbox/ext/xref)
- Save rendered page images (optional, currently used for debugging/inspection)
- Save extracted images into `page_{i}/images/img_{k}.{ext}`
"""

from __future__ import annotations

import json
import os
import time
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

import pymupdf


def _get_spans(page) -> List[Dict[str, Any]]:
    """
    Extract span-level text metadata grouped by PyMuPDF text blocks.

    Output schema matches the existing `data_layout/page_i/page_i_layout.json`:
    - type: "text"
    - bbox: [x0, y0, x1, y1]
    - content: concatenated text
    - spans: list of spans with text/font_name/font_size/font_flags/color/bbox
    """
    layout_data: List[Dict[str, Any]] = []
    page_dict = page.get_text("dict")

    for block in page_dict.get("blocks", []):
        # 0: text, 1: image (embedded and inline)
        if block.get("type") != 0:
            continue

        block_text = ""
        spans_data: List[Dict[str, Any]] = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                block_text += span.get("text", "")
                spans_data.append(
                    {
                        "text": span.get("text", ""),
                        "font_name": span.get("font"),
                        "font_size": span.get("size"),
                        "font_flags": span.get("flags"),
                        "color": span.get("color"),
                        "bbox": span.get("bbox"),
                    }
                )

        layout_data.append(
            {
                "type": "text",
                "bbox": block.get("bbox"),
                "content": block_text.strip(),
                "spans": spans_data,
            }
        )

    return layout_data


def _save_metadata(output_dir: str, page_index: int, layout_data: List[Dict[str, Any]]) -> str:
    page_folder = os.path.join(output_dir, f"page_{page_index}")
    os.makedirs(page_folder, exist_ok=True)
    json_path = os.path.join(page_folder, f"page_{page_index}_layout.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(layout_data, f, ensure_ascii=False, indent=2)
    return json_path


def _save_image_file(
    output_dir: str,
    image_bytes: bytes,
    ext: str,
    page_index: int,
    image_index: int,
) -> str:
    page_folder = os.path.join(output_dir, f"page_{page_index}", "images")
    os.makedirs(page_folder, exist_ok=True)
    file_path = os.path.join(page_folder, f"img_{image_index}.{ext}")
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    return file_path


def _save_page_as_pixmap(output_dir: str, page, page_index: int, dpi: int = 300) -> str:
    page_pixmap = page.get_pixmap(dpi=dpi)
    page_folder = os.path.join(output_dir, f"page_{page_index}")
    os.makedirs(page_folder, exist_ok=True)
    file_path = os.path.join(page_folder, f"page_{page_index}_image.png")
    page_pixmap.save(file_path)
    return file_path


def extract_pdf_layout(
    pdf_path: str,
    output_dir: str,
    page_image_dpi: int = 300,
    inline_image_dpi: int = 600,
    start_page: int = 0,
    end_page: Optional[int] = None,
) -> str:
    """
    Extract layout metadata for a PDF and write results into `output_dir`.

    Args:
        pdf_path: Path to PDF file.
        output_dir: Output folder to create page_{i}/... structure.
        page_image_dpi: DPI used to render full pages (for inspection/debug).
        inline_image_dpi: DPI used to extract inline images via clipping.
        start_page: First page index (0-based).
        end_page: Last page index (inclusive). None means all pages.

    Returns:
        output_dir
    """
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)

    total_pages = len(doc)
    if end_page is None:
        end_page = total_pages - 1
    else:
        end_page = min(end_page, total_pages - 1)

    start_time = time.time()
    for page_index in range(start_page, end_page + 1):
        page_start = time.time()
        page = doc[page_index]
        layout_data: List[Dict[str, Any]] = []

        # Save page image (keeps parity with existing workflow)
        t_img = time.time()
        _save_page_as_pixmap(output_dir, page, page_index, dpi=page_image_dpi)
        logger.info(f"[Timing] Page {page_index} _save_page_as_pixmap took: {time.time() - t_img:.4f}s")

        # Text blocks + spans
        t_spans = time.time()
        layout_data.extend(_get_spans(page))
        logger.info(f"[Timing] Page {page_index} _get_spans took: {time.time() - t_spans:.4f}s")

        # Image blocks (embedded + inline)
        t_images = time.time()
        image_blocks = page.get_image_info()
        for image_index, image_block in enumerate(image_blocks):
            bbox = image_block.get("bbox")
            xref = image_block.get("xref", image_block.get("image"))

            if xref:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]
            else:
                pix = page.get_pixmap(clip=pymupdf.Rect(bbox), dpi=inline_image_dpi)
                image_bytes = pix.tobytes("png")
                ext = "png"

            _save_image_file(output_dir, image_bytes, ext, page_index, image_index)

            layout_data.append(
                {
                    "type": "image",
                    "bbox": bbox,
                    "xref": xref,
                    "ext": ext,
                }
            )

        logger.info(f"[Timing] Page {page_index} image extraction took: {time.time() - t_images:.4f}s")

        t_meta = time.time()
        _save_metadata(output_dir, page_index, layout_data)
        logger.info(f"[Timing] Page {page_index} _save_metadata took: {time.time() - t_meta:.4f}s")
        logger.info(f"[Timing] Page {page_index} TOTAL took: {time.time() - page_start:.4f}s")

    logger.info(f"[Timing] Total extract_pdf_layout took: {time.time() - start_time:.4f}s")
    return output_dir
