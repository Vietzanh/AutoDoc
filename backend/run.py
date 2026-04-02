"""
Development entry point — runs FastAPI with hot reload via uvicorn.
"""

import sys
from pathlib import Path as _P

# Add the AutoDoc project root to sys.path so that:
#   from src.pipeline   → AutoDoc/src/pipeline        (ML pipeline — read-only reference)
#   from src.pdf_operations → backend/src/pdf_operations  (canonical, already reachable via src.main)
_AUTO_DOC_ROOT = str(_P(__file__).resolve().parent.parent)
if _AUTO_DOC_ROOT not in sys.path:
    sys.path.insert(0, _AUTO_DOC_ROOT)

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
