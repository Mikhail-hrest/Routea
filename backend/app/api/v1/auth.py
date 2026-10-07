from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.schemas.user import UserResponse

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
    email = str(data.email).strip().lower()

    statement = select(User).where(func.lower(User.email) == email)
    result = await db.execute(statement)
    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT
            , detail="User with this email already exist"
        )
    password = data.password.get_secret_value()
    password_hash = hash_password(password)

    user = User(
        email=email
        , password_hash=password_hash
    )

    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        #отменить транзакцию и вернуть сессию в рабочее состояние
        await db.rollback()
        #на случай если две попытки зарегестрироваться придет одновременно
        if getattr(exc.orig, "sqlstate", None) == "23505":#код Postgresql для нарушения unique
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT
                , detail="User with this email already exist"
            ) from exc
        raise

    await db.refresh(user)

    return user