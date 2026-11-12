"""Pydantic schemas for places and explicit ordering within a trip day."""

from datetime import datetime, time
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

PlaceName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class PlaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: PlaceName
    address: str | None = None
    planned_time: time | None = None
    note: str | None = None

    @field_validator("planned_time")
    @classmethod
    def no_timezone(cls, value: time | None) -> time | None:
        if value is not None and value.tzinfo is not None:
            raise ValueError("Время должно быть без часового пояса")
        return value


class PlaceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: PlaceName | None = None
    address: str | None = None
    planned_time: time | None = None
    note: str | None = None

    @field_validator("planned_time")
    @classmethod
    def no_timezone(cls, value: time | None) -> time | None:
        if value is not None and value.tzinfo is not None:
            raise ValueError("Время должно быть без часового пояса")
        return value

    @model_validator(mode="after")
    def cannot_clear_name(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Название места не может быть null")
        return self


class PlaceReorder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    place_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def no_duplicate_ids(self):
        if len(self.place_ids) != len(set(self.place_ids)):
            raise ValueError("Нельзя повторять ID места")
        return self


class PlaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    trip_day_id: UUID
    name: str
    address: str | None
    planned_time: time | None
    note: str | None
    position: int
    created_at: datetime
    updated_at: datetime
