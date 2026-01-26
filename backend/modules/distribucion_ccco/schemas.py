from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class DistribucionCCCOBase(BaseModel):
    """Base schema para distribución CC/CO"""
    centro_costo_id: UUID
    centro_operacion_id: UUID
    unidad_negocio_id: Optional[UUID] = None
    cuenta_auxiliar_id: Optional[UUID] = None
    porcentaje: float = Field(gt=0, le=100, description="Porcentaje de distribución (0-100)")


class DistribucionCCCOCreate(DistribucionCCCOBase):
    """Schema para crear una distribución"""
    pass


class DistribucionCCCOUpdate(DistribucionCCCOBase):
    """Schema para actualizar una distribución"""
    pass


class DistribucionCCCOResponse(DistribucionCCCOBase):
    """Schema de respuesta con todos los campos"""
    id: UUID
    factura_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DistribucionBulkUpdate(BaseModel):
    """Schema para actualizar múltiples distribuciones de una factura"""
    distribuciones: list[DistribucionCCCOCreate] = Field(
        default_factory=list,
        description="Lista de distribuciones (puede estar vacía para eliminar todas)"
    )
    
    @validator('distribuciones')
    def validate_percentages_sum(cls, v):
        """Validar que la suma de porcentajes sea 100 si hay distribuciones"""
        if v:  # Solo validar si hay distribuciones
            total = sum(d.porcentaje for d in v)
            if abs(total - 100.0) > 0.01:  # Tolerancia de 0.01 para errores de redondeo
                raise ValueError(f'La suma de porcentajes debe ser 100%. Total actual: {total}%')
        return v
