import hashlib
import hmac
import base64
import jwt

from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone

from pwdlib import PasswordHash
from app.core.config import settings

_password_hasher = PasswordHash.recommended()

def _apply_pepper(password: str) -> str:
    pepper = settings.password_pepper.get_secret_value().encode("utf-8")
    password_bytes = password.encode("utf-8")

    digest = hmac.new(
        pepper
        , password_bytes
        , hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")

def hash_password(password: str) -> str:
    peppered_password = _apply_pepper(password)
    return _password_hasher.hash(peppered_password)

def verify_password(
        password: str
        , encoded_hash: str
) -> bool:
    peppered_password = _apply_pepper(password)
    return _password_hasher.verify(
        peppered_password
        , encoded_hash
    )

def create_access_token(user_id: UUID
                        , session_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id)
        , "sid": str(session_id)
        , "jti": str(uuid4())
        , "type": "access"
        , "iat": now
        , "exp": now + timedelta(minutes=settings.access_token_ttl_min)
        , "iss": settings.jwt_issuer
        , "aud": settings.jwt_audience
    }
    return jwt.encode(payload
                      , settings.jwt_secret.get_secret_value()
                      , algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: UUID
                        , session_id: UUID
                        , expires_at: datetime) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id)
        , "sid": str(session_id)
        , "jti": str(uuid4())
        , "type": "refresh"
        , "iat": now
        , "exp": expires_at
        , "iss": settings.jwt_issuer
        , "aud": settings.jwt_audience
    }
    return jwt.encode(payload
                      , settings.jwt_secret.get_secret_value()
                      , algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    return jwt.decode(token
                      , settings.jwt_secret.get_secret_value()
                      , algorithms=[settings.jwt_algorithm]
                      , issuer=settings.jwt_issuer
                      , audience=settings.jwt_audience)

def hash_refresh_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()

def verify_refresh_token_hash(token: str
                              , stored_hash: bytes) -> bool:
    token_hash = hash_refresh_token(token)

    return hmac.compare_digest(token_hash
                               , stored_hash)