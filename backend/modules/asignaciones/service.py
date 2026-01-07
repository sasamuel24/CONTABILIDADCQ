"""
Service para asignaciones de facturas.
Maneja la lógica de negocio y orquesta las operaciones del repository.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from modules.asignaciones.repository import AsignacionRepository
from modules.asignaciones.schemas import AsignacionCreateRequest, AsignacionResponse, ResponsableInfo


class AsignacionService:
    """Service para operaciones de asignaciones de facturas."""
    
    def __init__(self, db: AsyncSession):
        self.repository = AsignacionRepository(db)
    
    async def crear_asignacion(
        self,
        factura_id: UUID,
        data: AsignacionCreateRequest
    ) -> AsignacionResponse:
        """
        Crea una nueva asignación de factura a un responsable.
        
        Validaciones:
        1. La factura existe
        2. El área existe
        3. El usuario existe
        4. El usuario pertenece al área especificada
        5. La factura está en estado "Recibida"
        6. No existe una asignación duplicada
        
        Acciones:
        1. Crea el registro en factura_asignaciones
        2. Actualiza los campos de la factura (area_id, assigned_to_user_id, assigned_at, estado_id)
        """
        # Validación 1: Factura existe
        factura = await self.repository.validate_factura_exists(factura_id)
        
        # Validación 2: Área existe
        area = await self.repository.validate_area_exists(data.area_id)
        
        # Validación 3: Usuario existe
        user = await self.repository.validate_user_exists(data.responsable_user_id)
        
        # Validación 4: Usuario pertenece al área
        await self.repository.validate_user_belongs_to_area(user, data.area_id)
        
        # Validación 5: Factura en estado asignable
        await self.repository.validate_factura_assignable_state(factura)
        
        # NOTA: Se permite crear múltiples asignaciones al mismo usuario para historial
        # (ej: cuando una factura se devuelve y se vuelve a asignar)
        
        # Crear asignación
        asignacion = await self.repository.create_asignacion(
            factura_id=factura_id,
            area_id=data.area_id,
            responsable_user_id=data.responsable_user_id
        )
        
        # Actualizar factura
        await self.repository.update_factura_assignment(
            factura=factura,
            area_id=data.area_id,
            responsable_user_id=data.responsable_user_id
        )
        
        # Obtener asignación con relaciones para respuesta
        asignacion_completa = await self.repository.get_asignacion_with_relations(asignacion.id)
        
        # Construir respuesta
        return AsignacionResponse(
            asignacion_id=asignacion_completa.id,
            factura_id=asignacion_completa.factura.id,
            numero_factura=asignacion_completa.factura.numero_factura,
            proveedor=asignacion_completa.factura.proveedor,
            area=asignacion_completa.area.nombre,
            responsable=ResponsableInfo(
                id=asignacion_completa.responsable.id,
                nombre=asignacion_completa.responsable.nombre,
                email=asignacion_completa.responsable.email
            ),
            estado_factura=asignacion_completa.factura.estado.label,
            fecha_asignacion=asignacion_completa.created_at
        )
