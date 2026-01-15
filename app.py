"""
Simple Streamlit interface for the PDF → DOCX reconstruction pipeline.

This UI lets you upload any PDF, then:
- Extract per-page layout metadata into a run folder (same format as data_layout)
- Run the refactored pipeline to generate a DOCX
- Provide the DOCX as a download
"""

import sys
import uuid
from pathlib import Path

import streamlit as st


def get_project_root() -> Path:
    """
    Return the project root directory (where this file is located).
    """
    return Path(__file__).resolve().parent


def setup_sys_path() -> None:
    """
    Ensure the src package can be imported by adding the project root to sys.path.
    """
    project_root = get_project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))


setup_sys_path()

from src.pipeline import PDFToDocxPipeline  # noqa: E402
from src.extract_layout import extract_pdf_layout  # noqa: E402


def main() -> None:
    """
    Streamlit entry point.
    """
    st.title("PDF to DOCX Reconstruction (Streamlit)")
    st.write(
        "Upload a PDF, run reconstruction, then download the resulting DOCX."
    )

    project_root = get_project_root()
    st.subheader("Configuration")

    uploaded = st.file_uploader("Upload a PDF file", type=["pdf"])
    max_image_width = st.number_input("Max image width (inches)", min_value=1.0, max_value=8.0, value=6.0, step=0.5)
    render_dpi = st.number_input("Render DPI", min_value=72, max_value=600, value=300, step=50)

    st.caption("Note: The first run will download the DocLayout-YOLO model if not cached.")

    st.markdown("---")
    st.subheader("Run Reconstruction")

    if st.button("Run pipeline") and uploaded is not None:
        run_id = uuid.uuid4().hex[:10]
        safe_name = Path(uploaded.name).stem or "uploaded"
        run_root = project_root / "runs" / f"{safe_name}_{run_id}"
        run_root.mkdir(parents=True, exist_ok=True)

        pdf_path = run_root / "input.pdf"
        layout_dir = run_root / "data_layout"
        output_path = run_root / "output.docx"

        # Save uploaded PDF to disk
        with pdf_path.open("wb") as f:
            f.write(uploaded.getbuffer())

        st.write(f"Input PDF saved to: `{pdf_path}`")
        st.write(f"Layout metadata folder: `{layout_dir}`")
        st.write(f"Output DOCX: `{output_path}`")

        with st.spinner("Running pipeline. This may take a few minutes..."):
            try:
                # 1) Extract layout metadata in the same format used by the pipeline
                extract_pdf_layout(
                    pdf_path=str(pdf_path),
                    output_dir=str(layout_dir),
                    page_image_dpi=int(render_dpi),
                    inline_image_dpi=600,
                    start_page=0,
                    end_page=None,
                )

                # 2) Run reconstruction pipeline
                pipeline = PDFToDocxPipeline(
                    model=None,
                    style_map=None,
                    max_image_width=float(max_image_width),
                    dpi=int(render_dpi),
                )
                pipeline.process_pdf(
                    pdf_path=str(pdf_path),
                    output_path=str(output_path),
                    json_base_path=str(layout_dir),
                    start_page=0,
                    end_page=None,
                )
            except Exception as exc:
                st.error(f"An error occurred while running the pipeline: {exc}")
            else:
                st.success("Reconstruction completed successfully.")
                st.session_state["last_output_path"] = str(output_path)
                st.session_state["last_docx_name"] = f"{safe_name}.docx"

    last_output = st.session_state.get("last_output_path")
    if last_output and Path(last_output).exists():
        st.markdown("---")
        st.subheader("Download Result")
        output_path = Path(last_output)
        with output_path.open("rb") as f:
            st.download_button(
                label="Download reconstructed DOCX",
                data=f,
                file_name=st.session_state.get("last_docx_name", output_path.name),
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )


if __name__ == "__main__":
    main()

