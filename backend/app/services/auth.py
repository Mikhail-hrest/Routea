from datetime import datetime, timedelta, timezone
from uuid import uuid4 \
                , UUID

from jwt.exceptions import InvalidTokenError

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import UserAlreadyExistError
from app.core.security import hash_password \
    , create_access_token \
    , create_refresh_token \
    , hash_refresh_token \
    , verify_password \
    , verify_refresh_token_hash \
    , decode_token

from app.core.exceptions import \
    InvalidCredentialsError \
    , UserAlreadyExistError \
    , UserBlockedError \
    , InvalidRefreshTokenError

from app.models.user import User
from app.models.session import Session
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, LoginRequest

class AuthService:
    def __init__(self, db:AsyncSession):
        self.db = db
        self.user_repository = UserRepository(db)
        self.session_repository = SessionRepository(db)
    
    async def register(
            self
            , data: RegisterRequest
    ) -> User:
        email = str(data.email).strip().lower()

        existing_user = await self.user_repository.get_by_email(email)
        if existing_user is not None:
            raise UserAlreadyExistError()

        password = data.password.get_secret_value()
        password_hash = hash_password(password)

        user = User(
            name = data.name
            , email = email
            , password_hash = password_hash
        )
        self.user_repository.add(user)
        
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            if getattr(exc.orig, "sqlstate", None) == "23505":
                raise UserAlreadyExistError() from exc
            raise

        await self.db.refresh(user)

        return user

    async def login(self
                    , data: LoginRequest
                    , ip_address: str | None = None
                    , user_agent: str | None = None) -> tuple[str, str]:
        email = str(data.email).strip().lower()
        user = await self.user_repository.get_by_email(email)

        if user is None:
            raise InvalidCredentialsError()

        password = data.password.get_secret_value()

        if not verify_password(password
                               , user.password_hash):
            raise InvalidCredentialsError()

        if user.is_blocked:
            raise UserBlockedError()

        session_id = uuid4()

        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_ttl_days)
        access_token = create_access_token(user.id
                                           , session_id
                                           )

        refresh_token = create_refresh_token(user.id
                                            , session_id
                                            , expires_at
                                            )

        session = Session(
            id=session_id
            , user_id=user.id
            , refresh_token_hash=hash_refresh_token(refresh_token)
            , expires_at=expires_at
            , ip_address=ip_address
            , user_agent=user_agent
        )

        self.session_repository.add(session)
        await self.db.commit()
        return access_token, refresh_token

        
    async def refresh(self
                      , refresh_token: str)->tuple[str,str]:
        try:
            payload = decode_token(refresh_token)
        except InvalidTokenError as exc:
            raise InvalidRefreshTokenError from exc

        if payload.get("type") != "refresh":
            raise InvalidRefreshTokenError()
        try:
            user_id = UUID(payload["sub"])
            session_id = UUID(payload["sid"])
        except (KeyError, TypeError, ValueError) as exc:
            raise InvalidRefreshTokenError from exc

        session = await self.session_repository.get_by_id(session_id)

        if session is None:
            raise InvalidRefreshTokenError()
        if session.user_id != user_id:
            raise InvalidRefreshTokenError()
        if session.revoked_at is not None:
            raise InvalidRefreshTokenError()
        now = datetime.now(timezone.utc)
        if session.expires_at <= now:
            raise InvalidRefreshTokenError()
        if not verify_refresh_token_hash(refresh_token
                                         , session.refresh_token_hash):
            raise InvalidRefreshTokenError()

        user = await self.user_repository.get_by_id(user_id)

        if user is None:
            raise InvalidRefreshTokenError()
        if user.is_blocked:
            raise UserBlockedError

        new_access_token = create_access_token(user.id
                                               , session.id)
        new_refresh_token = create_refresh_token(user_id
                                                 , session.id
                                                 , session.expires_at)
        session.refresh_token_hash = hash_refresh_token(new_refresh_token)
        session.last_activity_at = now

        await self.db.commit()
        return new_access_token, new_refresh_token

    async def logout(self
                     , refresh_token:str) -> None:
        try:
            payload = decode_token(refresh_token)
        except InvalidTokenError as exc:
            raise InvalidRefreshTokenError() from exc

        if payload.get("type") != "refresh":
            raise InvalidRefreshTokenError()

        try:
            user_id = UUID(payload["sub"])
            session_id = UUID(payload["sid"])

        except (KeyError, TypeError, ValueError) as exc:
            raise InvalidRefreshTokenError() from exc

        session = await self.session_repository.get_by_id(session_id)

        if session is None:
            raise InvalidRefreshTokenError()
        if session.user_id != user_id:
            raise InvalidRefreshTokenError()
        if session.revoked_at is not None:
            return
        if not verify_refresh_token_hash(refresh_token
                                         , session.refresh_token_hash):
            raise InvalidRefreshTokenError()

        now = datetime.now(timezone.utc)

        session.revoked_at = now
        session.revoked_by_user_id = user_id

        await self.db.commit()
        