# AutoDoc — Project Context

> **Last updated:** 2026-06-25
> **Status:** Combine + Organize + Insert + Split + Reorder + Page Numbers done · External hyperlink preservation in PDF → DOCX done · Organize full-screen split workspace fixed and verified· Reconstruction edge-case fixes verified · Crop backend/frontend remaining · DevOps pending

---

## 1. Project Overview

**Name:** AutoDoc (Đồ Án Môn Học — University Project)

**Goal:** A browser-based PDF toolkit with two tiers:
1. **PDF → DOCX Reconstruction** — Automatically convert multi-page PDF documents into editable DOCX files, preserving layout, formatting, and structure.
2. **PDF Operations** — Pure pymupdf transformations (merge, split, organize, crop, number pages) with no ML required.

---

## 2. Architecture

### Frontend → Backend Separation

```
┌──────────────────────────┐     HTTP/REST      ┌──────────────────────────────┐
│   React + Vite + TS      │ ────────────────→  │   FastAPI (Python)           │
│   (TypeScript + Tailwind)│  OAuth2/Bearer     │   (backend/)                  │
│   (frontend/)             │ ← JSON responses ── │   (src/)                     │
└──────────────────────────┘                   └──────────────────────────────┘
```

### Backend Structure (`backend/`)

```
backend/
├── .env.example                # Environment variables template
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Container image
├── run.py                     # Dev entry point (uvicorn reload)
├── docker-compose.yml         # Dev compose (hot reload enabled)
│
├── src/
│   ├── main.py                # FastAPI app factory (routes, CORS, startup)
│   ├── __init__.py
│   │
│   ├── core/                  # App-wide settings, security, config
│   │   ├── config.py          # Settings (pydantic-settings, env vars)
│   │   └── security.py        # JWT hashing (passlib+bcrypt), token creation, get_current_user
│   │
│   ├── models/                # DB models & API schemas
│   │   ├── database.py        # SQLModel engine (NullPool for thread safety), get_session, init_db()
│   │   ├── database_models.py  # User, Document, Job SQLModel tables
│   │   └── schemas.py         # Pydantic request/response bodies
│   │
│   ├── repositories/           # Data access layer (one file per model)
│   │   ├── user_repository.py
│   │   ├── document_repository.py
│   │   └── job_repository.py
│   │
│   ├── services/              # Business logic (one file per domain)
│   │   ├── auth_service.py     # Register, authenticate
│   │   ├── document_service.py # Upload, list, delete, page count
│   │   └── job_service.py     # Create/run/poll async PDF jobs
│   │
│   └── routes/                 # FastAPI route handlers (thin, HTTP only)
│       ├── auth_routes.py      # POST /auth/register, /auth/login, GET /auth/me
│       ├── document_routes.py  # CRUD + download for documents
│       └── job_routes.py       # Create + poll + list + delete + download for jobs
│
└── data/                       # Auto-created at runtime (gitignored)
    ├── uploads/{user_id}/      # Uploaded PDF files
    ├── outputs/{job_id}/       # Generated DOCX / PDF output files
    ├── layouts/{job_id}/       # Layout cache for reconstruct jobs
    └── autodoc.db              # SQLite database
```

### Frontend Structure (`frontend/`)

```
frontend/
├── package.json               # React 18, Vite, Tailwind, axios, react-router-dom, sonner, react-dropzone
├── postcss.config.js
├── vite.config.ts             # Dev proxy: /api → localhost:8000
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── src/
    ├── main.tsx               # App entry, BrowserRouter, AuthProvider, Toaster
    ├── index.css              # Tailwind base
    ├── App.tsx               # Routes: /login, /register, /, /reconstruct, /combine, /split, /organize
    │
    ├── context/
    │   └── AuthContext.tsx    # AuthProvider, useAuth hook (JWT in localStorage, auto-restore session)
    │
    ├── services/
    │   └── api.ts             # Axios singleton (typed methods) + native fetch() for blob downloads
    │
    ├── hooks/
    │   └── useJobPoll.ts      # useJobPoll(jobId, interval) — polls until terminal state
    │
    ├── components/
    │   └── ui/
    │       ├── Badge.tsx      # Status badge (pending/done/failed/processing variants)
    │       ├── Button.tsx     # Variants: primary, secondary, danger, ghost; sizes: sm/md/lg
    │       ├── Card.tsx       # Card + CardHeader + CardBody + CardFooter
    │       ├── Input.tsx      # Input with label + error message, forwardRef support
    │       ├── Layout.tsx     # Shared shell: sticky header with nav, footer, mobile nav
    │       ├── ProgressBar.tsx # Animated blue progress bar (0–100%)
    │       └── Spinner.tsx    # SVG animate-spin spinner, sizes sm/md/lg
    │
    └── pages/
        ├── LoginPage.tsx      # Login form (username + password), redirects if authed
        ├── RegisterPage.tsx  # Register form (email, username, password, confirmPassword)
        ├── DashboardPage.tsx # Document table + Recent Jobs table
        ├── ReconstructPage.tsx # 4-state wizard: upload → ready → processing → done/failed
        ├── CombinePage.tsx    # Multi-doc upload + select/delete controls + job + download ✅
        ├── OrganizePage.tsx   # Full-screen split workspace: left PDF preview, right 4-col thumbnails, insert-source strip, checkbox-only selection ✅
        ├── SplitPage.tsx     # Single-PDF upload + blue-to-red scissor split lines + ZIP download ✅
        ├── CropPage.tsx       # ⬜ TODO — crop by margins or custom rect
        └── PageNumbersPage.tsx # two-panel layout: thumbnails (left) + options (right); single/facing-page modes; 2×2 PositionGrid; page range; text format; job + download ✅
```

---

## 3. What Was Built

### ✅ Backend — Complete

| File | Status |
|------|--------|
| `backend/requirements.txt` | ✅ Written — all deps listed |
| `backend/.env.example` | ✅ Written |
| `backend/Dockerfile` | ✅ Written — slim Python 3.11, hot reload via volume mount |
| `backend/docker-compose.yml` | ✅ Written — hot reload enabled, backend_data volume |
| `backend/run.py` | ✅ Written — uvicorn reload entry point |
| `backend/src/core/config.py` | ✅ Written — pydantic-settings, dirs auto-created |
| `backend/src/core/security.py` | ✅ Written — passlib bcrypt, JWT, get_current_user |
| `backend/src/models/database.py` | ✅ Written — SQLModel engine (NullPool), get_session, init_db |
| `backend/src/models/database_models.py` | ✅ Written — User, Document, Job tables |
| `backend/src/models/schemas.py` | ✅ Written — all request/response Pydantic models |
| `backend/src/repositories/*.py` | ✅ Written — UserRepository, DocumentRepository, JobRepository |
| `backend/src/services/auth_service.py` | ✅ Written — register, authenticate |
| `backend/src/services/document_service.py` | ✅ Written — upload, list, get, delete |
| `backend/src/services/job_service.py` | ✅ Written — create + background thread runner for all job types; organize handles pages from multiple source PDFs via `source_document_id` |
| `backend/src/routes/auth_routes.py` | ✅ Written — /auth/register, /auth/login, /auth/me |
| `backend/src/routes/document_routes.py` | ✅ Written — full CRUD + download |
| `backend/src/routes/job_routes.py` | ✅ Written — create, poll, list, delete, download |
| `backend/src/main.py` | ✅ Written — FastAPI app, CORS, startup init_db |
| `backend/src/**/__init__.py` | ✅ All `__init__.py` files created |

### 🚫 Backend — Not Yet Built

- `POST /jobs/crop` — by margins or custom rect
- `src/services/pdf_ops_service.py` — optional consolidation layer

### 🔧 Backend — Fixed / Improved (2026-04-10)

- `src/core/security.py` — added bootstrap patch at module top to inject `bcrypt.__about__.__version__` before passlib is imported; fixes the `(trapped) error reading bcrypt version` warning caused by bcrypt 4.x not re-exporting `__about__` at the top level
- `src/models/database.py` — replaced `StaticPool` with `NullPool` to prevent "cannot commit - no transaction is active" errors when multiple background threads access SQLite simultaneously
- `src/routes/job_routes.py` — download endpoint uses `StreamingResponse` with explicit `Content-Length` + `Accept-Ranges: none`; both ZIP (split) and single-file (PDF/DOCX) paths covered
- `src/repositories/document_repository.py` — changed `order_by(created_at.desc())` → `order_by(created_at.asc())` so `GET /documents` returns files in upload order

### ✅ Frontend — Complete

| File | Status |
|------|--------|
| `frontend/package.json` | ✅ Written — React 18, Vite 5, Tailwind 3, axios, react-router-dom, sonner, react-dropzone |
| `frontend/postcss.config.js` | ✅ Written |
| `frontend/vite.config.ts` | ✅ Written — proxy /api → localhost:8000 |
| `frontend/tailwind.config.js` | ✅ Written |
| `frontend/tsconfig.json` | ✅ Written — strict mode, path alias @/* |
| `frontend/tsconfig.node.json` | ✅ Written |
| `frontend/index.html` | ✅ Written |
| `frontend/src/main.tsx` | ✅ Written — BrowserRouter, AuthProvider, Toaster |
| `frontend/src/index.css` | ✅ Written — Tailwind directives + base styles |
| `frontend/src/App.tsx` | ✅ Written — ProtectedRoute/PublicRoute guards, all routes wired |
| `frontend/src/context/AuthContext.tsx` | ✅ Written — auto-restore session, login/register/logout |
| `frontend/src/services/api.ts` | ✅ Written — Axios singleton + native fetch() for blob downloads |
| `frontend/src/hooks/useJobPoll.ts` | ✅ Written — polls until done/failed, stoppedRef guard |
| `frontend/src/components/ui/Badge.tsx` | ✅ Written — variants + JobStatusBadge convenience |
| `frontend/src/components/ui/Button.tsx` | ✅ Written — variants, sizes, loading state |
| `frontend/src/components/ui/Card.tsx` | ✅ Written — Card + CardHeader + CardBody + CardFooter |
| `frontend/src/components/ui/Input.tsx` | ✅ Written — label, error, forwardRef |
| `frontend/src/components/ui/Layout.tsx` | ✅ Written — sticky header, nav, footer, mobile nav |
| `frontend/src/components/ui/ProgressBar.tsx` | ✅ Written — animated, 0–100% |
| `frontend/src/components/ui/Spinner.tsx` | ✅ Written — SVG animate-spin, sm/md/lg |
| `frontend/src/components/ui/Thumbnail.tsx` | ✅ Written — reusable page thumbnail card (selection, drag states) |
| `frontend/src/hooks/useReorderGrid.ts` | ✅ Written — drag state, gap index, isDirty, reset helpers |
| `frontend/src/pages/LoginPage.tsx` | ✅ Written — username + password, redirects if authed |
| `frontend/src/pages/RegisterPage.tsx` | ✅ Written — email, username, password, confirmPassword |
| `frontend/src/pages/DashboardPage.tsx` | ✅ Written — document table + recent jobs table |
| `frontend/src/pages/ReconstructPage.tsx` | ✅ Written — 4-state wizard: upload → ready → processing → done/failed |
| `frontend/src/pages/CombinePage.tsx` | ✅ Written — upload + select/delete controls + job + download |
| `frontend/src/pages/OrganizePage.tsx` | ✅ Redesigned — full-screen fixed workspace for Organize: left vertical PDF preview, right original-PDF thumbnail grid with 4 thumbnails per row, insert-source strip at bottom, checkbox-only selection, click-to-preview thumbnails, drag one inserted page between original pages |
| `frontend/src/pages/SplitPage.tsx` | ✅ Written — single-PDF upload + blue-to-red scissor split lines + ZIP download |
| `frontend/src/pages/ReorderPage.tsx` | ✅ Written — @dnd-kit sortable 5-col grid, drag ghost overlay, Save/Revert, job + download |
| `frontend/src/pages/PageNumbersPage.tsx` | ✅ Written — two-panel layout, single/facing modes, 2×2 PositionGrid, page range, format options, text style, job + download |
| `frontend/src/components/ui/PositionGrid.tsx` | ✅ Written — reusable 2×2 corner grid with red circle selector |
| `frontend/src/hooks/useFacingPages.ts` | ✅ Written — mirror logic for facing-pages mode |
| `frontend/src/components/ui/Thumbnail.tsx` | ✅ Updated — optional `pageNumberPosition` prop with red-circle corner overlay |

### 🚫 Frontend — Not Yet Built

- `frontend/src/pages/CropPage.tsx` — crop by margins or custom rect
- API methods for Crop (`api.ts` update)
- Routing entries for Crop (`App.tsx` update)

### 🔧 Backend — Fixed / Improved (2026-05-19)

- `src/pipeline.py` & `src/extract_layout.py` — Replaced standard `print` statements with Python's built-in `logging` module to profile performance. Timing logs for PyMuPDF layout extraction, YOLO rendering, YOLO batch inference, and per-page DOCX processing are now written to `backend/pipeline_timing.log` instead of the console, enabling detailed bottleneck analysis.

### 🔧 Backend — Fixed / Improved (2026-04-25)

- `src/pdf_operations/page_numbers.py` — Refactored text placement to use dynamic, per-page coordinate computation (replacing the old fixed-width `_get_rect` helper). Right-aligned positions (`top-right`, `bottom-right`) now compute `x0 = w - margin - text_length` to expand leftward, preventing any text from bleeding off the right edge. Bottom-aligned positions use `font_size` instead of the hardcoded `25`px offset, so the text baseline is always exactly at the page margin regardless of the configured font size.
- `src/pdf_operations/page_numbers.py` — Underline line length is now computed from the actual rendered text width via `get_text_length` (was hardcoded to 60px).
- `src/pdf_operations/page_numbers.py` — Added `_get_true_fontname(base, bold, italic)` helper that maps base font names to their correct PostScript variant names (e.g. `Helvetica-BoldOblique`). PyMuPDF's `insert_text` does not apply bold/italic from flags alone; the correct variant name must be passed as `fontname`.
- `src/utils/font_utils.py` — Added `get_text_length(text, font_name, font_size)` utility function that queries PyMuPDF for exact rendered text width, with a fallback estimation if native methods are unavailable.

### 🔧 Frontend — Fixed / Improved (2026-04-25)

- `PageNumbersPage.tsx` — fully implemented the Page Numbers feature UI previously listed as complete but missing from the repository, including two-column layout, Single/Facing page layout logic mappings, format inputs, and text stylings.
- `PageNumbersPage.tsx` — Facing mode now renders thumbnails as "book spreads" (paired spread cards with a center spine). An odd last page renders centered and alone in its spread card, not beside a blank cover.
- `PageNumbersPage.tsx` — Replaced native `<input type="color">` with a 20-swatch preset color table (clickable squares with selection ring).
- `PageNumbersPage.tsx` — Numeric inputs (`First number`, `From page`, `To page`, `Font size`) now store `number | ""` in state, allowing full keyboard interaction (backspace, clear, retype) without value jumping.
- `PositionGrid.tsx` — Cells are now explicitly sized `w-12 h-12` so they remain perfectly square regardless of surrounding layout. The red circle `<span>` is always rendered (toggling `bg-transparent` / `bg-red-500`) to prevent layout shift when selection changes.
- `Thumbnail.tsx` — successfully integrated the actual `pageNumberPosition` coordinate plotting logic over the cards.
- `api.ts` — added `PageNumberParams` schema and `createPageNumbersJob` request handler.
- `App.tsx` & `Layout.tsx` — wired navigation linking for the Page Numbers feature.
- `CombinePage.tsx` — fixed 3 bugs: (1) upload order now matches UI/output order, (2) Refresh replaced with Delete All + Delete Selected controls, (3) Clear Selection moved to header.
- `SplitPage.tsx` — redesigned: single upload-drop zone, split lines turn blue (idle/hover) → red (active); scissor icon color matches line state.
- `frontend/src/services/api.ts` — replaced axios blob downloads with native `fetch()` for `downloadJobResult` and `downloadDocument`.

### 🔧 Frontend — Fixed / Improved (2026-06-07)

- `frontend/src/pages/OrganizePage.tsx` — redesigned Organize into a full-screen split workspace. The left side shows a readable vertical continuous PDF preview. The right side shows original-PDF thumbnails in exactly 4 columns.
- `frontend/src/pages/OrganizePage.tsx` — changed thumbnail behavior: clicking a thumbnail previews that PDF/page on the left; selecting pages is done only through the small checkbox in the thumbnail's top-left corner.
- `frontend/src/pages/OrganizePage.tsx` — replaced the old insert-mode plus-icon/gap-click logic. The Insert icon now imports a second PDF, shows its thumbnails in a single horizontal strip at the bottom of the right panel, and supports dragging one inserted page into a gap between original pages.
- `frontend/src/pages/OrganizePage.tsx` — fixed Organize import failure by using `PREVIEW_WIDTH = 800`, matching the backend `/documents/{id}/thumbnails` validation limit (`width <= 800`). The previous `900` request caused upload to succeed but thumbnail loading to fail.
- `frontend/src/components/ui/Layout.tsx` — Organize route now bypasses the shared centered `max-w-7xl` page wrapper and hides the footer so the workspace can use the full screen.
- `frontend/src/pages/OrganizePage.tsx` + `frontend/src/components/ui/Layout.tsx` — Organize is fixed-height with `overflow-hidden` at the page level. Only the left PDF preview pane and right thumbnail pane scroll vertically.
- Verification: `http://localhost:5175/` returned HTTP 200, and `npx tsc --noEmit --noUnusedLocals false --noUnusedParameters false` passed.

### 🔧 Frontend — Fixed / Improved (2026-06-23)

- `frontend/src/components/ui/PdfPreview.tsx` — created a new global PDF preview component using `react-pdf` to allow users to visually inspect processed outputs before downloading. Used a high-resolution canvas scaled via CSS (`width={1200}`, `[&>canvas]:!max-w-full [&>canvas]:!h-auto`) to ensure crisp text while eliminating horizontal scrolling.
- `OrganizePage.tsx`, `ReorderPage.tsx`, `CropPage.tsx`, `PageNumbersPage.tsx` — integrated the `PdfPreview` component into their respective success states.
- `frontend/src/pages/DashboardPage.tsx` — enhanced the Dashboard to display separate tables for uploaded files and successfully processed outputs. Added bulk-selection checkboxes next to Delete buttons to easily clear storage space. Mapped internal job names to user-friendly titles (e.g., `reconstruct` -> `CONVERT`).
- `frontend/src/pages/CropPage.tsx` — optimized the layout by moving the output filename input above the action buttons to span full width, and implemented inline validation errors to prevent UI shifting.
- `OrganizePage.tsx` — fixed layout bug where the full-screen grid view's strict `overflow-hidden` constraint caused triple scrollbars in the success view; conditionally applied constraints so the result view flows naturally.
- State Syncing — fixed dual-rendering of progress bars and success views across tools by consolidating status checks to use the latest polled job state (`jobToShow`).

### 🔧 Frontend & Backend — Fixed / Improved (2026-06-24)

- `InsertPage.tsx` & `api/jobs/insert` — Extracted the PDF insertion functionality from Organize into a standalone dedicated `InsertPage`. Utilizes a 2-panel interface: original PDF thumbnails at the top and imported PDF thumbnails at the bottom. Users can drag pages from the bottom strip directly into the top strip to inject them. Deleting an inserted page from the top strip returns it to the bottom.
- `OrganizePage.tsx` & `InsertPage.tsx` — Fixed scrolling behavior so these tools cleanly feature 2 vertical scrollbars without redundant layout nesting or jumping bugs when clicking a thumbnail.
- `ReconstructPage.tsx` — Retitled to "PDF-to-DOCX Conversion". The workflow was streamlined so that the original PDF instantly renders a full `PdfPreview` component immediately upon upload alongside a new "Start Conversion" button. Processing copy was updated. Removed browser-based DOCX previewing logic (`docx-preview` / `@cyntler/react-doc-viewer`), favoring direct DOCX download instead.

> **Why was in-browser DOCX preview removed?**
> To perfectly recreate complex PDF layouts (e.g., side-by-side columns, floating images), the backend PDF-to-DOCX converter relies on continuous floating text boxes or borderless tables rather than standard text flows with hard `<w:pageBreak>` tags. Browser-based previewers (like `docx-preview`) lack the heavy, dynamic layout engines required to calculate A4 paper margins and slice the content. Consequently, they render the entire file as one continuous scrolling page. However, when opened in Microsoft Word, its advanced layout engine correctly calculates boundaries and displays the document cleanly separated into individual pages.

### 🔧 Frontend & Backend — Fixed / Improved (2026-06-25)

- `MergePage.tsx` (Combine) & `SplitPage.tsx` — Integrated the `PdfPreview` component natively into the success states.
- `SplitPage.tsx` — Replaced the static table of parts with a rich, interactive preview experience. Users can now paginate through the exact segments generated by the split job right in the browser using numeric segment inputs. Hid the instructional text, dropzone, and "Split Another" button once a document is active.
- `job_routes.py` — Updated `/api/jobs/{job_id}/download` endpoint to accept an optional `part_index` parameter. This allows the frontend to fetch specific split segments as standard PDF blob URLs for rendering rather than downloading the entire `.zip` payload, conserving browser memory.
- UI Polish — Eliminated triple scrollbar issues on both the Merge and Split result views, standardizing them to closely match the 2-scrollbar constraint used by the other PDF operation tools.
- `OrganizePage.tsx` — Fixed a scrolling race-condition bug on the PDF preview pane by changing `scrollIntoView` behavior from "smooth" to "auto", eliminating erratic jumping behavior when selecting distant pages.
- `InsertPage.tsx` — Upgraded page number badges: the Source Document indicator (top-left) is now larger, borderless, and blue to clearly contrast against the sequence number. If it belongs to the second document, the color is strictly red for instant visual distinction. The sequence number (bottom-center) now recalculates dynamically as pages are reordered or transferred.
- `InsertPage.tsx` — Fixed a major duplication/sorting bug caused by nested React state updaters triggering multiple times during React 18 StrictMode development. Drag/drop and delete handlers now resolve their state independently. The trash bin icon on inserted pages is now permanently visible instead of hover-only to improve discoverability.
- `ReorderPage.tsx` — Corrected grid spacing. The layout now aligns drag-and-drop zones horizontally beside thumbnails rather than incorrectly stacking them vertically below the thumbnails, preventing massive row gaps.

### ✅ Backend — External Hyperlink Preservation (2026-06-25)

- `src/extract_layout.py` — Added `_tag_spans_with_links()` that calls `page.get_links()` on each PDF page, filters to external URI links (`kind == LINK_URI`), and tags every text span whose bounding box is at least 30% contained within the link rectangle (`_span_link_overlap_ratio` containment check) with `span["url"] = uri`. Containment ratio is used instead of IoU because a small span fully inside a large link rect would have very low IoU despite being a correct match.
- `src/yolo/iou_matching.py` — Added `url: Optional[str] = None` field to `TextElement` dataclass and `url=span.get("url")` propagation in `text_elements_from_spans()`.
- `src/docx_generator/processors.py` — Added `_add_hyperlink()` function that bypasses `python-docx`'s high-level API to inject `<w:hyperlink>` XML elements with external relationship IDs, styled with Word's default hyperlink appearance (blue `#0563C1` + single underline). Added `_add_text_or_hyperlink()` dispatcher that checks `elem.url` and routes to the hyperlink path or the standard `add_run` + `_apply_span_style` path. Both text-run insertion points in `process_text_block()` now use this dispatcher.

## 4. Backend — API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login (OAuth2 password flow), returns JWT |
| `GET` | `/api/auth/me` | Get current user (requires Bearer token) |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents` | Upload a PDF file |
| `GET` | `/api/documents` | List user's documents (paginated), ordered by upload time (ascending) |
| `GET` | `/api/documents/{id}` | Get a single document |
| `DELETE` | `/api/documents/{id}` | Delete a document |
| `GET` | `/api/documents/{id}/download` | Download the original PDF |
| `GET` | `/api/documents/{id}/thumbnails` | Get page thumbnails/previews (base64 PNG) for tool UIs; `width` query is validated from 50 to 800 px |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs/reconstruct` | Start PDF → DOCX job (async) |
| `POST` | `/api/jobs/combine` | Start combine PDFs job (async) |
| `POST` | `/api/jobs/split` | Start split PDF job (async) |
| `GET` | `/api/jobs/{id}/parts` | List split parts after split job completes |
| `POST` | `/api/jobs/organize` | Start organize pages job (async) — delete, rotate, reorder |
| `POST` | `/api/jobs/extract` | Start extract pages job (async) — immediate extract to separate PDF |
| `POST` | `/api/jobs/reorder` | Start reorder pages job (async) — new page sequence |
| `POST` | `/api/jobs/page-numbers` | Start page-numbering job (async) — single or facing-pages mode |
| `GET` | `/api/jobs/{id}` | Poll job status + progress |
| `GET` | `/api/jobs` | List user's jobs (filterable by status) |
| `DELETE` | `/api/jobs/{id}` | Delete a job + its output file |
| `GET` | `/api/jobs/{id}/download` | Download job output (DOCX or PDF) |

---

## 5. Database Schema (SQLite via SQLModel)

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents (owned PDFs)
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES user.id,
  original_filename TEXT,
  stored_filename TEXT,   -- UUID-based on disk
  file_path TEXT,         -- absolute path
  file_size INTEGER,
  file_type TEXT DEFAULT 'pdf',
  page_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jobs (async processing tasks)
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES user.id,
  document_id INTEGER REFERENCES document.id,
  tool TEXT,               -- reconstruct, combine, split, organize, extract, reorder, page-numbers
  status TEXT,             -- pending, processing, done, failed
  input_document_ids TEXT, -- JSON list (for combine) or pages JSON (organize/extract)
  output_filename TEXT,
  output_path TEXT,
  error_message TEXT,
  progress INTEGER DEFAULT 0, -- 0–100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Job Processing Model

Jobs run in **background threads** inside the FastAPI process (via `threading.Thread`). Each thread gets its own DB session from `NullPool` to avoid SQLite concurrency errors.

```
Client                     FastAPI                        Background Thread
  │                            │                                  │
  ├─ POST /jobs/reconstruct ───►│                                  │
  │                            ├── create Job (status=pending)     │
  │                            │                                  │
  │◄── 202 {job_id} ───────────┤                                  │
  │                            │                                  │
  │                            │───────────────────────────────►   │
  │                            │  thread → _run_reconstruct        │
  │                            │                                   ├─ extract layout (progress=30%)
  │                            │                                   ├─ run pipeline  (progress=60%)
  │                            │                                   └─ save output    (progress=100%)
  │                            │                                   │
  ├─ GET /jobs/{id} ◄──────────┤◄──────────────────────────────────┘
  │   (poll every 2s)          │  status=processing, progress=60%
  │                            │
  ├─ GET /jobs/{id}            │
  │◄── status=done, 100% ──────┤
  │                            │
  ├─ GET /jobs/{id}/download ◄─┤── serve output file (StreamingResponse)
```

**Polling interval:** 2 seconds on the client side (`useJobPoll` hook).

**Failed jobs:** Automatically deleted from DB after the error response is returned to the client (no zombie failed records shown to users).

---

## 7. How to Test

### Prerequisites

```bash
# Backend
cd backend
cp .env.example .env
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Run Backend

```bash
# Option A: Direct (development)
cd backend
python run.py
# or
uvicorn src.main:app --reload --port 8000

# Option B: Docker
cd backend
docker compose up
```

### Run Frontend

```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

### Test Combine PDFs

1. Register / log in at `http://localhost:5173`
2. Navigate to **Combine** in the nav bar
3. **Upload** PDFs — drop or click to select; files are automatically added and checked; they appear in upload order (which is also the combine order)
4. **Clear Selection** — unchecks all without removing files from the list
5. **Delete (N)** — deletes selected files from the server
6. **Delete All** — deletes all uploaded files from the server
7. Enter an output filename and click **Combine**
8. Wait for the job to finish → click **Download Combined PDF**

### Test Split PDF

1. Navigate to **Split** in the nav bar
2. Drop or click to upload a single PDF — thumbnails load automatically
3. Click the **blue** vertical lines between pages to add split points; lines turn **red** when active
4. Click the red chips below to remove split points, or **Clear all** to reset
5. Enter a base filename and click **Split PDF**
6. Download the ZIP of parts → **Split Another** resets to the upload drop zone

### Test Organize, Reconstruct

All other tools work independently. See their respective pages under the nav bar.

---

## Current Challenges & Insights

**Challenge:** The PDF → DOCX Reconstruction pipeline is currently too slow. Processing a 33-page document takes nearly a minute (around 58 seconds on CPU), which needs to be scaled down to seconds for a better user experience.

**Insights found via profiling (`pipeline_timing.log`):**
1. **YOLO Inference Bottleneck (~67% of total time):** The `DocLayout-YOLO` model executes natively via PyTorch on the CPU. It handles layout structural detection (bounding boxes for titles, text, tables, figures) but does *not* do OCR. Matrix multiplications on the CPU cause inference to take ~39 seconds for 33 pages.
2. **Redundant Rendering & Disk I/O (~27% of total time):** PyMuPDF layout extraction (`extract_layout.py`) takes ~13 seconds, predominantly wasted on saving high-resolution (300/600 DPI) debug page images to disk. Furthermore, the pipeline loads the PDF and re-renders the pages a second time in memory for the YOLO inference, causing redundant processing overhead.

**Current Challenge (2026-05-24):** The PDF → DOCX Reconstruction pipeline still exhibits several edge-case inaccuracies following the DPI and layout matching improvements:
1. **Ordering issues:** References (e.g., Reference 1 and Reference 19) appear out of order or misplaced. This occurs because when text blocks match to a giant YOLO layout region, the `LayoutBlock` inherits the giant bounding box instead of a tight bounding box, breaking the pipeline's row-grouping/sorting logic.
2. **Missing specific text blocks:** Some content (e.g., the text under "Call Number: 2") is completely swallowed. This is caused by an overly aggressive heuristic in the row-grouping logic (`pipeline.py`) that mistakenly detects horizontally aligned text snippets (like `Output:` and `1`) as an undetected table, diverting them to a table image extractor that fails on plain text.
3. **Image Scaling:** Images and icons are being blown up to full page width (6 inches). The `process_figure_block` function indiscriminately forces `width=max_image_width` on every image instead of respecting the original dimensions from the PDF.

**Proposed Solutions:**
1. **Ordering Fix:** Update `iou_matching.py` so that a `LayoutBlock` computes a "tight" bounding box based exactly on the `TextElements` it contains, rather than blindly inheriting the YOLO region's sloppy bounding box.
2. **Table Heuristic Fix:** Update `pipeline.py` to bypass the implicit `use_table` heuristic if the blocks are classified as `plain text` or `title`, ensuring text isn't accidentally swallowed.
3. **Image Scaling Fix:** Update `processors.py` to calculate the physical width of the image from its PDF coordinates (`(x1 - x0) / 72.0` inches) and pass that calculated width (capped at 6 inches) to `add_picture`.

**Current Status (2026-06-01):** The PDF -> DOCX reconstruction edge-case fixes above have been implemented and verified against `Test.pdf`.

Resolved:
1. **Reference ordering:** `backend/src/yolo/iou_matching.py` now computes tight bounding boxes from matched text spans and avoids sorting text blocks by giant YOLO regions. Verification confirmed references `[1]` through `[19]` appear in order.
2. **Dropped text near "Call Number: 2":** `backend/src/pipeline.py` now blocks implicit table-row detection for ordinary `plain text` / `title` rows, and `backend/src/docx_generator/processors.py` raises/falls back instead of silently producing empty table output. Verification confirmed `Call Number: 2` and `System: External Move Validator system prompt` are present.
3. **Image/table scaling:** `backend/src/docx_generator/processors.py` now inserts figures/tables using the physical size implied by the PDF bbox width and height, rather than forcing every image to `max_image_width`.
4. **Original PDF page numbers:** `backend/src/pipeline.py` filters standalone centered numeric footer blocks on every page, preventing artifacts such as `2 as self-critique...` and standalone `3` before the Figure 2 caption.
5. **Author/metadata rows:** short same-line metadata rows are no longer reconstructed as borderless tables. `process_spaced_metadata_row()` renders them as tab-spaced paragraphs, preserving internal line breaks and using per-line minimum span `x0` coordinates from PyMuPDF. Verification output showed author name/university/email rows use different tab positions based on their extracted coordinates.

Verification artifacts:
- `backend/data/outputs/verification/Test_verify_backend.docx`
- `backend/data/outputs/verification/Test_spaced_authors.docx`
- `backend/data/outputs/verification/Test_author_tabs_absolute.docx`
- `backend/data/outputs/verification/Test_author_line_coords.docx`

**Current Status (2026-06-07):** Additional PDF -> DOCX reconstruction fixes were implemented and verified.

Resolved:
1. **Caption/text colors:** `backend/src/docx_generator/processors.py` now strictly applies PyMuPDF span colors per run; when no color is available, default text color is black.
2. **Duplicate table images:** `backend/src/yolo/iou_matching.py` tracks `layout_region_index` in `LayoutBlock.extra`, and `backend/src/pipeline.py` uses it to avoid adding the same YOLO table region twice. Table/figure image crops continue to use the raw YOLO bbox, while tight text bbox is kept separately for text-ordering logic.
3. **Table caption overlap trimming:** `backend/src/pipeline.py` trims obvious caption overlap from table image crops using nearby text/caption geometry, avoiding the duplicated Table 1 crop artifact seen in the verification document.
4. **OpenVINO model export workflow:** `backend/src/model_loader.py` now uses the default `yolov10_openvino_model` export folder as a temporary location and moves the result to a size-specific model folder. Old default-folder backups are no longer needed.
5. **YOLO input size:** `backend/src/model_loader.py` currently uses `INPUT_SIZE = 896`, selected as the practical quality/speed balance after testing larger sizes.

Verification artifacts:
- `backend/data/outputs/verification/Test_option2_896.docx`
- `backend/data/outputs/verification/Test_option2_896_trimmed.docx`
- `backend/data/outputs/verification/Test_option2_960.docx` (tested but not preferred; 960 was worse/slower than 896)

Remaining reconstruction concerns:
1. DOCX pagination still differs from PDF pagination because Word layout metrics do not exactly match PDF layout.
2. The pipeline still relies on heuristics for metadata rows, footer filtering, implicit table detection, and paragraph merging.
3. Performance remains a separate concern; OpenVINO inference improved practical runtime, but reconstruction still needs profiling before production polish.

**Current Status (2026-06-30):** Single-column PDF -> DOCX reconstruction layout and wrapping fixes implemented and verified.

Resolved:
1. **Single-column margin overwrites:** `backend/src/pipeline.py` no longer artificially overwrites the default 1.0 inch DOCX margins with calculated tight bounding box margins for single-column documents. This prevents extreme layout shifting.
2. **Horizontal spacing & Justify detection:** `backend/src/docx_generator/processors.py` defaults to `WD_ALIGN_PARAGRAPH.LEFT` to eliminate stretched horizontal gaps. To support academic-style formatting, an intelligent `is_justified` detection heuristic was added. It groups elements into visual lines and if ≥60% of lines end at the exact same right-edge x-coordinate, it applies `JUSTIFY`, otherwise it defaults to `LEFT`.
3. **Premature line wrapping & merging:** `backend/src/docx_generator/processors.py` re-implemented the `right_indent` constraint but with an added 0.1 inch tolerance buffer. This provides just enough extra width to accommodate DOCX font rendering differences from PDF, preventing premature wrapping while still respecting genuine right-indented blocks.
4. **Vertical Line gaps:** Line spacing rule is currently set to `SINGLE` to maintain text reflow stability, though exact bounding-box based spacing can be re-applied if further vertical tightness is desired.
5. **Section Hierarchy & Artifacts:** Heading inference now correctly maps lowercase prefixes (e.g. `a)`, `b.`) to subordinate Word outline levels, and intelligently nests unnumbered textual headers inside the last known numbered section. Additionally, invisible ghost text layers (e.g. pure white text) from the PDF are aggressively forced to black text so they appear correctly as visible section headers in the output DOCX.

6. **Image Duplication Prevention**: To prevent smaller YOLO thumbnail predictions from appending sequentially after a larger parent image/table containing them, an Intersection-over-Area (IoA) containment ratio check (>0.90) was added to `backend/src/pipeline.py`. If a block is >90% contained inside a larger figure/table, it is aggressively filtered out.
7. **Small Caps Span Gap Prevention**: A bug causing artificial spaces inside "Small Caps" words (e.g. "D OC L AYOUT" instead of "DOC LAYOUT") was fixed in `backend/src/docx_generator/processors.py`. PyMuPDF separates these characters into separate spans due to font-size differences. The layout rendering loop was unconditionally injecting a trailing space after every span. It now calculates horizontal adjacency to the next span on the same line, and only injects a space if the horizontal gap is ≥ 40% of the font size.

Verification: PDF and DOCX visual appearance is now extremely identical. The restored right margin and justification constraints currently cause a minor page count shift (33 original pages -> 35 DOCX pages) due to the slight accumulation of layout differences over a long document, which is a massive improvement from the initial 41-page inflation. The output no longer has "exploded" composite images nor artificially broken Small Caps words.

---

## 8. Implementation Plan

### Priority 1 — Backend: Remaining PDF Operations
- [ ] `POST /jobs/crop` — by margins or custom rect
- [ ] `src/services/pdf_ops_service.py` — optional consolidation layer
- [x] External link extraction/preservation — extract `/Link` URI annotations from source PDF pages and map them to the corresponding text spans in the output DOCX as clickable hyperlinks (span-level tagging with containment ratio)

### Priority 2 — Frontend: Remaining Tool Pages
- [ ] Write `frontend/src/pages/CropPage.tsx` — crop by margins or custom rect
- [ ] API methods for Crop (`api.ts` update)
- [ ] Routing entries for Crop (`App.tsx` update)

### ✅ Completed — Page Numbers

#### Feature Overview

A two-panel page-numbering tool with a left panel (thumbnails with red-circle position markers) and a right panel (options). Two numbering modes:

- **Single-page mode** — each page is numbered individually at the chosen corner position (TL, TR, BL, BR).
- **Facing-pages mode** — pages are treated in pairs; the second page mirrors the first horizontally (TL↔TR, BL↔BR). An odd last page is treated as standalone (no mirror needed). "First page is cover page" checkbox is **not** implemented.

Position is selected via a **2×2 corner grid** (TL / TR / BL / BR) shown in the options panel. The chosen cell shows a red circle marker. Thumbnails on the left also display a red circle marker at the matching position to give live visual feedback.

Numbering is scoped to a user-selected page range (e.g. "from page 2 to 5" → only those thumbnails show the red marker, only those pages are numbered in the output).

#### Backend (`backend/src/`)

- `src/pdf_operations/page_numbers.py` — `add_page_numbers(doc_path, output_path, config)` using pymupdf
  - `config` is a `PageNumberConfig` dict: `{mode, position, start_number, from_page, to_page, total_pages, format, font_name, font_size, bold, italic, underline, color}`
  - `position` values: `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
  - `mode`: `"single"` or `"facing"`
  - `format`: `"number-only"` | `"page-n"` | `"page-n-of-p"` | `"custom"`
  - `format == "custom"`: user-supplied string may contain `{n}` (current page number) and `{p}` (total pages)
  - In facing mode: process pages as pairs `(1,2), (3,4), ...`. Page at odd index → chosen position; page at even index → horizontally mirrored position. Odd leftover page → chosen position directly.
  - Progress reported to DB via `update_job_progress(job_id, pct)` at start and end (100%)
- `src/models/schemas.py` — `PageNumberFormat` (Literal), `PageNumberPosition` (Literal), `PageNumberMode` (Literal), `TextStyle`, `PageNumberConfig` (Pydantic model), `PageNumberRequest`
- `src/services/job_service.py` — `create_page_numbers_job()`, `_run_page_numbers()`
- `src/services/pdf_ops_service.py` — optional consolidation layer (may be skipped if logic stays in `page_numbers.py`)
- `src/routes/job_routes.py` — `POST /jobs/page-numbers`
- `src/models/database_models.py` — add `PAGE_NUMBERS` to `JobTool` enum

#### Frontend (`frontend/src/`)

- `src/components/ui/PositionGrid.tsx` — new reusable component
  - Props: `value: Position`, `onChange: (pos: Position) => void`, `size?: "sm" | "md" | "lg"`
  - 2×2 grid of cells (TL, TR, BL, BR); each cell is a white rounded box
  - Selected cell has a red circle centered in it
  - Hover state on unselected cells (light blue tint)
  - CSS grid layout, no external icon library needed
- `src/components/ui/Thumbnail.tsx` — updated
  - New optional prop: `pageNumberPosition?: Position | null`
  - When `pageNumberPosition` is set, render an absolutely-positioned red circle (12px diameter) at the matching corner of the thumbnail card
  - Red circle uses `position: absolute` with corner offset (e.g. `bottom: 8px; left: 8px` for bottom-left)
- `src/hooks/useFacingPages.ts` — new hook
  - `useFacingPages(mode, position)` → `{ getPositionForPage: (pageIndex: number) => Position }`
  - In `single` mode: returns the chosen position for all pages
  - In `facing` mode: even index (0-based) → chosen position; odd index → horizontally mirrored position
- `src/pages/PageNumbersPage.tsx` — main page
  - Two-panel layout: left = thumbnail grid (scrollable), right = options panel (fixed/sticky)
  - State: `uploadedFile`, `thumbnails`, `mode`, `position`, `startNumber`, `fromPage`, `toPage`, `format`, `customText`, `fontName`, `fontSize`, `bold`, `italic`, `underline`, `color`, `jobId`, `jobStatus`
  - Left panel: `@dnd-kit`-style CSS grid 4-col (or responsive 2/3-col), each thumbnail shows `Thumbnail` with `pageNumberPosition` applied only to pages in `[fromPage, toPage]` range
  - Right panel sections:
    1. **Page mode** — radio buttons: Single page / Facing pages
    2. **Position** — `PositionGrid` component
    3. **First number** — numeric input (min 1, default 1)
    4. **Pages** — "from page" + "to page" numeric inputs (1-indexed, bounded by thumbnail count)
    5. **Format** — radio group: Number only (recommended) / Page {n} / Page {n} of {p} / Custom
       - Custom: text input + helper line "Text samples: {n}, Page {n}, Page {n} of {p}"
    6. **Text format** — font name dropdown, font size input, B / I / U toggles, color picker (or preset swatches)
    7. **Add page numbers** — red primary button; calls `createPageNumbersJob`, then polls via `useJobPoll`, then offers download on completion
  - "Single page" screenshot: all thumbnails in a 2×4 grid (8 pages), each with a red circle marker at the chosen corner; right panel shows Single page radio selected, 2×2 grid with red dot in one cell
  - "Facing pages" screenshot: same layout but Facing pages radio selected; thumbnail markers reflect the mirror logic
  - "Page Number options" (screenshot 3): right panel fully expanded showing all sections
  - "Page Number options" text tab (screenshot 4): same right panel but showing the Custom / Text format sections
  - On job completion: replace the "Add page numbers" button with a "Download Numbered PDF" button
  - `useCallback`-wrapped handlers; no inline anonymous functions in render
- `src/services/api.ts` — new methods:
  - `createPageNumbersJob(params: PageNumberParams): Promise<{ job_id: string }>`
  - `uploadDocumentForPageNumbers(file: File): Promise<Document>` (reuse existing uploadDocument or POST /api/documents)
- `src/App.tsx` — add route: `/page-numbers` → `PageNumbersPage` (inside `ProtectedRoute`)
- `src/components/ui/Layout.tsx` — add nav link: `/page-numbers` → "Page Numbers" (in the nav bar alongside Split, Organize, Reorder, Combine, Reconstruct)

#### `PageNumberParams` Type

```typescript
type PageNumberPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type PageNumberFormat = "number-only" | "page-n" | "page-n-of-p" | "custom";
type PageNumberMode = "single" | "facing";

interface PageNumberParams {
  documentId: number;
  mode: PageNumberMode;
  position: PageNumberPosition;   // chosen corner; mirror applied automatically in facing mode
  startNumber: number;            // first number to use (default 1)
  fromPage: number;                // 1-indexed start of range
  toPage: number;                  // 1-indexed end of range
  format: PageNumberFormat;
  customText?: string;             // required when format === "custom"; may contain {n} and {p}
  fontName: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;                   // hex string e.g. "#000000"
}
```

### ✅ Completed — Reorder Pages
- `backend/src/models/database_models.py` — added `REORDER` to `JobTool`
- `backend/src/models/schemas.py` — added `ReorderRequest`
- `backend/src/services/job_service.py` — `create_reorder_job` + `_run_reorder` using existing `reorder_pages()`
- `backend/src/routes/job_routes.py` — `POST /jobs/reorder`
- `frontend/src/hooks/useReorderGrid.ts` — drag state + gap logic
- `frontend/src/pages/ReorderPage.tsx` — @dnd-kit sortable 5-col grid, ghost overlay, Save/Revert, job + download
- `frontend/src/services/api.ts` — `createReorderJob`
- `frontend/src/App.tsx` + `Layout.tsx` — `/reorder` route + nav link
- `frontend/package.json` — added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### ✅ Completed — Page Numbers
- `backend/src/models/database_models.py` — added `PAGE_NUMBERS` to `JobTool`
- `backend/src/models/schemas.py` — `PageNumberFormat`, `PageNumberPosition`, `PageNumberMode`, `PageNumberRequest`
- `backend/src/services/job_service.py` — `create_page_numbers_job()` + `_run_page_numbers()`
- `backend/src/routes/job_routes.py` — `POST /jobs/page-numbers`
- `backend/src/pdf_operations/page_numbers.py` — `add_page_numbers()` with single + facing-pages modes
- `frontend/src/components/ui/PositionGrid.tsx` — reusable 2×2 corner grid with red circle selector
- `frontend/src/components/ui/Thumbnail.tsx` — updated: optional `pageNumberPosition` prop with red-circle corner overlay
- `frontend/src/hooks/useFacingPages.ts` — mirror logic for facing-pages mode
- `frontend/src/pages/PageNumbersPage.tsx` — two-panel layout, all options, job + download
- `frontend/src/services/api.ts` — `createPageNumbersJob` + `uploadDocumentForPageNumbers`
- `frontend/src/App.tsx` + `Layout.tsx` — `/page-numbers` route + nav link

### Priority 3 — DevOps & Polish
- [ ] Production `Dockerfile` (multi-stage build for frontend static files served by Nginx)
- [ ] Production `docker-compose.yml` with `nginx` service as reverse proxy
- [ ] `.gitignore` update to exclude `backend/data/`, `backend/.env`
- [ ] README with setup instructions
- [ ] Auto-cleanup of old job outputs (`data/outputs/`, `data/layouts/`)

---

## 9. Existing Modules (src/ — pipeline logic, unchanged)

> These are the original modules that power the PDF → DOCX reconstruction. They remain unchanged; the backend imports and calls them directly.

```
src/
├── pipeline.py               # PDFToDocxPipeline (Stage 1–4 orchestration)
├── extract_layout.py        # extract_pdf_layout() — Stage 0 pre-extraction
├── model_loader.py          # load_doclayout_model() — HuggingFace download
│
├── yolo/
│   ├── iou_matching.py      # IoU, LayoutBlock, TextBlock, match_blocks_to_layout
│   └── pdf_utils.py         # render_page_to_image, bbox converters
│
├── docx_generator/
│   └── processors.py        # process_text_block, process_table_block, etc.
│
├── utils/
│   ├── font_utils.py        # clean_font_name, round_font_size, get_text_length
│   ├── heading_utils.py     # get_section_heading_level
│   └── table_utils.py       # is_same_line, horizontally_separated, etc.
│
└── pdf_operations/
    ├── combine.py            # combine_pdfs() — pure pymupdf ✅
    ├── split.py              # split_by_points() ✅
    ├── organize.py           # delete/rotate/extract/insert helpers ✅
    ├── crop.py               # crop_by_margins, crop_by_rect (planned)
    └── page_numbers.py       # add_page_numbers() — single + facing-pages modes ✅
```

---

## 10. Design Decisions

### SQLite (via SQLModel) — Why
No separate database service needed; single `autodoc.db` file alongside the app. Sufficient for a university project with single-server deployment. Can be swapped for PostgreSQL by changing `DATABASE_URL` in `.env`.

### Background threads (not Celery) — Why
Single-process simplicity. The PDF processing pipeline (pymupdf, YOLO inference) is CPU-bound but already thread-safe at the function level. Threads are sufficient and avoid the complexity of Redis + Celery workers for this scale.

### Async polling (not WebSockets/SSE) — Why
Simpler client and server implementation. The React frontend polls `GET /api/jobs/{id}` every 2 seconds via `useJobPoll`. WebSockets could be added later as an optimization.

### JWT stored in localStorage — Why
Standard practice for SPA auth. HttpOnly cookie would require a proxy-aware setup; localStorage is simpler for this project. Token expires in 24 hours.

### Hot reload via volume mount — Why
Docker Compose mounts `./backend:/app`, and uvicorn `--reload` watches `/app`. No need to rebuild the image on every code change during development.

### Vite proxy for API calls — Why
`vite.config.ts` proxies `/api/*` → `http://localhost:8000`, so the React app calls `/api/*` in development without CORS issues. In production, Nginx serves the built React files and proxies to FastAPI.

### Blob downloads via native fetch (not axios) — Why
Axios's `responseType: "blob"` through Vite's dev proxy causes `net::ERR_FAILED` on large binary responses (HTTP 206 Partial Content truncation). `downloadJobResult` and `downloadDocument` in `api.ts` use native `fetch()` instead. The backend serves all file responses via `StreamingResponse` with explicit `Content-Length` and `Accept-Ranges: none` headers.

### passlib + bcrypt compatibility — Why the bootstrap patch
`passlib 1.7.x` reads `bcrypt.__about__.__version__` to detect the backend. bcrypt 4.x moved `__about__` out of the top-level namespace. `src/core/security.py` injects `bcrypt.__about__` at module load time before passlib is imported, making the warning disappear without requiring any passlib code changes.

---

## 11. Dependencies

### Backend

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ≥0.110.0 | Web framework |
| `uvicorn[standard]` | ≥0.27.0 | ASGI server with hot reload |
| `python-multipart` | ≥0.0.9 | File upload parsing |
| `sqlmodel` | ≥0.0.14 | ORM + Pydantic integration |
| `aiosqlite` | ≥0.19.0 | Async SQLite driver |
| `python-jose[cryptography]` | ≥3.3.0 | JWT encoding/decoding |
| `passlib[bcrypt]` | ≥1.7.4 | Password hashing |
| `bcrypt` | ≥4.1.0,<4.2.0 | Backend for passlib (must be <4.2.0 for passlib compatibility) |
| `email-validator` | ≥2.0.0 | Email validation for Pydantic `EmailStr` |
| `pydantic-settings` | ≥2.0.0 | Settings from env vars |
| `pymupdf` | ≥1.23.0 | PDF processing |
| `python-docx` | ≥1.1.0 | DOCX generation |
| `torch`, `ultralytics`, `doclayout-yolo` | latest | YOLO model (reconstruction only) |
| `opencv-python`, `Pillow` | latest | Image cropping |
| `huggingface_hub` | ≥0.20.0 | Model download |
| `python-dotenv` | ≥1.0.0 | Env var loading |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` + `react-dom` | ^18.2.0 | UI framework |
| `react-router-dom` | ^6.20.0 | Client-side routing |
| `axios` | ^1.6.0 | HTTP client |
| `sonner` | ^1.2.0 | Toast notifications |
| `react-dropzone` | ^14.2.3 | Drag-and-drop file upload |
| `@vitejs/plugin-react` | ^4.2.0 | Vite React integration |
| `tailwindcss` + `autoprefixer` + `postcss` | ^3.3.6 / ^10.4.16 / ^8.4.32 | CSS utility framework |
| `typescript` | ^5.3.0 | Type safety |
| `vite` | ^5.0.0 | Build tool |

