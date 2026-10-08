from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UserAlreadyExistError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest

class AuthService:
    def __init__(self, db:AsyncSession):
        self.db = db
        self.user_repository = UserRepository(db)
    
    async def register(
            self
            , data: RegisterRequest
    ) -> User:
        email = str(data.email).strip().lower()

        existing_user = await self.user_repository.get_by_email(email)
        if existing_user is not None:
            raise UserAlreadyExistError()

        password = data.password.get_secret_value()
        password_hash = hash_password(password)

        user = User(
            name = data.name
            , email = email
            , password_hash = password_hash
        )
        self.user_repository.add(user)
        
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            if getattr(exc.orig, "sqlstate", None) == "23505":
                raise UserAlreadyExistError() from exc
            raise

        await self.db.refresh(user)

        return user