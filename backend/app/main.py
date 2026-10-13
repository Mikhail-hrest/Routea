from fastapi import FastAPI as fa
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router

app = fa(
    title = "Routea"
    , version = "1.0"
)

app.add_middleware(
    CORSMiddleware
    , allow_origins=[
        "http://localhost:5173"
        , "http://127.0.0.1:5173"
    ]
    , allow_credentials=True
    , allow_headers=["*"]
    , allow_methods=["*"]
)


app.include_router(api_router
                   , prefix="/api/v1")