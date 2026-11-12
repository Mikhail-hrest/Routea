"""Nested trip-day API. Never accept owner IDs from the client."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    TripDayNotFoundError, TripNotFoundError,
)
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.trip_day import TripDayResponse
from app.services.trip_day import TripDayService

router = APIRouter()
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def handle_day_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (TripNotFoundError, TripDayNotFoundError)):
        return HTTPException(status.HTTP_404_NOT_FOUND, "Поездка или день не найдены")
    raise exc


@router.get("/{trip_id}/days", response_model=list[TripDayResponse])
async def list_trip_days(trip_id: UUID, current_user: CurrentUser, db: DbSession):
    try:
        return await TripDayService(db).list_for_trip(current_user.id, trip_id)
    except TripNotFoundError as exc:
        raise handle_day_error(exc) from exc


@router.get("/{trip_id}/days/{day_id}", response_model=TripDayResponse)
async def get_trip_day(trip_id: UUID, day_id: UUID,
                       current_user: CurrentUser, db: DbSession):
    try:
        return await TripDayService(db).get(current_user.id, trip_id, day_id)
    except TripDayNotFoundError as exc:
        raise handle_day_error(exc) from exc


