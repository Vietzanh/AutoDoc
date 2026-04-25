import pymupdf

font_name = "Helvetica"
label = "Page 3 of 9"
fontsize = 10

try:
    f = pymupdf.Font(fontname=font_name)
    tl = f.text_length(label, fontsize=fontsize)
    print("Font.text_length:", tl)
except Exception as e:
    print("Error with Font.text_length:", e)

try:
    tl = pymupdf.get_text_length(label, fontname=font_name, fontsize=fontsize)
    print("pymupdf.get_text_length:", tl)
except Exception as e:
    print("Error with pymupdf.get_text_length:", e)
