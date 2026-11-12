from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.users import router as users_router
from app.api.v1.trips import router as trips_router
from app.api.v1.trip_days import router as trip_days_router
from app.api.v1.places import router as places_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(users_router
                          , prefix="/users"
                          , tags=["Users"])
api_router.include_router(auth_router
                          , prefix="/auth"
                          , tags=["Auth"])

api_router.include_router(trips_router, prefix="/trips", tags=["Trips"])

api_router.include_router(trip_days_router, prefix="/trips", tags=["Trip Days"])
api_router.include_router(places_router, prefix="/trips", tags=["Places"])
