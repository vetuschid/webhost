from __future__ import annotations

import os
import stat
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LEAD_SIFTER_", env_file=".env", extra="ignore")

    home: str = Field(default="~/.lead-sifter")
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")
    openai_model_filter: str = Field(default=r"^(gpt-|o[0-9])")

    @property
    def home_path(self) -> Path:
        return Path(os.path.expanduser(self.home))

    @property
    def master_key_path(self) -> Path:
        return self.home_path / "master.key"

    @property
    def db_path(self) -> Path:
        return self.home_path / "data.db"

    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ensure_master_key() -> bytes:
    """Generate Fernet master key on first run, chmod 600. Return raw key bytes."""
    settings = get_settings()
    settings.home_path.mkdir(parents=True, exist_ok=True)
    path = settings.master_key_path
    if not path.exists():
        key = Fernet.generate_key()
        path.write_bytes(key)
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 600
        return key
    return path.read_bytes()
