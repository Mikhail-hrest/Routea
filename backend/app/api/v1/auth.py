from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UserAlreadyExistError
from app.db.session import get_db
from app.schemas.auth import RegisterRequest
from app.schemas.user import UserResponse
from app.services.auth import AuthService

router = APIRouter()

@router.post(
    "/register"
    , response_model=UserResponse
    , status_code=status.HTTP_201_CREATED
)
async def register(
    data: RegisterRequest
    , db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    try:
        return await service.register(data)
    except UserAlreadyExistError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT
            , detail="user with this email already exist"
        ) from exc