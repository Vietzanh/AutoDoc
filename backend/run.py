"""
Development entry point — runs FastAPI with hot reload via uvicorn.
"""

import sys
from pathlib import Path as _P

# Add the backend directory to sys.path so 'src.main' resolves correctly
# from both the main process and uvicorn's reloader subprocess.
_BACKEND_DIR = str(_P(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
