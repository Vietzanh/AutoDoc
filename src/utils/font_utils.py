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
