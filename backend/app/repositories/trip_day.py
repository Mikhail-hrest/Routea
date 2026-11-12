"""Queries for days; owner checks are enforced in SQL."""

from datetime import date
from uuid import UUID

from sqlalchemy import select

from app.models.place import Place
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.trip_day import TripDay


class TripDayRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def add(self, day: TripDay) -> None:
        self.db.add(day)

    async def list_for_trip(self, trip_id: UUID) -> list[TripDay]:
        result = await self.db.execute(
            select(TripDay)
            .where(TripDay.trip_id == trip_id)
            .order_by(TripDay.day_date, TripDay.id)
        )
        return list(result.scalars().all())

    async def get_owned(self, user_id: UUID, trip_id: UUID, day_id: UUID,
                        *, for_update: bool = False) -> TripDay | None:
        query = (
            select(TripDay)
            .join(Trip, Trip.id == TripDay.trip_id)
            .where(TripDay.id == day_id, TripDay.trip_id == trip_id, Trip.user_id == user_id)
        )
        if for_update:
            # PostgreSQL: lock the trip_days row, not the JOINed parent.
            query = query.with_for_update(of=TripDay)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def find_by_date(self, trip_id: UUID, day_date: date) -> TripDay | None:
        result = await self.db.execute(
            select(TripDay).where(TripDay.trip_id == trip_id, TripDay.day_date == day_date)
        )
        return result.scalar_one_or_none()

    async def has_outside_range(self, trip_id: UUID, start_date: date, end_date: date) -> bool:
        result = await self.db.execute(
            select(TripDay.id)
            .where(TripDay.trip_id == trip_id)
            .where((TripDay.day_date < start_date) | (TripDay.day_date > end_date))
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def have_places(self, day_ids: list[UUID]) -> bool:
        if not day_ids:
            return False
        result = await self.db.execute(
            select(Place.id).where(Place.trip_day_id.in_(day_ids)).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def delete(self, day: TripDay) -> None:
        await self.db.delete(day)
