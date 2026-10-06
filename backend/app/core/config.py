from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

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

    model_config = SettingsConfigDict(
        env_file=ENV_FILE
        , env_file_encoding="utf-8"
    )

settings = Settings()
