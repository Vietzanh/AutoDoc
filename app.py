"""
Simple Streamlit interface for the PDF → DOCX reconstruction pipeline.

This UI lets you upload any PDF, then:
- Extract per-page layout metadata into a run folder (same format as data_layout)
- Run the refactored pipeline to generate a DOCX
- Provide the DOCX as a download

PDF Tools (pure pymupdf):
- Combine multiple PDFs into one
- Split, organize, crop, number pages
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
from src.pdf_operations.combine import combine_pdfs  # noqa: E402


# ---------------------------------------------------------------------------
# Tool pages
# ---------------------------------------------------------------------------

def _tool_combine_files(project_root: Path) -> None:
    """Combine multiple PDF files into one, with up/down reordering."""
    st.subheader("Upload PDF files to combine")
    st.caption("Upload files in any order — use ▲ / ▼ to reorder them.")

    uploaded_files = st.file_uploader(
        "Select or drop PDF files",
        type=["pdf"],
        accept_multiple_files=True,
        key="combine_files_uploader",
    )

    if not uploaded_files:
        return

    # ------- Build / reset ordered list -------
    if "combine_order" not in st.session_state:
        st.session_state.combine_order = list(range(len(uploaded_files)))

    if len(st.session_state.combine_order) != len(uploaded_files):
        st.session_state.combine_order = list(range(len(uploaded_files)))

    order = list(st.session_state.combine_order)
    st.markdown("**File order**:")

    # Column headers
    h0, h1, h2 = st.columns([0.5, 1.5, 6])
    h0.markdown("**#**")
    h1.markdown("**Move**")
    h2.markdown("**File**")

    for i, idx in enumerate(order):
        file = uploaded_files[idx]
        size_kb = len(file.getbuffer()) / 1024

        row_cols = st.columns([0.5, 1.5, 6])
        row_cols[0].markdown(f"`{i + 1}`")
        row_cols[2].markdown(
            f"`{file.name}`  &nbsp; <small>{size_kb:.1f} KB</small>",
            unsafe_allow_html=True,
        )

        col_up, col_down = row_cols[1].columns(2)

        if col_up.button("▲", key=f"up_{i}") and i > 0:
            order[i], order[i - 1] = order[i - 1], order[i]
            st.session_state.combine_order = order
            st.rerun()

        col_down.button(
            "▼",
            key=f"down_{i}",
            disabled=(i >= len(order) - 1),
        )

    st.markdown("---")

    # Output filename
    output_name = st.text_input(
        "Output filename",
        value="combined.pdf",
        key="combine_output_name",
    )
    if not output_name.lower().endswith(".pdf"):
        output_name += ".pdf"

    # Run
    if st.button("Combine PDFs", type="primary"):
        run_id = uuid.uuid4().hex[:8]
        run_root = project_root / "runs" / f"combine_{run_id}"
        run_root.mkdir(parents=True, exist_ok=True)

        saved_paths = []
        for idx in order:
            file = uploaded_files[idx]
            dest = run_root / file.name
            with dest.open("wb") as f:
                f.write(file.getbuffer())
            saved_paths.append(str(dest))

        output_path = run_root / output_name

        with st.spinner("Merging PDFs..."):
            try:
                combine_pdfs(saved_paths, str(output_path), verbose=False)
                st.session_state["combine_result"] = str(output_path)
                st.session_state["combine_out_name"] = output_name
                st.success(f"Merged {len(order)} file(s) into **{output_name}**.")
            except Exception as exc:
                st.error(f"Merging failed: {exc}")

    # Download
    result_path = st.session_state.get("combine_result")
    if result_path and Path(result_path).exists():
        st.markdown("---")
        st.subheader("Download Result")
        out_name = st.session_state.get("combine_out_name", "combined.pdf")
        with Path(result_path).open("rb") as f:
            st.download_button(
                label="Download merged PDF",
                data=f,
                file_name=out_name,
                mime="application/pdf",
            )
        if st.button("Reset"):
            for key in ["combine_result", "combine_out_name", "combine_order"]:
                st.session_state.pop(key, None)
            st.rerun()


def _tool_reconstruct(project_root: Path) -> None:
    """Original PDF → DOCX reconstruction tool."""
    st.subheader("Upload a PDF file")
    st.write("Run the pipeline to convert a PDF into a structured, editable DOCX.")

    uploaded = st.file_uploader("Upload a PDF file", type=["pdf"])
    max_image_width = st.number_input(
        "Max image width (inches)",
        min_value=1.0, max_value=8.0, value=6.0, step=0.5,
    )
    render_dpi = st.number_input(
        "Render DPI",
        min_value=72, max_value=600, value=300, step=50,
    )

    st.caption(
        "Note: The first run will download the DocLayout-YOLO model if not cached."
    )

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

        with pdf_path.open("wb") as f:
            f.write(uploaded.getbuffer())

        with st.spinner("Running pipeline. This may take a few minutes..."):
            try:
                extract_pdf_layout(
                    pdf_path=str(pdf_path),
                    output_dir=str(layout_dir),
                    page_image_dpi=int(render_dpi),
                    inline_image_dpi=600,
                    start_page=0,
                    end_page=None,
                )
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
                mime=(
                    "application/vnd.openxmlformats-officedocument"
                    ".wordprocessingml.document"
                ),
            )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    project_root = get_project_root()

    st.set_page_config(page_title="AutoDoc", layout="wide")
    st.title("AutoDoc — PDF Toolkit")

    tool = st.sidebar.radio(
        "Tool",
        [
            "📄 PDF → DOCX",
            "🔗 Combine PDFs",
            "✂️ Split PDF",
            "📑 Organize Pages",
            "✂️ Crop Pages",
            "🔢 Number Pages",
        ],
    )

    if tool == "🔗 Combine PDFs":
        _tool_combine_files(project_root)
    elif tool == "📄 PDF → DOCX":
        _tool_reconstruct(project_root)
    elif tool == "✂️ Split PDF":
        st.info("Split PDF — coming soon.")
    elif tool == "📑 Organize Pages":
        st.info("Organize Pages — coming soon.")
    elif tool == "✂️ Crop Pages":
        st.info("Crop Pages — coming soon.")
    elif tool == "🔢 Number Pages":
        st.info("Number Pages — coming soon.")


if __name__ == "__main__":
    main()
