from fastapi import FastAPI as fa

from app.api.v1.router import api_router

app = fa(
    title = "Routea",
    version = "1.0"
)

async def root():
    return {"mesg": "Routea backend is running"}