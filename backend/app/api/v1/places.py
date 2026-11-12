"""Place CRUD and atomic ordering for the day of an authenticated user's trip."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    PlaceNotFoundError, PlaceOrderConflictError, TripDayNotFoundError,
)
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.place import PlaceCreate, PlaceReorder, PlaceResponse, PlaceUpdate
from app.services.place import PlaceService

router = APIRouter()
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def place_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (PlaceNotFoundError, TripDayNotFoundError)):
        return HTTPException(status.HTTP_404_NOT_FOUND, "Место или день поездки не найдены")
    if isinstance(exc, PlaceOrderConflictError):
        return HTTPException(status.HTTP_409_CONFLICT,
                             "Список мест изменился; обновите его перед сортировкой")
    raise exc


@router.post("/{trip_id}/days/{day_id}/places", response_model=PlaceResponse,
             status_code=status.HTTP_201_CREATED)
async def create_place(trip_id: UUID, day_id: UUID, data: PlaceCreate,
                       current_user: CurrentUser, db: DbSession):
    try:
        return await PlaceService(db).create(current_user.id, trip_id, day_id, data)
    except TripDayNotFoundError as exc:
        raise place_error(exc) from exc


@router.get("/{trip_id}/days/{day_id}/places", response_model=list[PlaceResponse])
async def list_places(trip_id: UUID, day_id: UUID,
                      current_user: CurrentUser, db: DbSession):
    try:
        return await PlaceService(db).list_for_day(current_user.id, trip_id, day_id)
    except TripDayNotFoundError as exc:
        raise place_error(exc) from exc


@router.put("/{trip_id}/days/{day_id}/places/order", response_model=list[PlaceResponse])
async def reorder_places(trip_id: UUID, day_id: UUID, data: PlaceReorder,
                         current_user: CurrentUser, db: DbSession):
    try:
        return await PlaceService(db).reorder(current_user.id, trip_id, day_id, data)
    except (TripDayNotFoundError, PlaceOrderConflictError) as exc:
        raise place_error(exc) from exc


@router.get("/{trip_id}/days/{day_id}/places/{place_id}", response_model=PlaceResponse)
async def get_place(trip_id: UUID, day_id: UUID, place_id: UUID,
                    current_user: CurrentUser, db: DbSession):
    try:
        return await PlaceService(db).get(current_user.id, trip_id, day_id, place_id)
    except PlaceNotFoundError as exc:
        raise place_error(exc) from exc


@router.patch("/{trip_id}/days/{day_id}/places/{place_id}", response_model=PlaceResponse)
async def update_place(trip_id: UUID, day_id: UUID, place_id: UUID,
                       data: PlaceUpdate, current_user: CurrentUser, db: DbSession):
    try:
        return await PlaceService(db).update(current_user.id, trip_id, day_id, place_id, data)
    except PlaceNotFoundError as exc:
        raise place_error(exc) from exc


@router.delete("/{trip_id}/days/{day_id}/places/{place_id}",
               status_code=status.HTTP_204_NO_CONTENT)
async def delete_place(trip_id: UUID, day_id: UUID, place_id: UUID,
                       current_user: CurrentUser, db: DbSession):
    try:
        await PlaceService(db).delete(current_user.id, trip_id, day_id, place_id)
    except (PlaceNotFoundError, TripDayNotFoundError) as exc:
        raise place_error(exc) from exc
