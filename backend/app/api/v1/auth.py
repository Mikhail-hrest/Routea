from fastapi import APIRouter \
    , Depends \
    , HTTPException \
    , status \
    , Request \
    , Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UserAlreadyExistError \
                                , InvalidCredentialsError \
                                , UserBlockedError \
                                , InvalidRefreshTokenError
from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth import RegisterRequest \
                            , LoginRequest \
                            , LoginResponse
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

@router.post("/login"
             , response_model=LoginResponse)
async def login(data:LoginRequest
                , request: Request
                , response: Response
                , db: AsyncSession=Depends(get_db)):
    service = AuthService(db)
    try:
        access_token, refresh_token = await service.login(data=data
                                                          , ip_address=(
                                                              request.client.host
                                                              if request.client is not None
                                                              else None)
                                                          , user_agent=request.headers.get("user-agent"))
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED
            , detail="Неверный логин или пароль"
        ) from exc
    except UserBlockedError as exc:
        raise HTTPException(
            status_code=HTTPException(
                status_code=status.HTTP_403_FORBIDDEN
                , detail="Пользователь заблокирован") 
        )from exc
    response.set_cookie(
        key="refresh_token"
        , value=refresh_token
        , httponly=True
        , secure=False #todo: исправить в продакшене на True
        , samesite="lax"
        , max_age=(settings.refresh_token_ttl_days*24*3600)
    )
    return LoginResponse(
        access_token=access_token
        , expires_in=(settings.access_token_ttl_min*60)
    )

@router.post("/refresh"
             , response_model=LoginResponse)
async def refresh(request: Request
                  , response: Response
                  , db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED
            , detail="Refresh token отсутствует")
    
    service = AuthService(db)

    try:
        access_token, new_refresh_token = await service.refresh(refresh_token)
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED
            , detail="Недействительный refresh token") from exc
    except UserBlockedError as exc:
        raise HTTPException (
            status_code=status.HTTP_403_FORBIDDEN
            , detail="Пользователь заблокирован") from exc

    response.set_cookie(
        key="refresh_token"
        , value=new_refresh_token
        , httponly=True
        , secure=False
        , samesite="lax"
        , max_age=(settings.refresh_token_ttl_days*24*3600)
    )

    return LoginResponse(
        access_token=access_token
        , expires_in=(settings.access_token_ttl_min*60)
    )

@router.post("/logout"
             , status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request
                 , response: Response
                 , db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token is None:
        response.delete_cookie(key="refresh_token")
        return
    service = AuthService(db)
    try:
        await service.logout(refresh_token)
    except InvalidRefreshTokenError:
        pass

    response.delete_cookie(
        key="refresh_token"
        , httponly=True
        , secure=False
        , samesite="lax"
    )