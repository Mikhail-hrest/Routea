from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/first", response_model=UserResponse)
async def get_first_user(db: AsyncSession = Depends(get_db)):
    statement = select(User).limit(1)
    result = await db.execute(statement)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=404
            , detail="User not found"
        )
    return user