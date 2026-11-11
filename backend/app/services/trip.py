"""Trip business logic. A user ID always comes from the verified JWT."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidTripDatesError, TripNotFoundError
from app.models.trip import Trip
from app.repositories.trip import TripRepository
from app.schemas.trip import TripCreate, TripUpdate


class TripService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = TripRepository(db)

    async def create(self, user_id: UUID, data: TripCreate) -> Trip:
        trip = Trip(user_id=user_id, **data.model_dump())
        self.repository.add(trip)
        await self.db.commit()
        await self.db.refresh(trip)
        return trip

    async def list_for_user(self, user_id: UUID) -> list[Trip]:
        return await self.repository.list_for_user(user_id)

    async def get_for_user(self, user_id: UUID, trip_id: UUID) -> Trip:
        trip = await self.repository.get_for_user(trip_id, user_id)
        if trip is None:
            # Use 404 for both missing trips and trips owned by someone else.
            raise TripNotFoundError()
        return trip

    async def update(self, user_id: UUID, trip_id: UUID, data: TripUpdate) -> Trip:
        trip = await self.get_for_user(user_id, trip_id)
        changes = data.model_dump(exclude_unset=True)

        start_date = changes.get("start_date", trip.start_date)
        end_date = changes.get("end_date", trip.end_date)
        if end_date < start_date:
            raise InvalidTripDatesError()

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
