"""
Esquemas Pydantic para el módulo de files.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class FileCreateRequest(BaseModel):
    """Schema para registrar metadata de archivo (sin upload binario)."""
    storage_provider: str = Field(..., description="Proveedor de almacenamiento (ej: s3, local, drive)")
    storage_path: str = Field(..., description="Ruta o key del archivo en el storage")
    filename: str = Field(..., description="Nombre del archivo")
    content_type: str = Field(..., description="Tipo MIME del archivo")
    size_bytes: int = Field(..., gt=0, description="Tamaño del archivo en bytes")


class FileResponse(BaseModel):
    """Respuesta de archivo."""
    id: UUID
    factura_id: UUID
    storage_provider: str
    storage_path: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime
    
    model_config = {"from_attributes": True}
