"""
Utilities for rendering PDF pages to images and mapping coordinates
between PyMuPDF (PDF space) and image space.

These helpers are designed to integrate with `pymupdf` (imported as `fitz`
or `pymupdf` in your notebooks).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from PIL import Image


@dataclass
class PageRenderResult:
    """
    Result of rendering a PDF page to an RGB image.

    Attributes
    ----------
    image : PIL.Image.Image
        Rendered page image (RGB).
    scale_x : float
        Horizontal scale factor: image_width / page.rect.width
    scale_y : float
        Vertical scale factor: image_height / page.rect.height
    """

    image: Image.Image
    scale_x: float
    scale_y: float


def render_page_to_image(page, dpi: int = 300) -> PageRenderResult:
    """
    Render a PyMuPDF page to a PIL RGB image and compute coordinate scales.

    Parameters
    ----------
    page :
        PyMuPDF page object.
    dpi : int, optional
        Dots-per-inch for rasterization. Higher DPI yields larger images
        and more precise alignment with text boxes, at the cost of speed
        and memory. Defaults to 300.

    Returns
    -------
    PageRenderResult
        Contains the PIL image and scale factors to convert PDF coordinates
        (as returned by PyMuPDF spans/blocks) into image pixel coordinates.
    """
    pix = page.get_pixmap(dpi=dpi)

    # Convert pixmap to PIL RGB image
    mode = "RGB"
    if pix.alpha:
        mode = "RGBA"
    image = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if mode == "RGBA":
        image = image.convert("RGB")

    page_rect = page.rect
    scale_x = pix.width / page_rect.width if page_rect.width != 0 else 1.0
    scale_y = pix.height / page_rect.height if page_rect.height != 0 else 1.0

    return PageRenderResult(image=image, scale_x=scale_x, scale_y=scale_y)


def pdf_bbox_to_image_bbox(
    pdf_bbox: Tuple[float, float, float, float],
    scale_x: float,
    scale_y: float,
) -> Tuple[int, int, int, int]:
    """
    Convert a PDF-space bounding box (PyMuPDF coordinates) to image pixels.

    Parameters
    ----------
    pdf_bbox : tuple(float, float, float, float)
        (x0, y0, x1, y1) in page coordinate space.
    scale_x : float
        Horizontal scale factor from `render_page_to_image`.
    scale_y : float
        Vertical scale factor from `render_page_to_image`.

    Returns
    -------
    tuple(int, int, int, int)
        (x0, y0, x1, y1) in image pixel coordinates.
    """
    x0, y0, x1, y1 = pdf_bbox
    return (
        int(round(x0 * scale_x)),
        int(round(y0 * scale_y)),
        int(round(x1 * scale_x)),
        int(round(y1 * scale_y)),
    )


def image_bbox_to_pdf_bbox(
    image_bbox: Tuple[float, float, float, float],
    scale_x: float,
    scale_y: float,
) -> Tuple[float, float, float, float]:
    """
    Convert an image-space bounding box (pixels) back to PDF-space.

    This is useful if you want to take YOLO detections on the rendered
    page image and project them back into the original PDF coordinate
    system used by PyMuPDF.

    Parameters
    ----------
    image_bbox : tuple(float, float, float, float)
        (x0, y0, x1, y1) in image pixel coordinates.
    scale_x : float
        Horizontal scale factor from `render_page_to_image`.
    scale_y : float
        Vertical scale factor from `render_page_to_image`.

    Returns
    -------
    tuple(float, float, float, float)
        (x0, y0, x1, y1) in PDF page coordinates.
    """
    x0, y0, x1, y1 = image_bbox
    inv_scale_x = 1.0 / scale_x if scale_x != 0 else 1.0
    inv_scale_y = 1.0 / scale_y if scale_y != 0 else 1.0
    return (
        x0 * inv_scale_x,
        y0 * inv_scale_y,
        x1 * inv_scale_x,
        y1 * inv_scale_y,
    )


