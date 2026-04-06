from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


BBox = Tuple[float, float, float, float]


# Compute IoU between two axis-aligned bounding boxes
def iou(b1: BBox, b2: BBox) -> float:
    """
    b1, b2 : tuple(float, float, float, float)
        (x0, y0, x1, y1)
    """
    x0_1, y0_1, x1_1, y1_1 = b1
    x0_2, y0_2, x1_2, y1_2 = b2

    inter_x0 = max(x0_1, x0_2)
    inter_y0 = max(y0_1, y0_2)
    inter_x1 = min(x1_1, x1_2)
    inter_y1 = min(y1_1, y1_2)

    inter_w = max(0.0, inter_x1 - inter_x0)
    inter_h = max(0.0, inter_y1 - inter_y0)
    inter_area = inter_w * inter_h
    if inter_area <= 0.0:
        return 0.0

    area1 = max(0.0, x1_1 - x0_1) * max(0.0, y1_1 - y0_1)
    area2 = max(0.0, x1_2 - x0_2) * max(0.0, y1_2 - y0_2)
    if area1 <= 0.0 or area2 <= 0.0:
        return 0.0

    union = area1 + area2 - inter_area
    if union <= 0.0:
        return 0.0
    return inter_area / union


# Represents a layout region predicted by YOLO
@dataclass
class LayoutRegion:
    bbox: BBox
    class_name: str
    score: float
    raw: Dict[str, Any] = field(default_factory=dict)


# Represents a text/span element extracted from PyMuPDF
@dataclass
class TextElement:
    bbox: BBox
    text: str
    font_name: Optional[str] = None
    font_size: Optional[float] = None
    font_flags: Optional[int] = None
    color: Optional[int] = None
    raw: Dict[str, Any] = field(default_factory=dict)


# Represents a PyMuPDF text block (contains multiple spans)
@dataclass
class TextBlock:
    bbox: BBox
    text: str
    spans: List[TextElement] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)


# Logical layout block aggregating multiple text elements under a single layout region
@dataclass
class LayoutBlock:
    block_type: str  # e.g. 'title', 'section_header', 'text', 'formula'
    bbox: BBox
    text: str
    score: float
    elements: List[TextElement] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)


def _ensure_bbox(obj: Dict[str, Any]) -> Optional[BBox]:
    bbox = obj.get("bbox")
    if not bbox or len(bbox) != 4:
        return None
    return float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])


# Convert span dictionaries (from your existing `get_spans` output) into TextElement objects
def text_elements_from_spans(spans: Iterable[Dict[str, Any]]) -> List[TextElement]:
    elements: List[TextElement] = []
    for span in spans:
        bbox = _ensure_bbox(span)
        if bbox is None:
            continue
        elements.append(
            TextElement(
                bbox=bbox,
                text=span.get("text", ""),
                font_name=span.get("font_name"),
                font_size=span.get("font_size"),
                font_flags=span.get("font_flags"),
                color=span.get("color"),
                raw=span,
            )
        )
    return elements


# Convert PyMuPDF blocks (with their spans) into TextBlock objects
def text_blocks_from_pdf_elements(pdf_elements: Iterable[Dict[str, Any]]) -> List[TextBlock]:
    """
    Convert PyMuPDF block elements to TextBlock objects.
    Each block contains multiple spans, and we use the block's bbox for matching.
    """
    blocks: List[TextBlock] = []
    for elem in pdf_elements:
        if elem.get("type") != "text":
            continue

        block_bbox = _ensure_bbox(elem)
        if block_bbox is None:
            continue

        spans = elem.get("spans", [])
        span_elements = text_elements_from_spans(spans)

        block_text = elem.get("content", "")
        if not block_text and span_elements:
            block_text = " ".join(span.text.strip() for span in span_elements if span.text.strip())

        blocks.append(
            TextBlock(
                bbox=block_bbox,
                text=block_text,
                spans=span_elements,
                raw=elem,
            )
        )
    return blocks


# Convert YOLO detections into LayoutRegion objects
def layout_regions_from_detections(
    detections: Sequence[Dict[str, Any]],
) -> List[LayoutRegion]:
    regions: List[LayoutRegion] = []
    for det in detections:
        bbox = _ensure_bbox(det)
        if bbox is None:
            continue
        regions.append(
            LayoutRegion(
                bbox=bbox,
                class_name=str(det.get("class_name", det.get("type", "unknown"))),
                score=float(det.get("score", 1.0)),
                raw=det,
            )
        )
    return regions


# Match PyMuPDF text blocks to layout regions using IoU
def match_blocks_to_layout(
    text_blocks: Sequence[TextBlock],
    layout_regions: Sequence[LayoutRegion],
    iou_threshold: float = 0.1,
) -> List[LayoutBlock]:
    """
    Match PyMuPDF text blocks to YOLO layout regions using IoU.
    Each block contains multiple spans, and we match the entire block to a region.
    """
    if not layout_regions:
        return []

    region_assignments: Dict[int, List[TextBlock]] = {
        i: [] for i in range(len(layout_regions))
    }

    for block in text_blocks:
        best_idx = None
        best_iou = 0.0
        for idx, region in enumerate(layout_regions):
            overlap = iou(block.bbox, region.bbox)
            if overlap > best_iou:
                best_iou = overlap
                best_idx = idx
        if best_idx is not None and best_iou >= iou_threshold:
            region_assignments[best_idx].append(block)

    layout_blocks: List[LayoutBlock] = []
    for idx, region in enumerate(layout_regions):
        matched_blocks = region_assignments[idx]
        if not matched_blocks:
            continue

        all_spans_with_block_idx: List[Tuple[TextElement, int, int]] = []

        for block_idx, block in enumerate(matched_blocks):
            for span_idx, span in enumerate(block.spans):
                all_spans_with_block_idx.append((span, block_idx, span_idx))

        all_spans_with_block_idx_sorted = sorted(
            all_spans_with_block_idx,
            key=lambda x: (x[0].bbox[1], x[0].bbox[0])
        )

        all_spans_sorted = [span for span, _, _ in all_spans_with_block_idx_sorted]
        sorted_span_to_block_idx: Dict[int, int] = {
            idx: block_idx for idx, (_, block_idx, _) in enumerate(all_spans_with_block_idx_sorted)
        }
        sorted_span_to_original_order: Dict[int, Tuple[int, int]] = {
            idx: (block_idx, original_span_idx)
            for idx, (_, block_idx, original_span_idx) in enumerate(all_spans_with_block_idx_sorted)
        }

        text_block_bboxes = [block.bbox for block in matched_blocks]

        joined_text = " ".join(span.text.strip() for span in all_spans_sorted if span.text.strip())

        layout_block = LayoutBlock(
            block_type=region.class_name,
            bbox=region.bbox,
            text=joined_text,
            score=region.score,
            elements=all_spans_sorted,
            extra={
                "raw_region": region.raw,
                "matched_blocks": len(matched_blocks),
                "text_block_bboxes": text_block_bboxes,
                "span_to_block_idx": sorted_span_to_block_idx,
                "span_to_original_order": sorted_span_to_original_order,
            },
        )
        layout_blocks.append(layout_block)

    return layout_blocks
