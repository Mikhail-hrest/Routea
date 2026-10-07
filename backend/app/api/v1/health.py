from fastapi import APIRouter, Depends

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status" : "ok"}

@router.get("/health/database")
async def database_health_check(db: AsyncSession=Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {
        "status" : "ok"
        , "database" : "ok"
    }

@router.get("/health/database/users")
async def users_database_health_check(
    db: AsyncSession = Depends(get_db)
):
    statement = select(User).limit(1)
    result = await db.execute(statement)
    user = result.scalar_one_or_none()

    if user is None:
        return {
            "status" : "ok"
            , "users" : None
        }

    return {
        "status" : "ok"
        , "user" : {
            "id" : str(user.id)
            , "email" : user.email
            , "role" : user.role
            , "is_blocked": user.is_blocked
        }
    }