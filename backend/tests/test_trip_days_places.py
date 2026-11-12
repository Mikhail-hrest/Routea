"""Unit tests; no running PostgreSQL needed. Run with unittest discover."""

import unittest
from datetime import date, datetime, time, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from pydantic import ValidationError

from app.core.exceptions import (
    DuplicateTripDayError, InvalidTripDayDateError, PlaceNotFoundError,
    PlaceOrderConflictError, TripDayNotFoundError, TripDaysOutsideRangeError,
)
from app.repositories.place import PlaceRepository
from app.repositories.trip_day import TripDayRepository
from app.schemas.place import PlaceCreate, PlaceReorder, PlaceUpdate
from app.schemas.trip import TripUpdate
from app.schemas.trip_day import TripDayCreate, TripDayUpdate
from app.services.place import PlaceService
from app.services.trip import TripService
from app.services.trip_day import TripDayService


class DayAndPlaceSchemaTests(unittest.TestCase):
    def test_date_not_null_and_strict_payload(self):
        self.assertEqual(TripDayUpdate().model_dump(exclude_unset=True), {})
        with self.assertRaises(ValidationError):
            TripDayUpdate.model_validate({"day_date": None})
        with self.assertRaises(ValidationError):
            TripDayCreate.model_validate({"day_date": "2027-06-01", "trip_id": str(uuid4())})

    def test_place_name_and_time(self):
        obj = PlaceCreate.model_validate({"name": "  Колизей ", "planned_time": "09:30"})
        self.assertEqual(obj.name, "Колизей")
        self.assertEqual(obj.planned_time, time(9, 30))
        with self.assertRaises(ValidationError):
            PlaceCreate(name="   ")
        with self.assertRaises(ValidationError):
            PlaceCreate(name="Колизей", position=10)
        with self.assertRaises(ValidationError):
            PlaceUpdate.model_validate({"name": None})
        with self.assertRaises(ValidationError):
            PlaceUpdate.model_validate({"planned_time": "09:30:00+03:00"})
        self.assertEqual(PlaceUpdate(note=None).model_dump(exclude_unset=True), {"note": None})

    def test_reorder_rejects_duplicate_place_ids(self):
        place_id = uuid4()
        with self.assertRaises(ValidationError):
            PlaceReorder(place_ids=[place_id, place_id])


class TripDayServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.uid, self.tid, self.did = uuid4(), uuid4(), uuid4()
        self.trip = SimpleNamespace(start_date=date(2027, 6, 1), end_date=date(2027, 6, 7))
        self.db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock(), rollback=AsyncMock())
        self.service = TripDayService(self.db)
        self.service.trips = SimpleNamespace(get_for_user=AsyncMock(return_value=self.trip))
        self.service.days = SimpleNamespace(
            find_by_date=AsyncMock(return_value=None), add=Mock(),
            list_for_trip=AsyncMock(return_value=[]), get_owned=AsyncMock(),
            delete=AsyncMock(),
        )

    async def test_create_day_inside_trip(self):
        day = await self.service.create(self.uid, self.tid, TripDayCreate(day_date=date(2027, 6, 4)))
        self.assertEqual(day.trip_id, self.tid)
        self.service.trips.get_for_user.assert_awaited_once_with(self.tid, self.uid)
        self.db.commit.assert_awaited_once()

    async def test_outside_trip_is_rejected(self):
        with self.assertRaises(InvalidTripDayDateError):
            await self.service.create(self.uid, self.tid, TripDayCreate(day_date=date(2027, 7, 1)))
        self.db.commit.assert_not_awaited()

    async def test_duplicate_day_rejected(self):
        self.service.days.find_by_date.return_value = object()
        with self.assertRaises(DuplicateTripDayError):
            await self.service.create(self.uid, self.tid, TripDayCreate(day_date=date(2027, 6, 2)))
        self.db.commit.assert_not_awaited()

    async def test_lookup_returns_not_found_for_foreign_day(self):
        self.service.days.get_owned.return_value = None
        with self.assertRaises(TripDayNotFoundError):
            await self.service.get(self.uid, self.tid, self.did)
        self.service.days.get_owned.assert_awaited_once_with(self.uid, self.tid, self.did)

    async def test_day_update_checks_range_and_omitted_fields(self):
        day = SimpleNamespace(id=self.did, trip_id=self.tid, day_date=date(2027, 6, 2))
        self.service.days.get_owned.return_value = day
        await self.service.update(self.uid, self.tid, self.did, TripDayUpdate())
        self.db.commit.assert_not_awaited()
        with self.assertRaises(InvalidTripDayDateError):
            await self.service.update(
                self.uid, self.tid, self.did, TripDayUpdate(day_date=date(2027, 6, 10))
            )
        self.assertEqual(day.day_date, date(2027, 6, 2))


class PlaceServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.uid, self.tid, self.did = uuid4(), uuid4(), uuid4()
        self.p1, self.p2 = uuid4(), uuid4()
        self.db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock(), execute=AsyncMock())
        self.service = PlaceService(self.db)
        self.service.days = SimpleNamespace(get_owned=AsyncMock(return_value=object()))
        self.place1 = SimpleNamespace(id=self.p1, position=1, name="Место 1", note=None)
        self.place2 = SimpleNamespace(id=self.p2, position=2, name="Место 2", note=None)
        self.service.places = SimpleNamespace(
            list_for_day=AsyncMock(return_value=[self.place1, self.place2]),
            next_position=AsyncMock(return_value=3),
            add=Mock(), get_owned=AsyncMock(return_value=self.place1), delete=AsyncMock(),
        )

    async def test_create_append_position_and_lock_day(self):
        place = await self.service.create(self.uid, self.tid, self.did, PlaceCreate(name="Эрмитаж"))
        self.assertEqual(place.position, 3)
        self.service.days.get_owned.assert_awaited_once_with(
            self.uid, self.tid, self.did, for_update=True
        )
        self.db.commit.assert_awaited_once()

    async def test_place_lookup_restricted_to_owner(self):
        self.service.places.get_owned.return_value = None
        with self.assertRaises(PlaceNotFoundError):
            await self.service.get(self.uid, self.tid, self.did, self.p1)
        self.service.places.get_owned.assert_awaited_once_with(
            self.uid, self.tid, self.did, self.p1
        )

    async def test_patch_note_does_not_change_other_fields(self):
        await self.service.update(
            self.uid, self.tid, self.did, self.p1, PlaceUpdate(note="Новая заметка")
        )
        self.assertEqual(self.place1.name, "Место 1")
        self.assertEqual(self.place1.note, "Новая заметка")
        self.db.commit.assert_awaited_once()

    async def test_reorder_is_atomic(self):
        places = await self.service.reorder(
            self.uid, self.tid, self.did, PlaceReorder(place_ids=[self.p2, self.p1])
        )
        self.assertEqual([p.id for p in places], [self.p2, self.p1])
        self.assertEqual((self.place1.position, self.place2.position), (2, 1))
        self.assertIn("SET CONSTRAINTS", str(self.db.execute.await_args.args[0]))
        self.db.commit.assert_awaited_once()

    async def test_reorder_rejects_missing_id(self):
        with self.assertRaises(PlaceOrderConflictError):
            await self.service.reorder(
                self.uid, self.tid, self.did, PlaceReorder(place_ids=[self.p1])
            )
        self.db.commit.assert_not_awaited()

    async def test_reorder_requires_owned_day(self):
        self.service.days.get_owned.return_value = None
        with self.assertRaises(TripDayNotFoundError):
            await self.service.reorder(
                self.uid, self.tid, self.did, PlaceReorder(place_ids=[self.p1, self.p2])
            )


class OwnershipQueryTests(unittest.IsolatedAsyncioTestCase):
    async def test_day_query_checks_owner_and_trip(self):
        result = Mock()
        result.scalar_one_or_none.return_value = None
        db = SimpleNamespace(execute=AsyncMock(return_value=result))
        await TripDayRepository(db).get_owned(uuid4(), uuid4(), uuid4())
        sql = str(db.execute.await_args.args[0])
        for field in ("trips.user_id", "trip_days.trip_id", "trip_days.id"):
            self.assertIn(field, sql)

    async def test_place_query_checks_owner_trip_day_and_place(self):
        result = Mock()
        result.scalar_one_or_none.return_value = None
        db = SimpleNamespace(execute=AsyncMock(return_value=result))
        await PlaceRepository(db).get_owned(uuid4(), uuid4(), uuid4(), uuid4())
        sql = str(db.execute.await_args.args[0])
        for field in ("trips.user_id", "trip_days.trip_id", "places.trip_day_id", "places.id"):
            self.assertIn(field, sql)


class ExistingTripDateChangeTests(unittest.IsolatedAsyncioTestCase):
    async def test_cannot_shrink_trip_when_days_contain_places(self):
        db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
        service = TripService(db)
        service.repository = SimpleNamespace(get_for_user=AsyncMock(return_value=SimpleNamespace(
            start_date=date(2027, 6, 1), end_date=date(2027, 6, 7)
        )))
        service.days = SimpleNamespace(
            list_for_trip=AsyncMock(return_value=[SimpleNamespace(
                id=uuid4(), day_date=date(2027, 6, 6)
            )]),
            have_places=AsyncMock(return_value=True),
            delete=AsyncMock(), add=Mock(),
        )
        with self.assertRaises(TripDaysOutsideRangeError):
            await service.update(uuid4(), uuid4(), TripUpdate(end_date=date(2027, 6, 4)))
        db.commit.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
