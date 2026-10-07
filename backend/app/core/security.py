import hashlib
import hmac
import base64

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