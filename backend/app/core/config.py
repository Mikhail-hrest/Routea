from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr

# parents[] = {core, app, backend, Routea} => Routea = parents[3]
BASE_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = BASE_DIR/".env"

# Settings(BaseSettings) предназначен для конфигурации приложения
class Settings(BaseSettings):
    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str

    password_pepper: SecretStr

    jwt_secret: SecretStr
    jwt_algorithm: str="HS256"
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 30
    jwt_issuer: str = "routea"
    jwt_audience: str = "routea-client"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE
        , env_file_encoding="utf-8"
    )

settings = Settings()
