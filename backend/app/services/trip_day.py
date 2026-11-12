"""Business rules for trip days (authorization, date bounds and uniqueness)."""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DuplicateTripDayError, InvalidTripDayDateError, TripDayNotFoundError,
    TripNotFoundError,
)
from app.models.trip_day import TripDay
from app.repositories.trip import TripRepository
from app.repositories.trip_day import TripDayRepository
from app.schemas.trip_day import TripDayCreate, TripDayUpdate


def unique_day_violation(exc: IntegrityError) -> bool:
    orig = exc.orig
    cause = getattr(orig, "__cause__", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(cause, "sqlstate", None)
    constraint = getattr(orig, "constraint_name", None) or getattr(cause, "constraint_name", None)
    # asyncpg adapters may embed the constraint name in their message.
    return sqlstate == "23505" and (
        constraint == "uq_trip_days_trip_date" or "uq_trip_days_trip_date" in str(orig)
    )


class TripDayService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.trips = TripRepository(db)
        self.days = TripDayRepository(db)

    async def _owned_trip(self, user_id: UUID, trip_id: UUID):
        trip = await self.trips.get_for_user(trip_id, user_id)
        if trip is None:
            raise TripNotFoundError()
        return trip

    @staticmethod
    def _check_date(day_date, trip):
        if not (trip.start_date <= day_date <= trip.end_date):
            raise InvalidTripDayDateError()

    async def create(self, user_id: UUID, trip_id: UUID, data: TripDayCreate) -> TripDay:
        trip = await self._owned_trip(user_id, trip_id)
        self._check_date(data.day_date, trip)
        if await self.days.find_by_date(trip_id, data.day_date):
            raise DuplicateTripDayError()
        day = TripDay(trip_id=trip_id, day_date=data.day_date)
        self.days.add(day)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            if unique_day_violation(exc):
                raise DuplicateTripDayError() from exc
            raise
        await self.db.refresh(day)
        return day

    async def list_for_trip(self, user_id: UUID, trip_id: UUID) -> list[TripDay]:
        await self._owned_trip(user_id, trip_id)
        return await self.days.list_for_trip(trip_id)

    async def get(self, user_id: UUID, trip_id: UUID, day_id: UUID) -> TripDay:
        day = await self.days.get_owned(user_id, trip_id, day_id)
        if day is None:
            raise TripDayNotFoundError()
        return day

    async def update(self, user_id: UUID, trip_id: UUID, day_id: UUID,
                     data: TripDayUpdate) -> TripDay:
        day = await self.get(user_id, trip_id, day_id)
        if "day_date" not in data.model_fields_set:
            return day
        trip = await self._owned_trip(user_id, trip_id)
        self._check_date(data.day_date, trip)
        if data.day_date != day.day_date:
            existing = await self.days.find_by_date(trip_id, data.day_date)
            if existing is not None:
                raise DuplicateTripDayError()
            day.day_date = data.day_date
            try:
                await self.db.commit()
            except IntegrityError as exc:
                await self.db.rollback()
                if unique_day_violation(exc):
                    raise DuplicateTripDayError() from exc
                raise
            await self.db.refresh(day)
        return day

    async def delete(self, user_id: UUID, trip_id: UUID, day_id: UUID) -> None:
        day = await self.get(user_id, trip_id, day_id)
        await self.days.delete(day)
        await self.db.commit()
