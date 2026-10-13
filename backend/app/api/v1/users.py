from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/me"
            , response_model=UserResponse)
async def get_me(current_user: Annotated[User
                                         , Depends(get_current_user)]):
    return current_user