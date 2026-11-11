"""Unit tests for trips that do not require a running database."""

import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from pydantic import ValidationError

from app.core.exceptions import InvalidTripDatesError, TripNotFoundError
from app.repositories.trip import TripRepository
from app.schemas.trip import TripCreate, TripUpdate
from app.services.trip import TripService


class TripSchemaTests(unittest.TestCase):
    def setUp(self):
        self.body = {
            "title": "  Каникулы ",
            "destination": "  Прага ",
            "start_date": "2027-06-01",
            "end_date": "2027-06-07",
            "planned_budget": "1200.50",
            "currency": " eur ",
        }

    def test_valid_create(self):
        trip = TripCreate.model_validate(self.body)
        self.assertEqual(trip.title, "Каникулы")
        self.assertEqual(trip.destination, "Прага")
        self.assertEqual(trip.currency, "EUR")
        self.assertEqual(trip.planned_budget, Decimal("1200.50"))
        self.assertEqual(trip.start_date, date(2027, 6, 1))

    def test_reversed_dates_are_rejected(self):
        with self.assertRaises(ValidationError):
            TripCreate.model_validate({**self.body, "end_date": "2027-05-30"})

    def test_invalid_budget_is_rejected(self):
        for budget in ("-1", "100.999", "1234567890123.99"):
            with self.subTest(budget=budget), self.assertRaises(ValidationError):
                TripCreate.model_validate({**self.body, "planned_budget": budget})

    def test_no_client_supplied_owner(self):
        with self.assertRaises(ValidationError):
            TripCreate.model_validate({**self.body, "user_id": str(uuid4())})

    def test_patch_rejects_null_but_allows_omission(self):
        self.assertEqual(TripUpdate().model_dump(exclude_unset=True), {})
        with self.assertRaises(ValidationError):
            TripUpdate.model_validate({"title": None})
        self.assertEqual(TripUpdate(title="  Отпуск ").title, "Отпуск")


class TripServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
        self.service = TripService(self.db)
        self.service.repository = SimpleNamespace(
            get_for_user=AsyncMock(),
            delete=AsyncMock(),
            add=Mock(),
            list_for_user=AsyncMock(return_value=[]),
        )
        self.user_id = uuid4()
        self.trip_id = uuid4()
        self.trip = SimpleNamespace(
            id=self.trip_id,
            user_id=self.user_id,
            title="Отпуск",
            destination="Париж",
            start_date=date(2027, 5, 10),
            end_date=date(2027, 5, 20),
            planned_budget=Decimal("400.00"),
            currency="EUR",
            created_at=datetime.now(timezone.utc),
        )

    async def test_missing_or_foreign_trip_is_hidden(self):
        self.service.repository.get_for_user.return_value = None
        with self.assertRaises(TripNotFoundError):
            await self.service.get_for_user(self.user_id, self.trip_id)
        self.service.repository.get_for_user.assert_awaited_once_with(
            self.trip_id, self.user_id
        )

    async def test_patch_checks_final_dates_before_writing(self):
        self.service.repository.get_for_user.return_value = self.trip
        with self.assertRaises(InvalidTripDatesError):
            await self.service.update(
                self.user_id, self.trip_id,
                TripUpdate(start_date=date(2027, 5, 25)),
            )
        self.assertEqual(self.trip.start_date, date(2027, 5, 10))
        self.db.commit.assert_not_awaited()

    async def test_update_changes_only_supplied_fields(self):
        self.service.repository.get_for_user.return_value = self.trip
        await self.service.update(
            self.user_id, self.trip_id,
            TripUpdate(title="  Новый отпуск ", planned_budget="500.20"),
        )
        self.assertEqual(self.trip.title, "Новый отпуск")
        self.assertEqual(self.trip.planned_budget, Decimal("500.20"))
        self.assertEqual(self.trip.destination, "Париж")
        self.db.commit.assert_awaited_once()

    async def test_delete_uses_owned_trip(self):
        self.service.repository.get_for_user.return_value = self.trip
        await self.service.delete(self.user_id, self.trip_id)
        self.service.repository.delete.assert_awaited_once_with(self.trip)
        self.db.commit.assert_awaited_once()


class TripRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_lookup_filters_both_trip_id_and_owner_id(self):
        db = SimpleNamespace(execute=AsyncMock(return_value=Mock()))
        db.execute.return_value.scalar_one_or_none.return_value = None
        trip_id, user_id = uuid4(), uuid4()
        await TripRepository(db).get_for_user(trip_id, user_id)
        statement = db.execute.await_args.args[0]
        sql = str(statement)
        self.assertIn("trips.id =", sql)
        self.assertIn("trips.user_id =", sql)


if __name__ == "__main__":
    unittest.main()
