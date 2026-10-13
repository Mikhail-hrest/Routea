from datetime import datetime
from uuid import UUID
from sqlalchemy import DateTime, ForeignKey, LargeBinary, Text, text
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True)
        , primary_key=True
        , server_default=text("gen_random_uuid()")
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True)
        , ForeignKey(
            "users.id"
            , ondelete="CASCADE"
            )
        , nullable=False
    )

    refresh_token_hash: Mapped[bytes] = mapped_column(
        LargeBinary(32)
        , nullable=False
        , unique= True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
        , nullable=False
        , server_default=text("CURRENT_TIMESTAMP")
    )

    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
        , nullable=False
        , server_default=text("CURRENT_TIMESTAMP")
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
        , nullable=False
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
        , nullable=True
    )

    revoked_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True)
        , ForeignKey(
            "users.id"
            , ondelete="SET NULL"
        )
        , nullable=True
    )

    ip_address: Mapped[str | None] = mapped_column(
        INET
        , nullable=True
    )

    user_agent: Mapped[str | None] = mapped_column(
        Text
        , nullable=True
    )