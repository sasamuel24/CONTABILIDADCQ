"""
Servicio para lógica de negocio de autenticación.
"""
from modules.auth.repository import AuthRepository
from modules.auth.schemas import TokenResponse, UserMeResponse
from core.security import verify_password, create_access_token, create_refresh_token, decode_token
from fastapi import HTTPException, status
from core.logging import logger
from uuid import UUID


class AuthService:
    """Servicio que contiene la lógica de negocio de autenticación."""
    
    def __init__(self, repository: AuthRepository):
        self.repository = repository
    
    async def login(self, email: str, password: str) -> TokenResponse:
        """Autenticar usuario y generar tokens."""
        logger.info(f"Intento de login para: {email}")
        
        user = await self.repository.get_user_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            logger.warning(f"Login fallido para: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )
        
        # Crear tokens
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        logger.info(f"Login exitoso para: {email}")
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
    
    async def refresh(self, refresh_token: str) -> TokenResponse:
        """Renovar access token usando refresh token."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        # Verificar que el usuario sigue activo
        user = await self.repository.get_user_by_id(UUID(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o inactivo"
            )
        
        # Crear nuevo access token (opcionalmente rotar refresh token)
        token_data = {"sub": user_id, "email": email}
        access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)
        
        logger.info(f"Token renovado para usuario: {email}")
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token
        )
    
    async def logout(self, refresh_token: str) -> dict:
        """Invalidar refresh token (en implementación real, agregar a blacklist)."""
        payload = decode_token(refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )
        
        # TODO: Agregar token a blacklist en Redis
        logger.info(f"Logout exitoso para usuario: {payload.get('email')}")
        return {"detail": "Logout exitoso"}
    
    async def get_current_user(self, user_id: UUID) -> UserMeResponse:
        """Obtener información del usuario autenticado."""
        user = await self.repository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return UserMeResponse(
            id=user.id,
            nombre=user.nombre,
            email=user.email,
            role=user.role.code,
            area=user.area
        )
