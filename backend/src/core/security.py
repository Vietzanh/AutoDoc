"""
Authentication & authorization helpers.
"""

# ── Bootstrap: bcrypt 4.x no longer exports __about__ at top level ────────────
# passlib tries to read bcrypt.__about__.__version__ to detect the backend.
# Since the module no longer exposes __about__ directly, inject it here so
# passlib's version check succeeds without any (trapped) warnings.
import importlib.util
import bcrypt as _bc

_spec = importlib.util.find_spec("bcrypt._about")
if _spec is not None:
    _about = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_about)
    _bc.__about__ = _about
else:
    # Final fallback: mirror just the version attribute passlib needs
    class _about_ns:
        pass
    _ns = _about_ns()
    _ns.__version__ = _bc.__version__
    _bc.__about__ = _ns
# ── End bootstrap ────────────────────────────────────────────────────────────


from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from src.core.config import get_settings
from src.models.database import get_session
from src.models.database_models import User

# ── Password hashing ─────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT tokens ───────────────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── Current user dependency ───────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.get(User, int(user_id_str))
    if user is None:
        raise credentials_exception
    return user