"""
Schemas de Pydantic para asignaciones de facturas.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class AsignacionCreateRequest(BaseModel):
    """Schema para crear una nueva asignación de factura."""
    area_id: UUID = Field(..., description="ID del área a la que se asigna la factura")
    responsable_user_id: UUID = Field(..., description="ID del usuario responsable")


class ResponsableInfo(BaseModel):
    """Información del responsable de la asignación."""
    id: UUID
    nombre: str
    email: str


class AsignacionResponse(BaseModel):
    """Schema de respuesta para una asignación creada."""
    asignacion_id: UUID
    factura_id: UUID
    numero_factura: str
    proveedor: str
    area: str
    responsable: ResponsableInfo
    estado_factura: str
    fecha_asignacion: datetime
    
    model_config = {"from_attributes": True}
