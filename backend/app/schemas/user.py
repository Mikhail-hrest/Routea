from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

# Pydantic-модель описывающая json ответ API
# и поля в классе - это все что разрешено вернуть клиенту
class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    is_blocked: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)