"""Pydantic request/response schemas for days inside a trip."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class TripDayCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day_date: date


class TripDayUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day_date: date | None = None

    @model_validator(mode="after")
    def check_non_null(self):
        if "day_date" in self.model_fields_set and self.day_date is None:
            raise ValueError("Дата дня не может быть null")
        return self


class TripDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    trip_id: UUID
    day_date: date
