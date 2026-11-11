"""Queries for trips. Ownership is enforced at the database-query level."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip


class TripRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def add(self, trip: Trip) -> None:
        self.db.add(trip)

    async def list_for_user(self, user_id: UUID) -> list[Trip]:
        query = (
            select(Trip)
            .where(Trip.user_id == user_id)
            .order_by(Trip.created_at.desc(), Trip.id.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_for_user(self, trip_id: UUID, user_id: UUID) -> Trip | None:
        query = select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def delete(self, trip: Trip) -> None:
        await self.db.delete(trip)
