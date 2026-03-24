# PDF → DOCX Reconstruction Pipeline — Project Context

## 1. Project Overview

**Name:** AutoDoc (Đồ Án Môn Học — University Project)

**Goal:** A browser-based PDF toolkit with two tiers:
1. **PDF → DOCX Reconstruction** — Automatically convert multi-page PDF documents into editable DOCX files, preserving layout, formatting, and structure.
2. **PDF Operations** — Pure pymupdf transformations (merge, split, organize, crop, number pages) with no ML required.

---

### Feature 1 — PDF → DOCX Reconstruction

**What is preserved:**

| Aspect                  | Details                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| Document layout         | Columns, multi-column layouts, tables                            |
| Text formatting         | Font name, font size, bold, italic                               |
| Structural elements     | Headings (with inferred levels), figure/table captions, formulas |
| Images and tables       | Embedded images, table structures                                |
| Intentional page breaks | When a new top-level section starts mid-page                     |

### Feature 2 — PDF Operations (pure pymupdf, no ML)

| Operation       | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| Combine PDFs   | Merge multiple PDFs; user can reorder files before merging   |
| Split PDF      | Split by page ranges or even/odd pages                       |
| Organize Pages | Delete, rotate, extract, insert, or reorder pages             |
| Crop Pages     | Crop pages by margin or custom rectangular region             |
| Number Pages   | Add page numbers (position, format, font)                     |

### Tech stack

- **pymupdf** — PDF parsing, text extraction, rendering, all PDF operations
- **DocLayout-YOLO** (`juliozhao/DocLayout-YOLO-DocStructBench`) — Layout region detection (reconstruction only)
- **python-docx** — DOCX generation
- **OpenCV + Pillow** — Image cropping and processing
- **Streamlit** — Web UI

---

## 2. Project Structure

```
AutoDoc/
├── app.py                              # Streamlit web UI (tool hub)
├── requirements.txt                    # Core dependencies
├── .gitignore                          # Git ignore rules
├── DAN_Y_BAO_CAO_DAMH.md              # Project report draft
│
├── src/
│   ├── __init__.py                    # Package init (v1.1.0)
│   ├── pipeline.py                    # ★ PDFToDocxPipeline (ML reconstruction)
│   ├── extract_layout.py              # Pre-extracts PDF layout to JSON
│   ├── model_loader.py                # Loads DocLayout-YOLO from HuggingFace
│   │
│   ├── pdf_operations/               # ★ Pure pymupdf PDF tools (no ML)
│   │   ├── __init__.py
│   │   ├── combine.py                # Merge multiple PDFs
│   │   ├── split.py                  # Split by ranges / even-odd
│   │   ├── organize.py               # Delete, rotate, extract, insert, reorder
│   │   ├── crop.py                   # Crop pages (margins / custom region)
│   │   └── page_numbers.py           # Add / customize page numbering
│   │
│   ├── yolo/
│   │   ├── iou_matching.py            # IoU algorithm, matching, dataclasses
│   │   ├── pdf_utils.py              # PDF→image rendering + coordinate conversion
│   │   └── requirements.txt          # YOLO sub-dependencies
│   │
│   ├── docx_generator/
│   │   ├── __init__.py
│   │   └── processors.py             # Per-block-type DOCX writers
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── font_utils.py             # Font name cleaning, size rounding
│   │   ├── heading_utils.py          # Heading level inference from numbering
│   │   └── table_utils.py            # Table detection, border removal, grouping
│   │
│   └── *.ipynb                        # Development notebooks
│
├── data_layout/                       # Extracted layout metadata (auto-generated)
│   └── page_N/
│       ├── page_N_layout.json         # Text spans + image refs
│       ├── page_N_image.png           # Rendered page snapshot
│       └── images/img_K.{ext}        # Extracted embedded images
│
├── docx_file/                         # Output DOCX files (auto-generated)
├── runs/                              # Per-run working directories (Streamlit, auto-generated)
└── examples/                          # Sample PDF inputs
    └── Test.pdf
```

---

## 3. Pipeline Architecture — PDF → DOCX

The pipeline runs in **four stages** per page, orchestrated by `PDFToDocxPipeline` in `pipeline.py`. Only applies to the reconstruction tool — PDF operations are direct pymupdf transformations.

### Stage 0 — Layout Metadata Pre-extraction (`extract_layout.py`)

Before the main pipeline, `extract_pdf_layout()` writes one output directory per page:

```
data_layout/page_N/
  page_N_layout.json   ← text spans with full formatting metadata
  page_N_image.png     ← rendered page snapshot
  images/img_K.ext     ← extracted embedded images
```

**Per-page extraction:**

1. `page.get_pixmap(dpi=page_image_dpi)` → page snapshot PNG
2. `page.get_text("dict")` → iterates blocks → lines → spans, capturing:
   - `bbox`, `text`, `font_name`, `font_size`, `font_flags`, `color`
3. `page.get_image_info()` + `doc.extract_image(xref)` → saves embedded images
4. All written to `page_N_layout.json`

This decouples PDF parsing from YOLO/DOCX generation — reprocessing without re-parsing the PDF is possible.

### Stage 1 — YOLO Layout Detection (`pipeline.py`)

1. Render page to PIL RGB image at configurable DPI (default 300):
   ```python
   render_result = render_page_to_image(page, dpi=self.dpi)
   # Returns: PageRenderResult(image=PIL.Image, scale_x, scale_y)
   ```
2. Run DocLayout-YOLO:
   ```python
   results = self.model.predict(page_image, imgsz=1024, conf=0.2, device="cpu")
   ```
3. Convert YOLO bboxes from **image space → PDF point space**:
   ```python
   def image_bbox_to_pdf_bbox(image_bbox, scale_x, scale_y):
       return (x0/scale_x, y0/scale_y, x1/scale_x, y1/scale_y)
   ```

**Detected layout classes:**

| Class             | Meaning             |
| ----------------- | ------------------- |
| `title`           | Document/page title |
| `section_header`  | Section heading     |
| `plain text`      | Body paragraph      |
| `abandon`         | Garbage/ignore      |
| `figure`          | Image region        |
| `figure_caption`  | Caption under image |
| `table`           | Table region        |
| `table_caption`   | Table caption       |
| `table_footnote`  | Table footnote      |
| `isolate_formula` | Math formula        |
| `formula_caption` | Formula caption     |

### Stage 2 — IoU Matching (`yolo/iou_matching.py`)

This is the core link between PyMuPDF text spans and YOLO-detected regions.

**Bounding boxes** are `(x0, y0, x1, y1)` in PDF point coordinates.

**IoU formula:**

```python
def iou(b1, b2):
    inter_x0 = max(b1[0], b2[0])
    inter_y0 = max(b1[1], b2[1])
    inter_x1 = min(b1[2], b2[2])
    inter_y1 = min(b1[3], b2[3])
    inter_area = max(0, inter_x1-inter_x0) * max(0, inter_y1-inter_y0)
    area1 = (b1[2]-b1[0]) * (b1[3]-b1[1])
    area2 = (b2[2]-b2[0]) * (b2[3]-b2[1])
    return inter_area / (area1 + area2 - inter_area)
```

**Matching algorithm** (`match_blocks_to_layout`):

1. Convert PyMuPDF JSON → `TextBlock` objects (block-level bbox + list of `TextElement` spans)
2. Convert YOLO detections → `LayoutRegion` objects
3. For each `TextBlock`, compute IoU against every `LayoutRegion`; assign to the region with the **highest IoU** if IoU ≥ threshold (0.1)
4. Multiple PyMuPDF blocks can be assigned to one YOLO region
5. All spans from assigned blocks are collected, then **sorted by reading order** (top-to-bottom, left-to-right)
6. Output: `LayoutBlock` objects containing YOLO class name, merged bbox, full text, and all `TextElement` spans with formatting

**Images and tables** are matched separately:

- Images → `figure` regions (IoU threshold 0.3)
- Tables → `table` regions (IoU threshold 0.9 for deduplication)

### Stage 3 — DOCX Generation (`docx_generator/processors.py`)

**Block routing:**

| Block Type                         | DOCX Action                                            |
| ---------------------------------- | ------------------------------------------------------ |
| `figure`                           | Insert image centered (`run.add_picture()`)            |
| `table`                            | Crop from page image, insert as centered image         |
| `abandon`                          | Skip entirely                                          |
| `title`                            | First occurrence → Title style; subsequent → Heading 1 |
| `section_header`                   | Heading N (depth inferred from numbering pattern)       |
| `plain text`                       | Normal paragraph (justified)                           |
| `figure_caption` / `table_caption` | Caption style (left-aligned)                           |
| `isolate_formula`                  | Normal style                                           |
| `table_footnote`                   | Intense Quote style                                    |

**Text formatting** (from `TextElement` spans):

```python
run.font.name  = clean_font_name(elem.font_name)   # strip suffixes
run.font.size = Pt(round_font_size(elem.font_size)) # quantize to 0.5pt steps
run.bold      = (elem.font_flags & 16) != 0         # flag 16 = bold
run.italic    = (elem.font_flags & 8)  != 0         # flag 8  = italic
```

**Paragraph formatting:**

- Left/right indent: distance from page margin to block edges (in PDF points)
- Alignment: titles = centered, captions = left, body = justified
- Space before: calculated from vertical gap between consecutive rows
- Space after: 2pt fixed

**Block merging:** If the previous block's text ends with a space (PDF word-wrapping split), or if the previous block doesn't end with sentence-ending punctuation and the current block starts lowercase, they are merged.

**Table row grouping:** Blocks in the same horizontal row (within 10pt y-tolerance) that are all pairwise "same line" + "horizontally separated" are assembled into a DOCX table with proportional column widths.

**Intentional page breaks:** Inserted when (a) the first block on the new page is a top-level section (Heading 1), and (b) the previous page's last content ended ≥ 72pt from the bottom.

**Footers:** All pages get a centered page number via `w:fldChar` XML injection.

---

## 4. Pipeline Architecture — PDF Operations

All PDF operations live in `src/pdf_operations/` and are **pure pymupdf** transformations — no YOLO model, no layout detection, no DOCX generation.

### Combine PDFs (`combine.py`)

```python
combine_pdfs(pdf_paths: List[Path], output_path: Path) -> str
```

- Opens each source PDF with `pymupdf.open()`
- Inserts pages sequentially using `writer.insert_pdf(reader)`
- Saves with `garbage=4, deflate=True, clean=True` for a compact output
- Supports an optional `delete_sources=True` flag to remove originals after merge

### Split PDF (`split.py`) — _planned_

```python
split_by_ranges(pdf_path: Path, ranges: List[Range], output_dir: Path) -> List[Path]
split_even_odd(pdf_path: Path, output_dir: Path) -> Tuple[Path, Path]
```

- Page ranges: `List[Tuple[int, int]]` (0-indexed, inclusive)
- Creates a sub-directory per split output

### Organize Pages — Implemented in `app.py` (not `organize.py`)

All Organize Pages logic is implemented directly in `app.py` within `_tool_organize_pages`, with supporting functions `_apply_delete_operation`, `_build_final_output`, `_build_extracted_pdf`, `_render_page_grid`, and `_render_single_page`. Key behaviors:

| Feature | Description |
|---------|-------------|
| Delete pages | Rebuilds `base.pdf` excluding selected pages; thumbnails rerender to show new count |
| Rotate pages | Stores per-page rotation in `org_rotations` dict; applied in `_build_final_output` |
| Extract pages | Builds a new PDF from selected pages; provided as download without modifying `base.pdf` |
| Insert pages | Schedules insertions via slot-based UI; merged into final output in `_build_final_output` |
| View thumbnails | Renders each page at 72 DPI as base64-encoded PNG inline HTML with rotation applied |

### Crop Pages (`crop.py`) — _planned_

```python
crop_by_margins(pdf_path: Path, dest_path: Path, top, bottom, left, right: float)
crop_by_rect(pdf_path: Path, dest_path: Path, rect: Tuple[float, float, float, float])
```

- Margins: float values in PDF point units
- Rect: `(x0, y0, x1, y1)` in PDF point coordinates
- Supports per-page or global crop settings

### Number Pages (`page_numbers.py`) — _planned_

```python
add_page_numbers(
    pdf_path: Path,
    dest_path: Path,
    position: str = "bottom-center",   # top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
    format: str = "1",                 # "1", "-1-", Roman numerals (I, II, III...)
    start_at: int = 1,
    font_size: float = 12,
    font_name: str = "helv",           # pymupdf built-in font name
)
```

- Uses `page.insert_text()` or `page.insert_widget()` for reliable text placement
- Supports per-page override (e.g., skip cover page)

---

## 5. Key Modules

| File                           | Classes / Functions                                                                                                          | Responsibility                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pipeline.py`                  | `PDFToDocxPipeline`                                                                                                          | Orchestrates all 4 stages; manages per-page state; handles page breaks |
| `extract_layout.py`            | `extract_pdf_layout`, `_get_spans`, `_save_metadata`                                                                         | Pre-extracts PDF to per-page JSON metadata                           |
| `model_loader.py`              | `ModelConfig`, `load_doclayout_model`                                                                                        | Downloads and instantiates DocLayout-YOLO from HF Hub                |
| `yolo/pdf_utils.py`            | `render_page_to_image`, `pdf_bbox_to_image_bbox`, `image_bbox_to_pdf_bbox`, `PageRenderResult`                               | Rendering + coordinate system bridging                               |
| `yolo/iou_matching.py`         | `iou`, `LayoutRegion`, `TextBlock`, `TextElement`, `LayoutBlock`, `match_blocks_to_layout`                                   | IoU math, data models, matching algorithm                            |
| `docx_generator/processors.py` | `process_text_block`, `process_figure_block`, `process_table_block`, `process_table_row`, `should_merge_with_previous_block` | Per-block-type DOCX writing                                          |
| `utils/font_utils.py`          | `clean_font_name`, `round_font_size`                                                                                         | Font normalization                                                   |
| `utils/heading_utils.py`       | `get_section_heading_level`                                                                                                  | Heading depth from numbering (e.g., `"1.2.3"` → level 3)            |
| `utils/table_utils.py`         | `is_same_line`, `horizontally_separated`, `remove_table_borders`, `set_table_col_widths`, `is_bbox_contained`                | Table detection and DOCX styling                                     |
| `pdf_operations/combine.py`    | `combine_pdfs`, `combine_pdfs_in_place`                                                                                      | Merge multiple PDFs into one (pure pymupdf)                          |
| `pdf_operations/split.py`       | `split_by_ranges`, `split_even_odd`                                                                                          | Split PDF by page ranges or even/odd pages (pure pymupdf)            |
| `pdf_operations/organize.py`     | `delete_pages`, `rotate_pages`, `extract_pages`, `insert_pages`, `reorder_pages`                                            | Standalone page-level PDF mutation functions (pure pymupdf); not used by the web UI which uses inline pymupdf calls in `app.py` |
| `pdf_operations/crop.py`        | `crop_by_margins`, `crop_by_rect`                                                                                            | Crop pages by margin or rectangular region (pure pymupdf)            |
| `pdf_operations/page_numbers.py`| `add_page_numbers`                                                                                                            | Add page numbers with position/format options (pure pymupdf)         |
| `app.py`                       | `main`, `_tool_reconstruct`, `_tool_combine_files`, `_tool_organize_pages`, `_apply_delete_operation`, `_build_final_output`, `_build_extracted_pdf`, `_render_page_grid`, `_render_single_page` | Streamlit web interface — tool hub with sidebar navigation; all Organize Pages logic |

---

## 6. Data Flow

### PDF → DOCX (reconstruction)

```
PDF file
  │
  ▼
extract_layout.py (Stage 0)
  │  page.get_text("dict")      → text blocks + spans (JSON)
  │  page.get_image_info()       → embedded images
  │  page.get_pixmap()           → rendered page PNG
  ▼
data_layout/page_N/page_N_layout.json
  │
  ▼
PDFToDocxPipeline.process_pdf()
  │
  ├─ Per page:
  │   │
  │   ├─ 1. render_page_to_image()       → PIL RGB + (scale_x, scale_y)
  │   │
  │   ├─ 2. model.predict()              → YOLO detections (image-space bboxes)
  │   │
  │   ├─ 3. image_bbox_to_pdf_bbox()    → YOLO bboxes in PDF points
  │   │
  │   ├─ 4. Load page_N_layout.json
  │   │
  │   ├─ 5. text_blocks_from_pdf_elements()  → List[TextBlock]
  │   │
  │   ├─ 6. layout_regions_from_detections() → List[LayoutRegion]
  │   │
  │   ├─ 7. match_blocks_to_layout()     → List[LayoutBlock] (IoU ≥ 0.1)
  │   │
  │   ├─ 8. Match images to 'figure' regions (IoU ≥ 0.3)
  │   │      Match tables to 'table' regions (IoU > 0.9 dedup)
  │   │
  │   ├─ 9. Filter out blocks inside image/table regions
  │   │
  │   ├─ 10. Sort blocks: top-to-bottom, left-to-right
  │   │
  │   ├─ 11. Group into rows (y-tolerance 10pt)
  │   │
  │   ├─ 12. Detect intentional page breaks
  │   │
  │   └─ 13. Per row:
  │           ├─ Table row pattern  → process_table_row()
  │           ├─ 'figure' type     → process_figure_block() → add_picture()
  │           ├─ 'table' type       → process_table_block() → crop & insert
  │           └─ Text blocks        → process_text_block() → runs
  │
  ▼
DOCX file (with headers, footers, page numbers)
```

### PDF Operations (combine, split, organize, crop, number pages)

**Combine PDFs** follows the simple pattern:
```
Upload PDF(s) → Save to runs/{run_id}/ → Call pdf_operations function → Save output → Provide download
```

**Organize Pages** is implemented in `app.py` (not `pdf_operations/organize.py`). It uses a per-run directory with stateful session management:
```
Upload PDF → runs/organize_{run_id}/base.pdf written on every rerun
  │
  ├─ Per-page rotation → stored in org_rotations → applied in _build_final_output
  ├─ Delete → base.pdf rebuilt immediately → _build_final_output skips re-deleting
  ├─ Extract → new PDF built from selected pages → download only, no base.pdf change
  └─ Insert → scheduled in org_insertions → merged into final output in _build_final_output
```

No layout extraction, no YOLO, no DOCX generation.

---

## 7. Dependencies

| Package           | Version  | Purpose                                 |
| ----------------- | -------- | --------------------------------------- |
| `pymupdf`         | ≥ 1.23.0 | PDF reading, text extraction, rendering, all PDF operations |
| `python-docx`     | ≥ 1.1.0  | DOCX generation                         |
| `numpy`           | ≥ 1.24.0 | Image array handling                    |
| `streamlit`       | ≥ 1.28.0 | Web UI                                  |
| `torch`           | ≥ 2.0.0  | YOLO runtime (reconstruction only)      |
| `ultralytics`     | ≥ 8.0.0  | YOLO framework (reconstruction only)    |
| `doclayout-yolo`  | ≥ 0.0.3  | DocLayout-YOLO model (reconstruction only) |
| `opencv-python`   | ≥ 4.8.0  | Image cropping                          |
| `Pillow`          | ≥ 10.0.0 | Image processing                        |
| `huggingface_hub` | ≥ 0.20.0 | Model download from HF Hub (reconstruction only) |

**Model:** `juliozhao/DocLayout-YOLO-DocStructBench/doclayout_yolo_docstructbench_imgsz1024.pt`

- Downloaded automatically from Hugging Face Hub on first run
- Only used by the PDF → DOCX reconstruction tool

---

## 8. Design Decisions & Notable Patterns

### Two-phase execution (reconstruction only)

Layout metadata is pre-extracted to JSON (`extract_layout.py`), then the pipeline reads from it. This decouples PDF parsing from YOLO/DOCX generation and enables reprocessing without re-parsing.

### Coordinate bridging (reconstruction only)

PDF points ↔ image pixels are reconciled via computed scale factors (`scale_x = image_width / page_width`, `scale_y = image_height / page_height`). This allows any render DPI without changing the matching logic.

### IoU at block level (not span level) (reconstruction only)

PyMuPDF text blocks have larger, more stable bboxes than individual spans, yielding better IoU scores against YOLO regions. Spans are only used after matching for formatting details.

### Title → Heading promotion (reconstruction only)

The first `title`-classified block becomes the DOCX "Title" style; all subsequent `title` blocks are demoted to "Heading 1" to handle multi-section documents.

### Intentional page break detection (reconstruction only)

Rather than inserting a page break on every page, the pipeline only does so when: (a) the first block on the new page is a top-level section (Heading 1), and (b) the previous page's content ended ≥ 72pt from the bottom.

### Font normalization (reconstruction only)

PDF font names have variant suffixes stripped (e.g., `"TimesNewRomanPSMT"` → `"Times New Roman"`); sizes are quantized to 0.5pt steps to match Word's discrete font size UI.

### Block merging (reconstruction only)

The pipeline detects when PyMuPDF split a logical paragraph across two blocks (common with PDF word-wrapping) and merges them back, preserving the full natural-language text.

### Fallback chain for images (reconstruction only)

Images are first sought from pre-extracted files (`images/img_K.ext`); if missing, the pipeline falls back to cropping directly from the rendered page image using the matched bbox.

### PDF operations are pure pymupdf

All tools in `pdf_operations/` use only `pymupdf.open()`, `page.insert_pdf()`, `page.rotate()`, `page.set_crop_box()`, `page.insert_text()`, and `doc.save()`. No YOLO, no ML models, no layout detection. This keeps them fast, lightweight, and dependency-light compared to the reconstruction pipeline.

### Streamlit runs directory

Every user action in the web UI creates a unique `runs/{run_id}/` directory containing the input files and output. Directories are not cleaned up automatically but are gitignored — each run is independent and disposable.

### .gitignore covers two categories of auto-generated output

- **Per-run output** (`runs/`) — heavy, machine-specific temporary files per Streamlit session
- **Cached metadata** (`data_layout/`, `docx_file/`) — large generated files that don't belong in the repo
- **Model cache** (`.huggingface/`, `.cache/`) — ~300 MB YOLO model, each machine downloads its own copy

### Organize Pages state management (`app.py`)

All Organize Pages logic lives in `app.py` (`_tool_organize_pages`), not in `src/pdf_operations/organize.py`. The tool uses a **per-run directory** approach with the following state management patterns:

**File identity detection** — When the file uploader is cleared (`uploaded is None`), the old run is abandoned by resetting `org_run_id` to a fresh UUID. Additionally, a content hash (`MD5`) of the uploaded file is compared against the last-known hash to detect when a file with the same name/size but different content is re-uploaded. Both conditions trigger a full state reset.

**`base.pdf` always overwritten** — Unlike the original buggy pattern that guarded the write with `if not pdf_path.exists()`, the file is always written on every rerun. Because `run_id` resets whenever state resets, a fresh directory and fresh `base.pdf` are always created on a new run.

**Session state keys** (all prefixed `org_`):

| Key | Type | Purpose |
|-----|------|---------|
| `org_last_file` | `str \| None` | Uploaded file name for change detection |
| `org_last_hash` | `str \| None` | MD5 hash of uploaded bytes for content-level change detection |
| `org_run_id` | `str` | Unique ID for the current run directory |
| `org_selected` | `set[int]` | Indices of currently selected pages |
| `org_rotations` | `dict[int, int]` | Per-page rotation in degrees (0/90/180/270) |
| `org_insertions` | `list[tuple]` | Scheduled insertions: `(slot_index, bytes, filename)` |
| `org_mode` | `"view" \| "insert"` | Current tool mode |
| `org_pending_action` | `str \| None` | Toolbar button action to apply on next render (`"rotate_left"`, `"rotate_right"`, `"toggle_insert"`, `"extract"`, `"delete"`) |
| `insert_file_slot_*` | widget keys | Per-slot file uploader keys in Streamlit session state |

**Pending action pattern** — Toolbar buttons use `on_click` to set a string flag (`org_pending_action`) rather than directly mutating session state. The script body reads and `pop()`s this flag once per render, ensuring all mutations happen in a single controlled location and preventing accidental double-application during Streamlit's widget re-evaluation.

**Delete is not baked into `base.pdf`** — `_apply_delete_operation` writes the deletion result to `base.pdf` immediately (so thumbnails reflect the new page count after a rerun), but `_build_final_output` does **not** re-apply deletions. This is intentional: it avoids a double-operation bug where intermediate reruns would cause `_build_final_output` to process an already-modified `base.pdf`. Rotations, however, are baked into `base.pdf` by `_apply_delete_operation` only if the user clicks Save & Download **without** first clicking the toolbar Delete button — a known limitation where `_build_final_output` applies rotations on top of the baked-in ones.

**Build final output** (`_build_final_output`) — This is the single place where all remaining operations (rotations from `org_rotations`, insertions from `org_insertions`) are applied in one pass into the final output PDF. Rotations are applied via `doc[idx].set_rotation()` before page extraction.
