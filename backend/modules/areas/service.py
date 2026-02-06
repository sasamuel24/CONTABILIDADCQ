"""
Servicio para lógica de negocio de áreas.
"""
from modules.areas.repository import AreaRepository
from modules.areas.schemas import AreaResponse, AreaCreate, AreaUpdate
from typing import List
from uuid import UUID
from core.logging import logger
from fastapi import HTTPException, status


class AreaService:
    """Servicio que contiene la lógica de negocio de áreas."""
    
    def __init__(self, repository: AreaRepository):
        self.repository = repository
    
    async def list_areas(self) -> List[AreaResponse]:
        """Lista todas las áreas."""
        logger.info("Listando áreas")
        areas = await self.repository.get_all()
        return [AreaResponse.model_validate(area) for area in areas]
    
    async def create_area(self, area_data: AreaCreate) -> AreaResponse:
        """Crea una nueva área."""
        logger.info(f"Creando área: {area_data.nombre}")
        
        try:
            # Si no se proporciona código, generarlo desde el nombre
            data = area_data.model_dump()
            if not data.get('code'):
                # Generar código: convertir a mayúsculas, reemplazar espacios por guiones bajos
                code = area_data.nombre.upper().replace(' ', '_').replace('-', '_')
                # Remover caracteres especiales
                code = ''.join(c for c in code if c.isalnum() or c == '_')
                data['code'] = code
                logger.info(f"Código generado automáticamente: {code}")
            
            area = await self.repository.create(data)
            logger.info(f"Área creada exitosamente: {area.id}")
            return AreaResponse.model_validate(area)
        except Exception as e:
            logger.error(f"Error al crear área: {str(e)}")
            if "duplicate key value" in str(e).lower() or "unicidad" in str(e).lower():
                field = "código" if "code" in str(e).lower() else "nombre"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El {field} del área ya existe"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear área: {str(e)}"
            )
    
    async def delete_area(self, area_id: UUID) -> None:
        """Elimina un área por su ID."""
        logger.info(f"Eliminando área con ID: {area_id}")
        
        try:
            deleted = await self.repository.delete(area_id)
            if not deleted:
                logger.warning(f"Área con ID {area_id} no encontrada")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Área con ID {area_id} no encontrada"
                )
            logger.info(f"Área con ID {area_id} eliminada exitosamente")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error al eliminar área: {str(e)}")
            error_msg = str(e).lower()
            if any(keyword in error_msg for keyword in [
                "foreign key", "violates", "integrityerror", 
                "notnullviolationerror", "facturas"
            ]):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No se puede eliminar el área porque tiene facturas u otros registros asociados. "
                           "Debe reasignar o eliminar estos registros primero."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al eliminar área: {str(e)}"
            )

    async def update_area(self, area_id: UUID, area_data: AreaUpdate) -> AreaResponse:
        """Actualiza un área existente con los campos provistos."""
        logger.info(f"Actualizando área {area_id} con {area_data}")

        existing = await self.repository.get_by_id(area_id)
        if not existing:
            logger.warning(f"Área con ID {area_id} no encontrada para actualizar")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Área con ID {area_id} no encontrada"
            )

        data = area_data.model_dump(exclude_none=True)
        if not data:
            # No hay cambios; retornar la entidad actual
            return AreaResponse.model_validate(existing)

        try:
            area = await self.repository.update(area_id, data)
            if not area:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Área con ID {area_id} no encontrada"
                )
            logger.info(f"Área actualizada exitosamente: {area.id}")
            return AreaResponse.model_validate(area)
        except Exception as e:
            logger.error(f"Error al actualizar área: {str(e)}")
            if "duplicate key value" in str(e).lower() or "unicidad" in str(e).lower():
                field = "código" if "code" in str(e).lower() else "nombre"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El {field} del área ya existe"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al actualizar área: {str(e)}"
            )
