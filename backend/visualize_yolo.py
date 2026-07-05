"""
Script to visualize YOLO bounding boxes on a specific PDF page.
Applies YOLO model on the entire document (similar to the pipeline) but visualizes a specified page range.
"""

import sys
import os
import cv2
import numpy as np
import pymupdf
import concurrent.futures

# Ensure we can import from src
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.model_loader import load_doclayout_model, ModelConfig
from src.yolo.pdf_utils import render_page_to_image

# ==========================================
# CONFIGURATION VARIABLES
# ==========================================
PDF_PATH = r"D:\GR2\AutoDoc\Test.pdf"  # Update with your PDF path
START_PAGE = 1  # 1-indexed start page number
END_PAGE = 33    # 1-indexed end page number (inclusive)
OUTPUT_PREFIX = "yolo_output"
BATCH_SIZE = 1  # Number of pages to process at once during inference (OpenVINO model is compiled for batch=1)

# Color map for different classes (BGR format for OpenCV)
# OpenCV uses Blue, Green, Red
COLOR_MAP = {
    "title": (255, 0, 0),        # Blue
    "plain text": (0, 255, 0),   # Green
    "figure": (0, 0, 255),       # Red
    "table": (42, 42, 165),      # Brown
    "section_header": (0, 165, 255), # Orange
    "figure_caption": (200, 0, 200), # Purple
    "table_caption": (200, 0, 200),  # Purple
    "table_footnote": (255, 255, 0), # Cyan
    "isolate_formula": (255, 0, 255),# Magenta
    "formula_caption": (128, 128, 0),# Teal
    "abandon": (128, 128, 128),  # Gray
}
DEFAULT_COLOR = (255, 255, 255)  # White (changed from Yellow so new colors stand out)

def main():
    if not os.path.exists(PDF_PATH):
        print(f"Error: PDF not found at {PDF_PATH}")
        return

    print("Loading YOLO model...")
    model = load_doclayout_model()

    print(f"Opening PDF: {PDF_PATH}")
    pdf_doc = pymupdf.open(PDF_PATH)
    
    total_pages = len(pdf_doc)
    
    start_idx = START_PAGE - 1
    end_idx = END_PAGE - 1
    
    if start_idx < 0 or end_idx >= total_pages or start_idx > end_idx:
        print(f"Error: Page range {START_PAGE}-{END_PAGE} is out of bounds (1-{total_pages}) or invalid.")
        return

    print(f"Rendering all {total_pages} pages to images (this may take a moment)...")
    
    def _render_page(p_idx):
        page = pdf_doc[p_idx]
        res = render_page_to_image(page, dpi=150)
        return p_idx, np.array(res.image)
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as executor:
        futures = [executor.submit(_render_page, i) for i in range(total_pages)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
    results.sort(key=lambda x: x[0])
    page_images = [r[1] for r in results]
    
    print("Running YOLO inference on entire document in batches...")
    all_yolo_results = []
    
    for i in range(0, len(page_images), BATCH_SIZE):
        batch = page_images[i:i+BATCH_SIZE]
        print(f"  Processing batch {i//BATCH_SIZE + 1} ({len(batch)} pages)...")
        yolo_results = model.predict(
            batch,
            imgsz=ModelConfig.INPUT_SIZE,
            conf=ModelConfig.CONFIDENCE_THRESHOLD,
            device=ModelConfig.DEVICE,
            verbose=False
        )
        if not isinstance(yolo_results, list):
            yolo_results = [yolo_results]
        all_yolo_results.extend(yolo_results)

    print(f"Visualizing results for pages {START_PAGE} to {END_PAGE}...")
    
    FALLBACK_NAMES = {
        0: "title", 1: "plain text", 2: "abandon", 3: "figure",
        4: "figure_caption", 5: "table", 6: "table_caption",
        7: "table_footnote", 8: "isolate_formula", 9: "formula_caption"
    }

    for idx in range(start_idx, end_idx + 1):
        page_num = idx + 1
        print(f"  Processing visualization for page {page_num}...")
        
        target_img_rgb = page_images[idx]
        target_results = all_yolo_results[idx]
        
        img_bgr = cv2.cvtColor(target_img_rgb, cv2.COLOR_RGB2BGR)
        
        names = target_results.names or getattr(model, "names", None) or FALLBACK_NAMES
        boxes = target_results.boxes.xyxy.cpu().numpy()
        class_ids = target_results.boxes.cls.cpu().numpy().astype(int)
        
        for (x0, y0, x1, y1), cid in zip(boxes, class_ids):
            class_name = str(names.get(int(cid), f"class_{cid}"))
            color = COLOR_MAP.get(class_name, DEFAULT_COLOR)
            
            cv2.rectangle(
                img_bgr, 
                (int(x0), int(y0)), 
                (int(x1), int(y1)), 
                color, 
                thickness=2
            )
                
        output_path = f"{OUTPUT_PREFIX}_page_{page_num}.png"
        cv2.imwrite(output_path, img_bgr)
        print(f"  -> Saved {output_path}")
        
    print("Done!")

if __name__ == "__main__":
    main()
