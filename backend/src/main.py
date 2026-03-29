"""
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings
from src.models.database import init_db
from src.routes import auth_routes, document_routes, job_routes

settings = get_settings()

app = FastAPI(
    title="AutoDoc API",
    description="PDF → DOCX reconstruction and PDF operations API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React frontend (running on a different port) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # React dev server alternative
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()


# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(auth_routes.router)
app.include_router(document_routes.router)
app.include_router(job_routes.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "1.0.0"}
