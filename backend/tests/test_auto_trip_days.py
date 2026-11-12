"""Trip calendar day generation, synchronization and deletion safeguards."""

import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from app.core.exceptions import InvalidTripDatesError, TripDaysOutsideRangeError
from app.schemas.trip import TripCreate, TripUpdate
from app.services.trip import TripService, dates_inclusive


class TripDateRangeTests(unittest.TestCase):
    def test_inclusive_range_and_year_crossing(self):
        self.assertEqual(list(dates_inclusive(date(2026, 11, 12), date(2026, 11, 19))),
                         [date(2026, 11, n) for n in range(12, 20)])
        self.assertEqual(list(dates_inclusive(date(2027, 12, 31), date(2028, 1, 2))),
                         [date(2027, 12, 31), date(2028, 1, 1), date(2028, 1, 2)])
        self.assertEqual(list(dates_inclusive(date(2028, 2, 28), date(2028, 3, 1))),
                         [date(2028, 2, 28), date(2028, 2, 29), date(2028, 3, 1)])
        self.assertEqual(list(dates_inclusive(date(2026, 11, 12), date(2026, 11, 12))),
                         [date(2026, 11, 12)])


class TripAutoDayServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.uid, self.tid = uuid4(), uuid4()
        self.db = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock(), refresh=AsyncMock())
        self.service = TripService(self.db)
        self.service.repository = SimpleNamespace(
            add=Mock(side_effect=lambda trip: setattr(trip, "id", self.tid)),
            get_for_user=AsyncMock(),
        )
        self.service.days = SimpleNamespace(
            add=Mock(), list_for_trip=AsyncMock(return_value=[]),
            have_places=AsyncMock(return_value=False), delete=AsyncMock(),
        )
        self.trip = SimpleNamespace(
            id=self.tid, start_date=date(2026, 11, 12), end_date=date(2026, 11, 19)
        )
        self.service.repository.get_for_user.return_value = self.trip

    async def test_create_creates_eight_persisted_days_in_single_commit(self):
        payload = TripCreate(
            title="Минск", destination="Минск, Беларусь",
            start_date=date(2026, 11, 12), end_date=date(2026, 11, 19),
            planned_budget="10000", currency="RUB",
        )
        trip = await self.service.create(self.uid, payload)
        self.assertEqual(trip.id, self.tid)
        actual = [call.args[0].day_date for call in self.service.days.add.call_args_list]
        self.assertEqual(actual, [date(2026, 11, x) for x in range(12, 20)])
        self.assertTrue(all(c.args[0].trip_id == self.tid
                            for c in self.service.days.add.call_args_list))
        self.db.flush.assert_awaited_once()
        self.db.commit.assert_awaited_once()

    async def test_extend_trip_adds_new_dates_without_duplicates(self):
        self.trip.end_date = date(2026, 11, 14)
        self.service.days.list_for_trip.return_value = [
            SimpleNamespace(id=uuid4(), day_date=date(2026, 11, x))
            for x in (12, 13, 14)
        ]
        await self.service.update(
            self.uid, self.tid, TripUpdate(end_date=date(2026, 11, 16))
        )
        self.assertEqual([c.args[0].day_date for c in self.service.days.add.call_args_list],
                         [date(2026, 11, 15), date(2026, 11, 16)])
        self.service.days.delete.assert_not_awaited()
        self.db.commit.assert_awaited_once()

    async def test_shorten_trip_removes_only_empty_days(self):
        self.service.days.list_for_trip.return_value = [
            SimpleNamespace(id=uuid4(), day_date=date(2026, 11, x))
            for x in range(12, 20)
        ]
        await self.service.update(
            self.uid, self.tid, TripUpdate(end_date=date(2026, 11, 16))
        )
        removed = [c.args[0].day_date for c in self.service.days.delete.await_args_list]
        self.assertEqual(removed, [date(2026, 11, 17), date(2026, 11, 18), date(2026, 11, 19)])
        self.assertEqual(self.trip.end_date, date(2026, 11, 16))
        self.db.commit.assert_awaited_once()

    async def test_shorten_trip_with_places_is_rejected_without_changes(self):
        self.service.days.list_for_trip.return_value = [
            SimpleNamespace(id=uuid4(), day_date=date(2026, 11, x))
            for x in range(12, 20)
        ]
        self.service.days.have_places.return_value = True
        with self.assertRaises(TripDaysOutsideRangeError):
            await self.service.update(
                self.uid, self.tid, TripUpdate(end_date=date(2026, 11, 16))
            )
        self.assertEqual(self.trip.end_date, date(2026, 11, 19))
        self.service.days.delete.assert_not_awaited()
        self.db.commit.assert_not_awaited()

    async def test_invalid_dates_rejected_without_changes(self):
        with self.assertRaises(InvalidTripDatesError):
            await self.service.update(
                self.uid, self.tid, TripUpdate(start_date=date(2026, 11, 21))
            )
        self.service.days.list_for_trip.assert_not_awaited()
        self.db.commit.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
