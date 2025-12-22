"""
Catálogo de estados para facturas.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from enum import Enum


router = APIRouter(prefix="/estados", tags=["Catálogos"])


class EstadoEnum(str, Enum):
    """Enumeración de estados posibles para facturas."""
    PENDIENTE = "pendiente"
    ASIGNADA = "asignada"
    EN_REVISION = "en_revision"
    CERRADA = "cerrada"
    RECHAZADA = "rechazada"


class Estado(BaseModel):
    """Modelo de estado."""
    valor: str
    descripcion: str


# Catálogo de estados disponibles
ESTADOS_CATALOGO = [
    Estado(valor=EstadoEnum.PENDIENTE, descripcion="Factura pendiente de asignación"),
    Estado(valor=EstadoEnum.ASIGNADA, descripcion="Factura asignada a un área"),
    Estado(valor=EstadoEnum.EN_REVISION, descripcion="Factura en proceso de revisión"),
    Estado(valor=EstadoEnum.CERRADA, descripcion="Factura procesada y cerrada"),
    Estado(valor=EstadoEnum.RECHAZADA, descripcion="Factura rechazada"),
]


@router.get("/", response_model=List[Estado])
async def get_estados():
    """Obtiene el catálogo de estados disponibles para facturas."""
    return ESTADOS_CATALOGO
