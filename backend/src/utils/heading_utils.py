"""
Heading-related utility functions.
"""

import re


def get_section_heading_level(text: str, default_level: int = 1) -> int:
    """
    Infer heading level for section headers based on numbering pattern.

    Examples:
        "1 Introduction"      -> level 1
        "1.1 Overview"         -> level 2
        "1.2.3 Details"        -> level 3
        "A Section"            -> level 1
        "A.1 Subsection"       -> level 2

    Args:
        text: Text content of the heading
        default_level: Default level if pattern not found

    Returns:
        int: Heading level (1-9)
    """
    if not text:
        return default_level
    s = text.strip()
    # Match leading numbering like "1", "1.1", "1.2.3", "A", "A.1", "B.2.1", etc.
    m = re.match(r"^([A-Z]|\d+)(?:((?:\.[A-Z\d]+)+))?\b", s)
    if not m:
        return default_level
    full_prefix = m.group(0)
    parts = full_prefix.split(".")
    level = len(parts)
    # Clamp to Word's heading range 1-9
    level = max(1, min(9, level))
    return level
