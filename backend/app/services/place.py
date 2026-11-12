"""Business rules for places; all access is scoped to the current user."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PlaceNotFoundError, PlaceOrderConflictError, TripDayNotFoundError
from app.models.place import Place
from app.repositories.place import PlaceRepository
from app.repositories.trip_day import TripDayRepository
from app.schemas.place import PlaceCreate, PlaceReorder, PlaceUpdate


class PlaceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.days = TripDayRepository(db)
        self.places = PlaceRepository(db)

    async def _owned_day(self, user_id: UUID, trip_id: UUID, day_id: UUID,
                         *, for_update: bool = False):
        day = await self.days.get_owned(user_id, trip_id, day_id, for_update=for_update)
        if day is None:
            raise TripDayNotFoundError()
        return day

    async def list_for_day(self, user_id: UUID, trip_id: UUID, day_id: UUID) -> list[Place]:
        await self._owned_day(user_id, trip_id, day_id)
        return await self.places.list_for_day(day_id)

    async def create(self, user_id: UUID, trip_id: UUID,
                     day_id: UUID, data: PlaceCreate) -> Place:
        # Serialize position assignment for concurrent writes in this API.
        await self._owned_day(user_id, trip_id, day_id, for_update=True)
        position = await self.places.next_position(day_id)
        place = Place(trip_day_id=day_id, position=position, **data.model_dump())
        self.places.add(place)
        await self.db.commit()
        await self.db.refresh(place)
        return place

    async def get(self, user_id: UUID, trip_id: UUID,
                  day_id: UUID, place_id: UUID) -> Place:
        place = await self.places.get_owned(user_id, trip_id, day_id, place_id)
        if place is None:
            raise PlaceNotFoundError()
        return place

    async def update(self, user_id: UUID, trip_id: UUID,
                     day_id: UUID, place_id: UUID, data: PlaceUpdate) -> Place:
        place = await self.get(user_id, trip_id, day_id, place_id)
        changes = data.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(place, key, value)
        if changes:
            await self.db.commit()
            await self.db.refresh(place)
        return place

    async def delete(self, user_id: UUID, trip_id: UUID,
                     day_id: UUID, place_id: UUID) -> None:
        # Row lock serializes delete with create/reorder.
        await self._owned_day(user_id, trip_id, day_id, for_update=True)
        place = await self.get(user_id, trip_id, day_id, place_id)
        await self.places.delete(place)
        await self.db.commit()

    async def reorder(self, user_id: UUID, trip_id: UUID,
                      day_id: UUID, data: PlaceReorder) -> list[Place]:
        await self._owned_day(user_id, trip_id, day_id, for_update=True)
        places = await self.places.list_for_day(day_id)
        ids = [place.id for place in places]
        if len(ids) != len(data.place_ids) or set(ids) != set(data.place_ids):
            raise PlaceOrderConflictError()
        # uq_places_day_position is DEFERRABLE in 001_initial.sql;
        # swap positions atomically, checking uniqueness at COMMIT.
        await self.db.execute(text("SET CONSTRAINTS uq_places_day_position DEFERRED"))
        by_id = {place.id: place for place in places}
        for position, place_id in enumerate(data.place_ids, start=1):
            by_id[place_id].position = position
        await self.db.commit()
        return [by_id[place_id] for place_id in data.place_ids]
