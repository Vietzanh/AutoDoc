"""
Font-related utility functions.
"""


def clean_font_name(pdf_font_name):
    """
    Clean PDF font names for DOCX compatibility.

    Args:
        pdf_font_name: Font name from PDF

    Returns:
        str: Cleaned font name suitable for DOCX
    """
    clean_name = pdf_font_name.split("-")[0]
    if "TimesNewRoman" in clean_name:
        return "Times New Roman"
    if "Arial" in clean_name:
        return "Arial"
    return clean_name


def round_font_size(font_size):
    """
    Round font size to nearest 0.5 multiple.

    Examples:
        9.88 -> 10.0
        9.65 -> 9.5
        9.4 -> 9.5
        9.24 -> 9.0

    Args:
        font_size: Original font size (float)

    Returns:
        float: Rounded font size to nearest 0.5 multiple
    """
    if font_size is None:
        return None
    return round(font_size * 2) / 2


def get_text_length(text: str, font_name: str, font_size: float) -> float:
    """
    Calculate the length of a given text string when rendered with a specific font and size.
    
    Args:
        text: The text to measure
        font_name: The name of the font (e.g., 'Helvetica')
        font_size: The size of the font in points
        
    Returns:
        float: The width of the text in points
    """
    import pymupdf
    try:
        # PyMuPDF 1.23+ may use get_text_length
        if hasattr(pymupdf, "get_text_length"):
            return pymupdf.get_text_length(text, fontname=font_name, fontsize=font_size)
        elif hasattr(pymupdf, "getTextlength"):
            return pymupdf.getTextlength(text, fontname=font_name, fontsize=font_size)
        else:
            font = pymupdf.Font(fontname=font_name)
            return font.text_length(text, fontsize=font_size)
    except Exception:
        # Rough fallback estimation if native methods fail
        return len(text) * font_size * 0.55
