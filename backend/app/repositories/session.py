from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import Session

class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, session_id: UUID) -> Session | None:
        return await self.db.get(Session, session_id)

    def add(self, session: Session)-> None:
        self.db.add(session)
        