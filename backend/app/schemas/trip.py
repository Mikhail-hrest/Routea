"""Request/response contracts for trips (Pydantic v2)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator


TripTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
TripDestination = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)]
TripBudget = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
TripCurrency = Annotated[str, Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")]


class TripCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TripTitle
    destination: TripDestination
    start_date: date
    end_date: date
    planned_budget: TripBudget
    currency: TripCurrency

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def dates_in_order(self):
        if self.end_date < self.start_date:
            raise ValueError("Дата окончания не может быть раньше даты начала")
        return self


class TripUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TripTitle | None = None
    destination: TripDestination | None = None
    start_date: date | None = None
    end_date: date | None = None
    planned_budget: TripBudget | None = None
    currency: TripCurrency | None = None

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def disallow_explicit_null(self):
        # PATCH may omit fields but the database does not allow them to become NULL.
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"Поле '{field}' не может быть null")
        return self


class TripResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    destination: str
    start_date: date
    end_date: date
    planned_budget: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime
