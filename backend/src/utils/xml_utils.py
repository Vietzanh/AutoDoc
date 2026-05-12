import re

def sanitize_text_for_xml(text: str) -> str:
    """
    Removes control characters that are invalid in XML (like NULL bytes).
    XML 1.0 valid chars exclude control characters (0x00-0x1F, 0x7F-0x9F)
    except \t (0x09), \n (0x0A), \r (0x0D).
    """
    if not text:
        return ""
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
