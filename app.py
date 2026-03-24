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

import shutil
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

        if col_up.button("▲", key=f"up_{i}", disabled=(i == 0)):
            order[i - 1], order[i] = order[i], order[i - 1]
            st.session_state.combine_order = order
            st.rerun()

        if col_down.button("▼", key=f"down_{i}", disabled=(i == len(order) - 1)):
            order[i], order[i + 1] = order[i + 1], order[i]
            st.session_state.combine_order = order
            st.rerun()

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
        min_value=1.0,
        max_value=8.0,
        value=6.0,
        step=0.5,
    )
    render_dpi = st.number_input(
        "Render DPI",
        min_value=72,
        max_value=600,
        value=300,
        step=50,
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
# Organize Pages
# ---------------------------------------------------------------------------

import base64

import pymupdf

PAGES_PER_ROW = 5
THUMBNAIL_DPI = 72


def _init_organize_state(num_pages: int) -> None:
    """Initialize or reset session state for the organize tool."""
    if "org_selected" not in st.session_state:
        st.session_state.org_selected: set = set()
    if "org_rotations" not in st.session_state:
        st.session_state.org_rotations: dict = {}
    if "org_insertions" not in st.session_state:
        # List of (after_index: int, file_bytes: bytes, file_name: str)
        st.session_state.org_insertions: list = []
    if "org_mode" not in st.session_state:
        st.session_state.org_mode = "view"  # "view" | "insert"
    if "org_pending_insert" not in st.session_state:
        st.session_state.org_pending_insert: dict = (
            {}
        )  # slot_idx -> None (waiting for file)


def _tool_organize_pages(project_root: Path) -> None:
    """Organize PDF pages: view, rotate, delete, insert, extract."""
    st.subheader("Upload a PDF to organize")

    uploaded = st.file_uploader("Upload a PDF file", type=["pdf"], key="org_uploader")

    if uploaded is None:
        # User removed the file via the ✕ icon — abandon the old run entirely
        # so a fresh file (even the same filename) gets a clean slate.
        st.session_state.org_last_file = None
        st.session_state.org_last_hash = None
        st.session_state.org_run_id = uuid.uuid4().hex[:8]
        st.session_state.org_selected = set()
        st.session_state.org_rotations = {}
        st.session_state.org_insertions = []
        st.session_state.org_mode = "view"
        for key in list(st.session_state.keys()):
            if key.startswith("insert_file_slot_"):
                st.session_state.pop(key, None)
        return

    # Reset state when a genuinely different file is uploaded (different name OR
    # different content). Use a content hash so same-name/same-size files with
    # different content are also detected.
    import hashlib
    uploaded_bytes = uploaded.getbuffer()
    uploaded_hash = hashlib.md5(uploaded_bytes).hexdigest()

    last_name = st.session_state.get("org_last_file")
    last_hash = st.session_state.get("org_last_hash", "")
    if last_name != uploaded.name or last_hash != uploaded_hash:
        st.session_state.org_last_file = uploaded.name
        st.session_state.org_last_hash = uploaded_hash
        st.session_state.org_selected = set()
        st.session_state.org_rotations = {}
        st.session_state.org_insertions = []
        st.session_state.org_mode = "view"
        st.session_state.org_run_id = uuid.uuid4().hex[:8]
        # Clear all orphaned file-uploader widget states
        for key in list(st.session_state.keys()):
            if key.startswith("insert_file_slot_"):
                del st.session_state[key]

    # Use persisted run_id so the same directory is used across reruns
    run_id = st.session_state.get("org_run_id") or uuid.uuid4().hex[:8]
    run_root = project_root / "runs" / f"organize_{run_id}"
    run_root.mkdir(parents=True, exist_ok=True)

    # Always write base.pdf — the run_id is fresh whenever state resets, so
    # this always creates a new file, never overwrites a stale one.
    pdf_path = run_root / "base.pdf"
    with pdf_path.open("wb") as f:
        f.write(uploaded_bytes)

    # Open PDF (needed for both rendering and applying operations)
    doc = pymupdf.open(str(pdf_path))
    num_pages = len(doc)

    _init_organize_state(num_pages)

    # ---- Process pending operations BEFORE rendering ----

    # Extract: build extracted PDF and show download button
    if st.session_state.get("org_extract_req"):
        st.session_state.org_extract_req = False
        ext_path, msg = _build_extracted_pdf(pdf_path, run_root)
        st.session_state.org_extracted_path = str(ext_path)
        st.session_state.org_message = msg
        # Do NOT rerun — show the download button first

    # ---- Render top toolbar ----
    sel = st.session_state.org_selected
    insert_mode = st.session_state.org_mode == "insert"

    t1, t2, t3, t4, t5, t6 = st.columns([1, 1, 1, 1, 1, 2])

    def _rotate_left():
        st.session_state.org_pending_action = "rotate_left"

    def _rotate_right():
        st.session_state.org_pending_action = "rotate_right"

    def _toggle_insert():
        st.session_state.org_pending_action = "toggle_insert"

    def _extract():
        st.session_state.org_pending_action = "extract"

    def _delete():
        st.session_state.org_pending_action = "delete"

    with t1:
        st.button(
            "↺ Rotate left",
            key="org_rotate_all_left",
            on_click=_rotate_left,
        )
    with t2:
        st.button(
            "↻ Rotate right",
            key="org_rotate_all_right",
            on_click=_rotate_right,
        )
    with t3:
        st.button(
            ("✳ Done Inserting" if insert_mode else "➕ Insert pages"),
            key="org_toggle_insert",
            on_click=_toggle_insert,
        )
    with t4:
        st.button(
            f"📤 Extract ({len(sel)})" if sel else "📤 Extract",
            key="org_extract",
            disabled=len(sel) == 0,
            on_click=_extract,
        )
    with t5:
        st.button(
            f"🗑 Delete ({len(sel)})" if sel else "🗑 Delete",
            key="org_delete",
            disabled=len(sel) == 0,
            on_click=_delete,
        )
    with t6:
        pass

    # Handle toolbar button actions — reads separate action flag, never writes widget keys
    action = st.session_state.pop("org_pending_action", None)

    if action == "rotate_left":
        target = sel if sel else set(range(num_pages))
        for idx in target:
            st.session_state.org_rotations[idx] = (
                st.session_state.org_rotations.get(idx, 0) - 90
            ) % 360
        doc.close()
        st.rerun()

    if action == "rotate_right":
        target = sel if sel else set(range(num_pages))
        for idx in target:
            st.session_state.org_rotations[idx] = (
                st.session_state.org_rotations.get(idx, 0) + 90
            ) % 360
        doc.close()
        st.rerun()

    if action == "toggle_insert":
        st.session_state.org_mode = "view" if insert_mode else "insert"
        doc.close()
        st.rerun()

    if action == "extract":
        st.session_state.org_extract_req = True
        doc.close()
        st.rerun()

    if action == "delete":
        _apply_delete_operation(pdf_path, run_root)
        doc.close()
        st.rerun()

    # Status messages
    if st.session_state.get("org_message"):
        st.success(st.session_state.org_message)
        st.session_state.org_message = None

    # Extract download button
    if st.session_state.get("org_extracted_path"):
        ep = st.session_state.org_extracted_path
        if Path(ep).exists():
            with open(ep, "rb") as f:
                st.download_button(
                    "Download extracted PDF",
                    f,
                    file_name="extracted.pdf",
                    mime="application/pdf",
                    key="dl_extracted",
                )
        st.session_state.org_extracted_path = None

    if sel:
        st.caption(f"{len(sel)} page(s) selected.")
    else:
        st.caption("Click **Select** on a thumbnail to select pages for batch actions.")

    st.markdown("---")

    # ---- Render page thumbnails ----
    _render_page_grid(doc, pdf_path, run_root, num_pages, insert_mode)

    st.markdown("---")

    # ---- Save / Download final output ----
    has_changes = (
        st.session_state.org_rotations
        or st.session_state.org_insertions
        or st.session_state.org_selected
    )

    out_name = st.text_input(
        "Output filename", value="organized.pdf", key="org_out_name"
    )
    if not out_name.lower().endswith(".pdf"):
        out_name += ".pdf"

    save_col, dl_col = st.columns([1, 1])
    with save_col:
        save_pressed = st.button("💾 Save & Download", type="primary")

    if save_pressed:
        out_path = run_root / out_name
        with st.spinner("Building output PDF..."):
            _build_final_output(pdf_path, run_root, out_path)
        with open(str(out_path), "rb") as f:
            st.download_button(
                "Download organized PDF",
                f,
                file_name=out_name,
                mime="application/pdf",
                key="dl_organized",
            )
        st.session_state.org_message = f"Saved as {out_name}"

    doc.close()


def _render_page_grid(
    doc: pymupdf.Document,
    pdf_path: Path,
    run_root: Path,
    num_pages: int,
    insert_mode: bool,
) -> None:
    """Render the page thumbnail grid with per-page selection and action buttons."""
    rows = []
    for i in range(0, num_pages, PAGES_PER_ROW):
        rows.append(list(range(i, min(i + PAGES_PER_ROW, num_pages))))

    for row_pages in rows:
        cols = st.columns(PAGES_PER_ROW)
        for col_idx, page_num in enumerate(row_pages):
            with cols[col_idx]:
                _render_single_page(doc, pdf_path, run_root, page_num)

    # ---- Insert-mode "+" slots between pages ----
    if insert_mode:
        st.markdown("---")
        st.markdown("**➕ Insert pages — choose a position and upload a PDF:**")
        slots = list(range(num_pages + 1))
        slot_cols = st.columns(len(slots))

        for slot_idx, slot in enumerate(slots):
            with slot_cols[slot_idx]:
                label = (
                    "Start"
                    if slot == 0
                    else (f"After p.{slot}" if slot <= num_pages else "End")
                )
                st.caption(f"**{label}**")

                existing = next(
                    (
                        fname
                        for (pos, _, fname) in st.session_state.org_insertions
                        if pos == slot
                    ),
                    None,
                )

                if existing:
                    st.success(f"✓ {existing}")
                else:
                    key = f"insert_file_slot_{slot}"
                    inserted = st.file_uploader(
                        "Choose PDF",
                        type=["pdf"],
                        key=key,
                        label_visibility="collapsed",
                    )
                    if inserted is not None:
                        fbytes = inserted.getbuffer().tobytes()
                        st.session_state.org_insertions.append(
                            (slot, fbytes, inserted.name)
                        )
                        # Clear widget state so the uploader key is fresh on next render
                        del st.session_state[key]
                        st.rerun()


def _render_single_page(
    doc: pymupdf.Document,
    pdf_path: Path,
    run_root: Path,
    page_num: int,
) -> None:
    """Render one page thumbnail: image + selection border + per-page action buttons."""
    page = doc[page_num]
    rotation = st.session_state.org_rotations.get(page_num, 0)

    # Render page thumbnail
    mat = pymupdf.Matrix()
    if rotation != 0:
        mat = pymupdf.Matrix().prerotate(rotation)

    pix = page.get_pixmap(matrix=mat, dpi=THUMBNAIL_DPI)
    thumb_path = run_root / f"thumb_{page_num}_{rotation}.png"
    with thumb_path.open("wb") as f:
        f.write(pix.tobytes("png"))

    with thumb_path.open("rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    is_selected = page_num in st.session_state.org_selected
    border_color = "#2563eb" if is_selected else "#e5e7eb"
    border_width = 3 if is_selected else 1
    bg_color = "#eff6ff" if is_selected else "#ffffff"
    rotation_label = f"  ↺{rotation}°" if rotation else ""

    pending = sum(
        1 for (pos, _, _) in st.session_state.org_insertions if pos == page_num + 1
    )

    img_html = f"""
    <div style="position:relative; display:inline-block; width:100%;">
        <div style="
            border: {border_width}px solid {border_color};
            border-radius: 4px;
            background: {bg_color};
            overflow: hidden;
        ">
            <img src="data:image/png;base64,{b64}" width="100%" style="display:block;" />
        </div>
        {f'<div style="position:absolute;top:2px;right:2px;background:#16a34a;'
          f'color:white;font-size:10px;padding:1px 4px;border-radius:3px;">+{pending}</div>' if pending else ''}
    </div>
    """
    st.markdown(img_html, unsafe_allow_html=True)

    display_num = page_num + 1
    st.caption(f"**Page {display_num}{rotation_label}**")

    btn_col1, btn_col2, btn_col3 = st.columns([1, 1, 1])

    with btn_col1:
        if st.button("↺", key=f"rot_L_{page_num}", help="Rotate left"):
            st.session_state.org_rotations[page_num] = (
                st.session_state.org_rotations.get(page_num, 0) - 90
            ) % 360
            st.rerun()

    with btn_col2:
        if st.button("↻", key=f"rot_R_{page_num}", help="Rotate right"):
            st.session_state.org_rotations[page_num] = (
                st.session_state.org_rotations.get(page_num, 0) + 90
            ) % 360
            st.rerun()

    with btn_col3:
        if st.button("🗑", key=f"del_{page_num}", help="Delete this page"):
            st.session_state.org_selected = {page_num}
            _apply_delete_operation(pdf_path, run_root)
            st.rerun()

    sel_label = "✓ Selected" if is_selected else "Select"
    if st.button(sel_label, key=f"sel_{page_num}"):
        if page_num in st.session_state.org_selected:
            st.session_state.org_selected.discard(page_num)
        else:
            st.session_state.org_selected.add(page_num)
        st.rerun()


# ---------------------------------------------------------------------------
# Apply pending operations
# ---------------------------------------------------------------------------


def _apply_delete_operation(pdf_path: Path, run_root: Path) -> str:
    """Apply stored deletions to the PDF on disk. Returns description.

    Note: Rotations are NOT applied here — they are applied in _build_final_output
    alongside deletions and insertions in a single pass. This avoids a double-
    rotation bug where intermediate reruns would bake rotations into base.pdf,
    only for _build_final_output to apply them again.
    """
    selected = st.session_state.org_selected.copy()

    doc = pymupdf.open(str(pdf_path))

    # Write pages excluding deleted ones (no rotation — only deletions here)
    writer = pymupdf.open()
    for page_i in range(len(doc)):
        if page_i not in selected:
            writer.insert_pdf(doc, from_page=page_i, to_page=page_i)

    out = run_root / "output.pdf"
    writer.save(str(out), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    shutil.copy(str(out), str(pdf_path))

    st.session_state.org_selected = set()
    st.session_state.org_insertions = []
    # Clear orphaned file-uploader widget states
    for key in list(st.session_state.keys()):
        if key.startswith("insert_file_slot_"):
            del st.session_state[key]

    deleted = sorted(selected)
    return f"Deleted {len(deleted)} page(s): indices {deleted}"


def _build_extracted_pdf(pdf_path: Path, run_root: Path) -> tuple[Path, str]:
    """Apply rotations and build an extracted PDF. Returns (path, description)."""
    selected = sorted(st.session_state.org_selected)
    rotations = st.session_state.org_rotations

    doc = pymupdf.open(str(pdf_path))

    for idx, rot in rotations.items():
        if 0 <= idx < len(doc) and rot:
            doc[idx].set_rotation(rot)

    writer = pymupdf.open()
    for idx in selected:
        if 0 <= idx < len(doc):
            writer.insert_pdf(doc, from_page=idx, to_page=idx)

    out = run_root / "extracted.pdf"
    writer.save(str(out), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    return out, f"Extracted {len(selected)} page(s): indices {selected}"


def _build_final_output(pdf_path: Path, run_root: Path, out_path: Path) -> Path:
    """Apply all rotations and insertions, produce final output PDF."""
    insertions = st.session_state.org_insertions
    rotations = st.session_state.org_rotations

    # Load base doc and apply rotations
    doc = pymupdf.open(str(pdf_path))
    for idx, rot in rotations.items():
        if 0 <= idx < len(doc) and rot:
            doc[idx].set_rotation(rot)

    writer = pymupdf.open()

    # Iterate through all positions in the final output
    # slot 0 = before page 0, slot 1 = after page 0, ..., slot N = after page N-1
    num_pages = len(doc)

    for pos in range(num_pages + 1):
        # Insert any files scheduled for this slot
        for slot_pos, fbytes, fname in insertions:
            if slot_pos == pos:
                tmp = run_root / f"_insert_{uuid.uuid4().hex[:6]}.pdf"
                with tmp.open("wb") as f:
                    f.write(fbytes)
                insert_doc = pymupdf.open(str(tmp))
                writer.insert_pdf(insert_doc)
                insert_doc.close()
                tmp.unlink(missing_ok=True)

        # Insert the original page at this slot (0-indexed page = slot index)
        if pos < num_pages:
            writer.insert_pdf(doc, from_page=pos, to_page=pos)

    out = out_path
    writer.save(str(out), garbage=4, deflate=True, clean=True)
    writer.close()
    doc.close()

    return out


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
        _tool_organize_pages(project_root)
    elif tool == "✂️ Crop Pages":
        st.info("Crop Pages — coming soon.")
    elif tool == "🔢 Number Pages":
        st.info("Number Pages — coming soon.")


if __name__ == "__main__":
    main()
