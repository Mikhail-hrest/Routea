"""Queries for places, scoped to trip and current user."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.place import Place
from app.models.trip import Trip
from app.models.trip_day import TripDay


class PlaceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def add(self, place: Place) -> None:
        self.db.add(place)

    async def list_for_day(self, day_id: UUID) -> list[Place]:
        result = await self.db.execute(
            select(Place).where(Place.trip_day_id == day_id)
            .order_by(Place.position, Place.id)
        )
        return list(result.scalars().all())

    async def get_owned(self, user_id: UUID, trip_id: UUID,
                        day_id: UUID, place_id: UUID) -> Place | None:
        result = await self.db.execute(
            select(Place)
            .join(TripDay, TripDay.id == Place.trip_day_id)
            .join(Trip, Trip.id == TripDay.trip_id)
            .where(
                Place.id == place_id, Place.trip_day_id == day_id,
                TripDay.trip_id == trip_id, Trip.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def next_position(self, day_id: UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.max(Place.position), 0) + 1)
            .where(Place.trip_day_id == day_id)
        )
        return result.scalar_one()

    async def delete(self, place: Place) -> None:
        await self.db.delete(place)
