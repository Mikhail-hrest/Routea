from typing import Annotated
from pydantic import (
    BaseModel
    , ConfigDict
    , EmailStr
    , SecretStr
    , StringConstraints
    , field_validator
)

UserName = Annotated[
    str
    , StringConstraints(
        strip_whitespace=True
        , min_length=1
        , max_length=100
    )
]
class RegisterRequest(BaseModel):
    name: UserName
    email: EmailStr
    password: SecretStr
    model_config = ConfigDict(extra="forbid")#запрещает самостоятельно вставить role=ADMIN

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: SecretStr)->SecretStr:
        password = value.get_secret_value()
        if len(password) < 8:
            raise ValueError(
                "Пароль должен содержать минимум 8 символов"
            )
        if not any(x.islower() for x in password):
            raise ValueError(
                "Пароль должен содержать хотя бы одну строчную букву"
            )
        if not any(x.isupper() for x in password):
            raise ValueError(
                "Пароль должен содержать хотя бы одну заглавную букву"
            )
        if not any(x.isdigit() for x in password):
            raise ValueError(
                "Пароль должен содержать хотя бы одну цифру"
            )
        return value