"""
Heading-related utility functions.
"""

import re


from typing import Tuple

def get_section_heading_level(text: str, default_level: int = 1) -> Tuple[int, bool]:
    """
    Infer heading level for section headers based on numbering pattern.

    Examples:
        "1 Introduction"      -> (1, True)
        "1.1 Overview"         -> (2, True)
        "a) Subsection"        -> (2, True)
        "Unnumbered Header"    -> (default_level, False)

    Returns:
        Tuple[int, bool]: (Heading level 1-9, is_numbered flag)
    """
    if not text:
        return default_level, False
    s = text.strip()
    
    first_word = s.split()[0] if s else ""
    
    # Match prefixes: numbers, uppercase letters, lowercase letters
    # followed by optional dots and numbers/letters
    # ending with optional ., ), or ,
    m = re.match(r"^([A-Za-z]|\d+)((?:\.[A-Za-z\d]+)*)[\.\,\)]?$", first_word)
    if m:
        base = m.group(1)
        rest = m.group(2)
        
        parts = 1 + (rest.count(".") if rest else 0)
        
        # If it's a single lowercase letter, it's typically a list/sub-section
        # Assign it a minimum level of 2
        if parts == 1 and base.isalpha() and base.islower():
            parts = 2
            
        level = max(1, min(9, parts))
        return level, True

    return default_level, False
