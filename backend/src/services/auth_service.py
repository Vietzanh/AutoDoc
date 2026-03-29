"""
Authentication service — registration, login.
"""

from typing import Optional
from sqlmodel import Session

from src.models.database_models import User
from src.models.schemas import UserCreate
from src.repositories.user_repository import UserRepository
from src.core.security import hash_password, verify_password, create_access_token


class AuthService:
    def __init__(self, session: Session):
        self.repo = UserRepository(session)

    def register(self, data: UserCreate) -> User:
        # Check for duplicate email / username
        if self.repo.get_by_email(data.email):
            raise ValueError("Email already registered")
        if self.repo.get_by_username(data.username):
            raise ValueError("Username already taken")

        user = self.repo.create(
            email=data.email,
            username=data.username,
            hashed_password=hash_password(data.password),
        )
        return user

    def authenticate(self, username: str, password: str) -> Optional[tuple[User, str]]:
        """Authenticate by username or email. Returns (user, token) on success."""
        user = self.repo.get_by_username(username) or self.repo.get_by_email(username)
        if not user or not verify_password(password, user.hashed_password):
            return None
        token = create_access_token(data={"sub": str(user.id)})
        return user, token
