from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(
            func.lower(User.email) == email
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    def add(self, user: User) -> None:
        self.db.add(user)