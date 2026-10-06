from fastapi import FastAPI as fa

from app.api.v1.router import api_router

app = fa(
    title = "Routea",
    version = "1.0"
)

app.include_router(api_router,
                   prefix="/api/v1")