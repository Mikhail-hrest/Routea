"""Authenticated trips API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidTripDatesError, TripNotFoundError
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.trip import TripCreate, TripResponse, TripUpdate
from app.services.trip import TripService

router = APIRouter()
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def trip_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Поездка не найдена",
    )


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(data: TripCreate, current_user: CurrentUser, db: DbSession):
    return await TripService(db).create(current_user.id, data)


@router.get("", response_model=list[TripResponse])
async def list_trips(current_user: CurrentUser, db: DbSession):
    return await TripService(db).list_for_user(current_user.id)


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(trip_id: UUID, current_user: CurrentUser, db: DbSession):
    try:
        return await TripService(db).get_for_user(current_user.id, trip_id)
    except TripNotFoundError as exc:
        raise trip_not_found() from exc


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(trip_id: UUID, data: TripUpdate, current_user: CurrentUser, db: DbSession):
    try:
        return await TripService(db).update(current_user.id, trip_id, data)
    except TripNotFoundError as exc:
        raise trip_not_found() from exc
    except InvalidTripDatesError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Дата окончания не может быть раньше даты начала",
        ) from exc


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(trip_id: UUID, current_user: CurrentUser, db: DbSession):
    try:
        await TripService(db).delete(current_user.id, trip_id)
    except TripNotFoundError as exc:
        raise trip_not_found() from exc
