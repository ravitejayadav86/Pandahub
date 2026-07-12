from fastapi import APIRouter

from app.api.v1 import auth, explore, issues, repos, users

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(repos.router)
api_router.include_router(issues.router)
api_router.include_router(explore.router)
