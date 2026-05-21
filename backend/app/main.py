from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="ASI — Adaptive Symbolic Interface",
    description="Backend API for the ASI pain management prototype",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routers import auth as auth_router

app.include_router(auth_router.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "asi-backend"}
