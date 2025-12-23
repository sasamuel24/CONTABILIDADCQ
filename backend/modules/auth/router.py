"""
Router de FastAPI para el módulo de autenticación.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from modules.auth.repository import AuthRepository
from modules.auth.service import AuthService
from modules.auth.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    UserMeResponse
)
from core.security import decode_token


router = APIRouter(prefix="/auth", tags=["Autenticación"])
security = HTTPBearer()


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Dependency para obtener el servicio de autenticación."""
    repository = AuthRepository(db)
    return AuthService(repository)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UUID:
    """Dependency para extraer user_id del token."""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    return UUID(user_id)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    service: AuthService = Depends(get_auth_service)
):
    """Autenticar usuario y generar tokens JWT."""
    return await service.login(request.email, request.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: RefreshRequest,
    service: AuthService = Depends(get_auth_service)
):
    """Renovar access token usando refresh token."""
    return await service.refresh(request.refresh_token)


@router.post("/logout")
async def logout(
    request: LogoutRequest,
    service: AuthService = Depends(get_auth_service)
):
    """Invalidar refresh token (logout)."""
    return await service.logout(request.refresh_token)


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    user_id: UUID = Depends(get_current_user_id),
    service: AuthService = Depends(get_auth_service)
):
    """Obtener información del usuario autenticado."""
    return await service.get_current_user(user_id)
