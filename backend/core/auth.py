"""
Middleware y dependencias de autenticación por API Key y JWT.
"""
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings
from core.logging import logger
from core.security import decode_token
from uuid import UUID


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependencia para obtener el usuario actual desde el token JWT.
    
    Returns:
        dict con información del usuario (user_id, email)
    
    Raises:
        HTTPException 401: Si el token falta, es inválido o expiró
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        logger.warning("Token inválido o expirado")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        logger.warning("Token sin user_id")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return {
        "user_id": user_id,
        "email": email
    }


async def require_api_key(x_api_key: str = Header(..., description="API Key para autenticación", alias="x-api-key")):
    """
    Dependencia que valida el header x-api-key.
    
    Uso: Proteger endpoints de ingesta (POST facturas, POST files)
    
    Raises:
        HTTPException 401: Si la API key falta o es incorrecta
    """
    expected_key = settings.api_key.strip()
    received_key = x_api_key.strip() if x_api_key else None
    
    logger.info(f"Validando API Key - Recibida: '{received_key[:10] if received_key else 'None'}...'")
    logger.debug(f"Expected key length: {len(expected_key)}, Received key length: {len(received_key) if received_key else 0}")
    
    if not received_key:
        logger.warning("Intento de acceso sin API Key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    if received_key != expected_key:
        logger.warning(f"Intento de acceso con API Key inválida. Esperada: '{expected_key[:10]}...', Recibida: '{received_key[:10]}...'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    logger.info("API Key validada exitosamente")
    return received_key
