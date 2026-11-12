"""Trip business logic, including complete server-managed trip-day ranges."""

from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidTripDatesError, TripDaysOutsideRangeError, TripNotFoundError
from app.models.trip import Trip
from app.models.trip_day import TripDay
from app.repositories.trip import TripRepository
from app.repositories.trip_day import TripDayRepository
from app.schemas.trip import TripCreate, TripUpdate


def dates_inclusive(start_date, end_date):
    """Generate calendar dates inclusively; date arithmetic avoids timezone/DST drift."""
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)


class TripService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = TripRepository(db)
        self.days = TripDayRepository(db)

    async def create(self, user_id: UUID, data: TripCreate) -> Trip:
        trip = Trip(user_id=user_id, **data.model_dump())
        self.repository.add(trip)
        # Database generates the UUID. Flush it without committing the transaction.
        await self.db.flush()
        for day_date in dates_inclusive(trip.start_date, trip.end_date):
            self.days.add(TripDay(trip_id=trip.id, day_date=day_date))
        # Trip and *all* of its calendar days are committed atomically.
        await self.db.commit()
        await self.db.refresh(trip)
        return trip

    async def list_for_user(self, user_id: UUID) -> list[Trip]:
        return await self.repository.list_for_user(user_id)

    async def get_for_user(self, user_id: UUID, trip_id: UUID) -> Trip:
        trip = await self.repository.get_for_user(trip_id, user_id)
        if trip is None:
            raise TripNotFoundError()
        return trip

    async def update(self, user_id: UUID, trip_id: UUID, data: TripUpdate) -> Trip:
        trip = await self.get_for_user(user_id, trip_id)
        changes = data.model_dump(exclude_unset=True)
        start_date = changes.get("start_date", trip.start_date)
        end_date = changes.get("end_date", trip.end_date)
        if end_date < start_date:
            raise InvalidTripDatesError()

        if "start_date" in changes or "end_date" in changes:
            existing = await self.days.list_for_trip(trip_id)
            by_date = {day.day_date: day for day in existing}
            dates = set(dates_inclusive(start_date, end_date))
            removed = [day for day in existing if day.day_date not in dates]

            # Do not silently cascade-delete places when a trip is shortened.
            if removed and await self.days.have_places([day.id for day in removed]):
                raise TripDaysOutsideRangeError()

            for day in removed:
                await self.days.delete(day)
            for day_date in sorted(dates - by_date.keys()):
                self.days.add(TripDay(trip_id=trip_id, day_date=day_date))

        for field, value in changes.items():
            setattr(trip, field, value)

        if changes:
            await self.db.commit()
            await self.db.refresh(trip)
        return trip

    async def delete(self, user_id: UUID, trip_id: UUID) -> None:
        trip = await self.get_for_user(user_id, trip_id)
        await self.repository.delete(trip)
        await self.db.commit()
