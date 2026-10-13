from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends \
                    , HTTPException \
                    , status

from fastapi.security import HTTPAuthorizationCredentials \
                            , HTTPBearer

from jwt.exceptions import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)

def unauthorized_exception()->HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED
                         , detail="Необходима авторизация"
                         , headers={"WWW-Authentificate":"Bearer"})

async def get_current_user(credentials:Annotated[HTTPAuthorizationCredentials | None
                                        , Depends(bearer_scheme)], 
                            db: Annotated[AsyncSession
                                          , Depends(get_db)]) -> User:
    if credentials is None:
        raise unauthorized_exception()

    token = credentials.credentials

    try:
        payload=decode_token(token)
    except InvalidTokenError:
        raise unauthorized_exception()

    if payload.get("type") != "access":
        raise unauthorized_exception()

    try:
        user_id = UUID(payload["sub"])
        session_id = UUID(payload["sid"])
    except (KeyError, TypeError, ValueError):
        raise unauthorized_exception()

    session_repository = SessionRepository(db)

    session = await session_repository.get_by_id(session_id)

    if session is None:
        raise unauthorized_exception()

    if session.user_id != user_id:
        raise unauthorized_exception()

    if session.revoked_at is not None:
        raise unauthorized_exception()

    if session.expires_at <= datetime.now(timezone.utc):
        raise unauthorized_exception()

    user_repository = UserRepository(db)

    user = await user_repository.get_by_id(user_id)

    if user is None:
        raise unauthorized_exception()

    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN
            , detail="Пользователь заблокирован"
        )

    return user