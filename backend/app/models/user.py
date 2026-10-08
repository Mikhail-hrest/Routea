from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, String, DateTime, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True)
        , primary_key=True
        , server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(
        String(100)
        , nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(254)
        , nullable=False
    )
    password_hash: Mapped[str] = mapped_column(
        nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(6)
        , nullable=False
        , server_default=text("USER")
    )
    is_blocked: Mapped[bool] = mapped_column(
        Boolean
        , nullable=False
        , server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False
        , server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
            nullable=False
            , server_default=text("CURRENT_TIMESTAMP")
        )
    password_changed_at: Mapped[datetime] = mapped_column(
        nullable=False
        , server_default=text("CURRENT_TIMESTAMP")
    )