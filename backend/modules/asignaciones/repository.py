"""
Repository para asignaciones de facturas.
Maneja validaciones de negocio y acceso a la base de datos.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from uuid import UUID
import uuid

from db.models import FacturaAsignacion, Factura, Area, User, Estado


class AsignacionRepository:
    """Repository para operaciones de asignaciones de facturas."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def validate_factura_exists(self, factura_id: UUID) -> Factura:
        """Valida que la factura exista."""
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con id {factura_id} no encontrada"
            )
        
        return factura
    
    async def validate_area_exists(self, area_id: UUID) -> Area:
        """Valida que el área exista."""
        result = await self.db.execute(
            select(Area).where(Area.id == area_id)
        )
        area = result.scalar_one_or_none()
        
        if not area:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Área con id {area_id} no encontrada"
            )
        
        return area
    
    async def validate_user_exists(self, user_id: UUID) -> User:
        """Valida que el usuario exista."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario con id {user_id} no encontrado"
            )
        
        return user
    
    async def validate_user_belongs_to_area(self, user: User, area_id: UUID):
        """Valida que el usuario pertenezca al área especificada."""
        if user.area_id != area_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El usuario {user.nombre} no pertenece al área especificada"
            )
    
    async def validate_factura_assignable_state(self, factura: Factura):
        """Valida que la factura esté en un estado asignable (Recibida)."""
        # Estado "Recibida" debe tener id = 1
        if factura.estado_id != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La factura solo puede ser asignada si está en estado 'Recibida'"
            )
    
    async def validate_no_duplicate_assignment(
        self, 
        factura_id: UUID, 
        user_id: UUID
    ):
        """Valida que no exista una asignación duplicada."""
        result = await self.db.execute(
            select(FacturaAsignacion).where(
                and_(
                    FacturaAsignacion.factura_id == factura_id,
                    FacturaAsignacion.responsable_user_id == user_id
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una asignación de esta factura a este usuario"
            )
    
    async def create_asignacion(
        self,
        factura_id: UUID,
        area_id: UUID,
        responsable_user_id: UUID
    ) -> FacturaAsignacion:
        """Crea una nueva asignación en la base de datos."""
        asignacion = FacturaAsignacion(
            id=uuid.uuid4(),
            factura_id=factura_id,
            area_id=area_id,
            responsable_user_id=responsable_user_id
        )
        
        self.db.add(asignacion)
        await self.db.flush()
        
        return asignacion
    
    async def update_factura_assignment(
        self,
        factura: Factura,
        area_id: UUID,
        responsable_user_id: UUID
    ):
        """Actualiza los campos de asignación en la factura."""
        from datetime import datetime
        
        factura.area_id = area_id
        factura.assigned_to_user_id = responsable_user_id
        factura.assigned_at = datetime.utcnow()
        factura.estado_id = 2  # Estado "Asignada"
        
        await self.db.flush()
    
    async def get_asignacion_with_relations(
        self, 
        asignacion_id: UUID
    ) -> FacturaAsignacion:
        """Obtiene una asignación con todas sus relaciones cargadas."""
        result = await self.db.execute(
            select(FacturaAsignacion).where(FacturaAsignacion.id == asignacion_id)
        )
        asignacion = result.scalar_one_or_none()
        
        if not asignacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Asignación no encontrada"
            )
        
        # Refrescar para asegurar que las relaciones estén actualizadas
        await self.db.refresh(asignacion)
        await self.db.refresh(asignacion.factura)
        
        return asignacion
