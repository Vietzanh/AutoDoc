# AutoDoc — Project Context

> **Last updated:** 2026-04-05
> **Status:** Organize + Split complete · Remaining: Crop + Page Numbers backend/frontend + DevOps

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
│   │   └── security.py        # JWT hashing, token creation, get_current_user
│   │
│   ├── models/                # DB models & API schemas
│   │   ├── database.py        # SQLModel engine, session factory, init_db()
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
│       └── job_routes.py       # Create + poll + download for jobs
│
└── data/                       # Auto-created at runtime (gitignored)
    ├── uploads/{user_id}/      # Uploaded PDF files
    ├── outputs/{job_id}/       # Generated DOCX / PDF output files
    └── autodoc.db              # SQLite database
```

### Frontend Structure (`frontend/`)

```
frontend/
├── package.json               # React 18, Vite, Tailwind, axios, react-router-dom, sonner, react-dropzone
├── postcss.config.js
├── vite.config.ts             # Dev proxy: /api → http://localhost:8000
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
    │   └── api.ts             # Axios singleton with typed methods for all endpoints
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
        ├── RegisterPage.tsx   # Register form (email, username, password, confirmPassword)
        ├── DashboardPage.tsx  # Document table + Recent Jobs table
        ├── ReconstructPage.tsx # 4-state wizard: upload → ready → processing → done/failed
        ├── CombinePage.tsx    # Multi-doc selector + output filename → job + download
        ├── OrganizePage.tsx   # Thumbnail grid, rotate/delete/reorder/insert/extract ✅
        ├── SplitPage.tsx      # Thumbnail grid with scissor-split lines, ZIP download ✅
        ├── CropPage.tsx       # ⬜ TODO — crop by margins or custom rect
        └── PageNumbersPage.tsx # ⬜ TODO — add page numbers (position, format, font)
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
| `backend/src/core/security.py` | ✅ Written — bcrypt, JWT create/decode, OAuth2 scheme |
| `backend/src/models/database.py` | ✅ Written — SQLModel engine, get_session, init_db |
| `backend/src/models/database_models.py` | ✅ Written — User, Document, Job tables |
| `backend/src/models/schemas.py` | ✅ Written — all request/response Pydantic models |
| `backend/src/repositories/*.py` | ✅ Written — UserRepository, DocumentRepository, JobRepository |
| `backend/src/services/auth_service.py` | ✅ Written — register, authenticate |
| `backend/src/services/document_service.py` | ✅ Written — upload, list, get, delete |
| `backend/src/services/job_service.py` | ✅ Written — create + background thread runner for reconstruct + combine |
| `backend/src/routes/auth_routes.py` | ✅ Written — /auth/register, /auth/login, /auth/me |
| `backend/src/routes/document_routes.py` | ✅ Written — full CRUD + download |
| `backend/src/routes/job_routes.py` | ✅ Written — create, poll, list, delete, download |
| `backend/src/main.py` | ✅ Written — FastAPI app, CORS, startup init_db |
| `backend/src/**/__init__.py` | ✅ All `__init__.py` files created |

### 🚫 Backend — Not Yet Built

- Remaining PDF operation routes, services, and schemas:
  - `organize` job (`/jobs/organize`) — rotate, delete, extract, insert pages ✅ **done**
  - `crop` job (`/jobs/crop`) — by margins or custom rect
  - `page_numbers` job (`/jobs/page-numbers`) — position, format, font
- `src/services/pdf_ops_service.py` — wraps pdf_operations/ modules (optional consolidation layer)

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
| `frontend/src/services/api.ts` | ✅ Written — full Axios singleton, typed methods, 401 interceptor |
| `frontend/src/hooks/useJobPoll.ts` | ✅ Written — polls until done/failed, stoppedRef guard |
| `frontend/src/components/ui/Badge.tsx` | ✅ Written — variants + JobStatusBadge convenience |
| `frontend/src/components/ui/Button.tsx` | ✅ Written — variants, sizes, loading state |
| `frontend/src/components/ui/Card.tsx` | ✅ Written — Card + CardHeader + CardBody + CardFooter |
| `frontend/src/components/ui/Input.tsx` | ✅ Written — label, error, forwardRef |
| `frontend/src/components/ui/Layout.tsx` | ✅ Written — sticky header, nav, footer, mobile nav |
| `frontend/src/components/ui/ProgressBar.tsx` | ✅ Written — animated, 0–100% |
| `frontend/src/components/ui/Spinner.tsx` | ✅ Written — SVG animate-spin, sm/md/lg |
| `frontend/src/pages/LoginPage.tsx` | ✅ Written — username + password, redirects if authed |
| `frontend/src/pages/RegisterPage.tsx` | ✅ Written — email, username, password, confirmPassword |
| `frontend/src/pages/DashboardPage.tsx` | ✅ Written — document table + recent jobs table |
| `frontend/src/pages/ReconstructPage.tsx` | ✅ Written — 4-state wizard: upload → ready → processing → done/failed |
| `frontend/src/pages/CombinePage.tsx` | ✅ Written — multi-doc selector → reorder → job → download |
| `frontend/src/pages/SplitPage.tsx` | ✅ Written — thumbnail grid with scissor-split lines, ZIP download |

### 🚫 Frontend — Not Yet Built

- `frontend/src/pages/CropPage.tsx` — crop by margins or custom rect
- `frontend/src/pages/PageNumbersPage.tsx` — add page numbers (position, format, font)
- `frontend/src/pages/OrganizePage.tsx` — page thumbnail grid, rotate/delete/extract/insert pages ✅ **done**
- API methods for Crop + Page Numbers (`api.ts` update)
- Routing entries for Crop + Page Numbers (`App.tsx` update)

---

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
| `GET` | `/api/documents` | List user's documents (paginated) |
| `GET` | `/api/documents/{id}` | Get a single document |
| `DELETE` | `/api/documents/{id}` | Delete a document |
| `GET` | `/api/documents/{id}/download` | Download the original PDF |
| `GET` | `/api/documents/{id}/thumbnails` | Get page thumbnails (base64 PNG) for Split UI |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/jobs/reconstruct` | Start PDF → DOCX job (async) |
| `POST` | `/api/jobs/combine` | Start combine PDFs job (async) |
| `POST` | `/api/jobs/split` | Start split PDF job (async) |
| `GET` | `/api/jobs/{id}/parts` | List split parts after split job completes |
| `POST` | `/api/jobs/organize` | Start organize pages job (async) — delete, rotate, reorder |
| `POST` | `/api/jobs/extract` | Start extract pages job (async) — immediate extract to separate PDF |
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
  tool TEXT,               -- reconstruct, combine, split, etc.
  status TEXT,             -- pending, processing, done, failed
  input_document_ids TEXT, -- JSON list (for combine)
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

Jobs run in **background threads** inside the FastAPI process (via `threading.Thread`). This keeps everything in a single container/process without requiring Celery/Redis.

```
Client                     FastAPI                        Background Thread
  │                            │                                  │
  ├─ POST /jobs/reconstruct ───►│                                  │
  │                            ├── create Job (status=pending)      │
  │                            │                                  │
  │◄── 202 {job_id} ───────────┤                                  │
  │                            │                                  │
  │                            │───────────────────────────────►   │
  │                            │  start thread → _run_reconstruct  │
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
  ├─ GET /jobs/{id}/download ◄─┤── serve output file
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

### Test Organize Pages

1. Register / log in at `http://localhost:5173`
2. Navigate to **Organize** in the nav bar
3. **Upload** a multi-page PDF (e.g. any 5+ page document)
4. Wait for thumbnails to load — you should see each page as a tile
5. **Select a page** — click its checkbox (top-left of tile)
6. **Rotate** — hover over a tile to reveal ↺ ↻ buttons; click to rotate the page 90° in that direction
7. **Delete** — hover over a tile and click the trash icon; the tile disappears
8. **Reorder** — drag a tile and drop it onto another to swap their positions
9. **Insert pages** — click the "+" icon between any two tiles; select a second PDF from the file picker; its pages are inserted at that position
10. **Extract mode** — click the **Extract** button in the top-right; select pages with their checkboxes; click **Extract**; a PDF with only those pages downloads immediately
11. **Save (organize)** — with some pages modified, enter an output filename and click **Save**; a job starts with a progress bar; when done, the organized PDF downloads

### Test Split, Combine, Reconstruct

All other tools work independently. See their respective pages under the nav bar.

---

## 8. Implementation Plan (Remaining Work)

### Priority 1 — Backend: Remaining PDF Operations
- [x] `POST /jobs/split` + `GET /jobs/{id}/parts` + ZIP download ✅
- [x] `POST /jobs/organize` + `POST /jobs/extract` — rotate, delete, reorder pages ✅
- [ ] `POST /jobs/crop` — by margins or custom rect
- [ ] `POST /jobs/page-numbers` — position, format, font
- [ ] `src/services/pdf_ops_service.py` — optional consolidation layer

### Priority 2 — Frontend: Remaining Tool Pages
- [x] Update `frontend/src/services/api.ts` — `createSplitJob`, `getSplitParts`, `getDocumentThumbnails` ✅
- [x] Update `frontend/src/App.tsx` — `/split` route ✅
- [x] Update `frontend/src/components/ui/Layout.tsx` — Split nav link ✅
- [x] Write `frontend/src/pages/SplitPage.tsx` — thumbnail grid, scissor-split lines, ZIP download ✅
- [x] Write `frontend/src/pages/OrganizePage.tsx` — thumbnail grid, rotate/delete/reorder/insert/extract ✅
- [ ] Write `frontend/src/pages/CropPage.tsx` — crop by margins or custom rect
- [ ] Write `frontend/src/pages/PageNumbersPage.tsx` — add page numbers (position, format, font)

### Priority 3 — DevOps & Polish
- [ ] Production `Dockerfile` (multi-stage build for frontend static files served by Nginx)
- [ ] Production `docker-compose.yml` with `nginx` service as reverse proxy
- [ ] `.gitignore` update to exclude `backend/data/`, `backend/.env`
- [ ] README with setup instructions

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
│   ├── font_utils.py        # clean_font_name, round_font_size
│   ├── heading_utils.py     # get_section_heading_level
│   └── table_utils.py       # is_same_line, horizontally_separated, etc.
│
└── pdf_operations/
    ├── combine.py            # combine_pdfs() — pure pymupdf ✅ (canonical: backend/src/)
    ├── split.py              # split_by_points() ✅ (canonical: backend/src/)
    ├── organize.py           # delete/rotate/extract/insert helpers ✅ (canonical: backend/src/)
    ├── crop.py               # crop_by_margins, crop_by_rect (planned)
    └── page_numbers.py       # add_page_numbers() (planned)
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
