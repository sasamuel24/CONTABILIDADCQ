"""
Esquemas Pydantic para el módulo de files.
"""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


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
