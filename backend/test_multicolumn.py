import sys
import argparse
from pathlib import Path
from src.pipeline import PDFToDocxPipeline

def main():
    parser = argparse.ArgumentParser(description="Test multi-column PDF to DOCX conversion.")
    parser.add_argument("pdf_path", type=str, help="Path to input PDF file")
    parser.add_argument("--out", type=str, default=None, help="Path to output DOCX file (optional)")
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"Error: PDF file not found at {pdf_path}")
        sys.exit(1)

    out_path = args.out
    if out_path is None:
        out_path = pdf_path.with_suffix(".docx")

    print(f"Testing PDF to DOCX conversion on: {pdf_path}")
    print(f"Output will be saved to: {out_path}")

    pipeline = PDFToDocxPipeline(device="cpu")
    pipeline.process_pdf(str(pdf_path), str(out_path))

    print("\nConversion completed successfully.")

if __name__ == "__main__":
    main()
