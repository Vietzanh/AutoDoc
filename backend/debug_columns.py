"""Diagnostic: trace column detection and reading order on the broken PDF."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import math
import pymupdf
from src.extract_layout import _get_spans
from src.model_loader import load_doclayout_model, ModelConfig
from src.yolo.iou_matching import (
    layout_regions_from_detections, text_blocks_from_pdf_elements,
    match_blocks_to_layout, LayoutBlock,
)
from src.yolo.pdf_utils import image_bbox_to_pdf_bbox, render_page_to_image
from src.pipeline import _detect_columns, _sort_blocks_by_reading_order, _assign_block_column
import numpy as np

PDF_PATH = r"D:\GR2\AutoDoc\test_data\input\3 page.pdf"

# Find the PDF - try a few locations
for path in [PDF_PATH, r"D:\GR2\AutoDoc\3 page.pdf"]:
    if os.path.exists(path):
        PDF_PATH = path
        break

# Check if there's any PDF in common locations
if not os.path.exists(PDF_PATH):
    # Search for it
    for root, dirs, files in os.walk(r"D:\GR2\AutoDoc"):
        for f in files:
            if f == "3 page.pdf":
                PDF_PATH = os.path.join(root, f)
                break
        if os.path.exists(PDF_PATH):
            break

if not os.path.exists(PDF_PATH):
    print("ERROR: Cannot find '3 page.pdf'. Please provide the source PDF path.")
    sys.exit(1)

print(f"Using PDF: {PDF_PATH}")
pdf_doc = pymupdf.open(PDF_PATH)
model = load_doclayout_model()

for page_idx in range(min(2, len(pdf_doc))):  # Just first 2 pages
    page = pdf_doc[page_idx]
    page_width = page.rect.width
    page_height = page.rect.height
    print(f"\n{'='*80}")
    print(f"PAGE {page_idx}  (width={page_width:.1f}, height={page_height:.1f})")
    print(f"{'='*80}")

    # Extract layout
    pdf_elements = _get_spans(page)
    
    # YOLO inference
    res = render_page_to_image(page, dpi=300)
    img = np.array(res.image)
    yolo_results = model.predict([img], imgsz=ModelConfig.INPUT_SIZE, conf=ModelConfig.CONFIDENCE_THRESHOLD, device=ModelConfig.DEVICE, verbose=False)
    
    r = yolo_results[0]
    boxes = r.boxes.xyxy.cpu().numpy()
    scores = r.boxes.conf.cpu().numpy()
    class_ids = r.boxes.cls.cpu().numpy().astype(int)
    names = r.names or model.names
    
    det_dicts = []
    for (x0, y0, x1, y1), score, cid in zip(boxes, scores, class_ids):
        pdf_bbox = image_bbox_to_pdf_bbox((float(x0), float(y0), float(x1), float(y1)), res.scale_x, res.scale_y)
        det_dicts.append({
            "bbox": pdf_bbox,
            "score": float(score),
            "class_id": int(cid),
            "class_name": str(names.get(int(cid), f"class_{cid}")),
        })
    
    text_blocks = text_blocks_from_pdf_elements(pdf_elements)
    layout_regions = layout_regions_from_detections(det_dicts)
    layout_blocks = match_blocks_to_layout(text_blocks, layout_regions, iou_threshold=0.1)
    
    # Show all blocks before sorting
    print(f"\n--- All layout blocks (before sorting, {len(layout_blocks)} total) ---")
    for i, b in enumerate(sorted(layout_blocks, key=lambda b: (b.bbox[1], b.bbox[0]))):
        w = b.bbox[2] - b.bbox[0]
        text = (b.text or "")[:80].encode('ascii', 'replace').decode('ascii')
        print(f"  [{i:2d}] type={b.block_type:20s} bbox=({b.bbox[0]:6.1f},{b.bbox[1]:6.1f},{b.bbox[2]:6.1f},{b.bbox[3]:6.1f}) w={w:6.1f} text={text}")
    
    # Column detection
    col_bounds = _detect_columns(layout_blocks, page_width)
    if col_bounds:
        print(f"\n--- Column boundaries: {[(round(s,1), round(e,1)) for s,e in col_bounds]} ---")
        for i, b in enumerate(sorted(layout_blocks, key=lambda b: (b.bbox[1], b.bbox[0]))):
            col = _assign_block_column(b, col_bounds, page_width)
            label = f"COL-{col}" if col >= 0 else "BREAKER"
            text = (b.text or "")[:60].encode('ascii', 'replace').decode('ascii')
            print(f"  [{i:2d}] {label:8s} type={b.block_type:15s} y0={b.bbox[1]:6.1f} text={text}")
        
        # Show reading order
        sorted_blocks = _sort_blocks_by_reading_order(layout_blocks, col_bounds, page_width)
        print(f"\n--- Reading order (after sort) ---")
        for i, b in enumerate(sorted_blocks):
            col = _assign_block_column(b, col_bounds, page_width)
            label = f"COL-{col}" if col >= 0 else "BREAKER"
            text = (b.text or "")[:60].encode('ascii', 'replace').decode('ascii')
            print(f"  [{i:2d}] {label:8s} type={b.block_type:15s} y0={b.bbox[1]:6.1f} text={text}")
    else:
        print("\n--- Single-column detected ---")

print("\nDone.")
