from pydantic import (
    BaseModel
    , ConfigDict
    , EmailStr
    , SecretStr
)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: SecretStr
    model_config = ConfigDict(extra="forbid")#запрещает самостоятельно вставить role=ADMIN