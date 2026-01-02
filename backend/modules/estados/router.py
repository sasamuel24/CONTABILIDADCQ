"""
Router de FastAPI para el módulo de estados.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from modules.estados.repository import EstadoRepository
from modules.estados.service import EstadoService
from modules.estados.schemas import EstadoResponse, EstadoCreate, EstadoUpdate


router = APIRouter(prefix="/estados", tags=["Estados"])


def get_estado_service(db: AsyncSession = Depends(get_db)) -> EstadoService:
    """Dependency para obtener el servicio de estados."""
    repository = EstadoRepository(db)
    return EstadoService(repository)


@router.get("/", response_model=List[EstadoResponse])
async def list_estados(service: EstadoService = Depends(get_estado_service)):
    """Lista todos los estados disponibles para facturas."""
    return await service.list_estados()


@router.post("/", response_model=EstadoResponse, status_code=status.HTTP_201_CREATED)
async def create_estado(
    estado_data: EstadoCreate,
    service: EstadoService = Depends(get_estado_service)
):
    """
    Crea un nuevo estado.
    
    Campos requeridos:
    - **code**: Código único del estado (ej: "APROBADO", "RECHAZADO")
    - **label**: Etiqueta descriptiva (ej: "Aprobado por Gerencia")
    - **order**: Orden de visualización (número entero >= 1)
    - **is_final**: Si es un estado final (default: false)
    - **is_active**: Si está activo (default: true)
    
    Validaciones:
    - El código debe ser único
    """
    return await service.create_estado(estado_data)


@router.patch("/{estado_id}", response_model=EstadoResponse)
async def update_estado(
    estado_id: int,
    estado_data: EstadoUpdate,
    service: EstadoService = Depends(get_estado_service)
):
    """
    Actualiza un estado existente.
    
    Campos opcionales:
    - **code**: Código único del estado
    - **label**: Etiqueta descriptiva
    - **order**: Orden de visualización
    - **is_final**: Si es un estado final
    - **is_active**: Si está activo
    
    Validaciones:
    - El estado debe existir
    - Si se cambia el código, no debe existir otro estado con ese código
    """
    return await service.update_estado(estado_id, estado_data)
