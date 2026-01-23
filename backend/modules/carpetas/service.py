"""
Servicio para lógica de negocio de carpetas.
"""
from modules.carpetas.repository import CarpetaRepository
from modules.carpetas.schemas import (
    CarpetaResponse,
    CarpetaCreate,
    CarpetaUpdate,
    CarpetaWithChildren,
    CarpetaSimple
)
from typing import List, Optional
from uuid import UUID
from core.logging import logger
from fastapi import HTTPException, status


class CarpetaService:
    """Servicio que contiene la lógica de negocio de carpetas."""
    
    def __init__(self, repository: CarpetaRepository):
        self.repository = repository
    
    async def list_carpetas(self) -> List[CarpetaResponse]:
        """Lista todas las carpetas."""
        logger.info("Listando carpetas")
        carpetas = await self.repository.get_all()
        return [CarpetaResponse.model_validate(carpeta) for carpeta in carpetas]
    
    async def list_root_folders(self) -> List[CarpetaWithChildren]:
        """Lista las carpetas raíz con sus hijos."""
        logger.info("Listando carpetas raíz")
        carpetas = await self.repository.get_root_folders()
        
        # Construir response manualmente para agregar carpeta_nombre a cada factura
        result = []
        for carpeta in carpetas:
            carpeta_dict = self._build_carpeta_dict(carpeta)
            result.append(CarpetaWithChildren(**carpeta_dict))
        
        return result
    
    def _build_carpeta_dict(self, carpeta) -> dict:
        """Construye un diccionario de carpeta con facturas incluyendo carpeta_nombre."""
        from modules.carpetas.schemas import FacturaEnCarpeta
        
        # Construir facturas con carpeta_nombre
        facturas_out = [
            FacturaEnCarpeta(
                id=f.id,
                numero_factura=f.numero_factura,
                proveedor=f.proveedor,
                total=float(f.total),
                carpeta_nombre=carpeta.nombre
            )
            for f in carpeta.facturas
        ]
        
        # Construir hijos recursivamente
        children_out = [
            self._build_carpeta_dict(child)
            for child in carpeta.children
        ]
        
        return {
            "id": carpeta.id,
            "nombre": carpeta.nombre,
            "parent_id": carpeta.parent_id,
            "factura_id": carpeta.factura_id,
            "created_at": carpeta.created_at,
            "updated_at": carpeta.updated_at,
            "facturas": facturas_out,
            "children": children_out
        }
    
    async def get_carpeta(self, carpeta_id: UUID) -> CarpetaResponse:
        """Obtiene una carpeta por su ID."""
        logger.info(f"Obteniendo carpeta: {carpeta_id}")
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Carpeta con ID {carpeta_id} no encontrada"
            )
        return CarpetaResponse.model_validate(carpeta)
    
    async def get_carpeta_with_children(self, carpeta_id: UUID) -> CarpetaWithChildren:
        """Obtiene una carpeta con sus hijos por su ID."""
        logger.info(f"Obteniendo carpeta con hijos: {carpeta_id}")
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Carpeta con ID {carpeta_id} no encontrada"
            )
        return CarpetaWithChildren.model_validate(carpeta)
    
    async def get_carpetas_by_parent(self, parent_id: UUID) -> List[CarpetaResponse]:
        """Obtiene las carpetas hijas de una carpeta padre."""
        logger.info(f"Obteniendo carpetas hijas de: {parent_id}")
        carpetas = await self.repository.get_by_parent_id(parent_id)
        return [CarpetaResponse.model_validate(carpeta) for carpeta in carpetas]
    
    async def get_carpetas_by_factura(self, factura_id: UUID) -> List[CarpetaResponse]:
        """Obtiene las carpetas asociadas a una factura."""
        logger.info(f"Obteniendo carpetas de factura: {factura_id}")
        carpetas = await self.repository.get_by_factura_id(factura_id)
        return [CarpetaResponse.model_validate(carpeta) for carpeta in carpetas]
    
    async def create_carpeta(self, carpeta_data: CarpetaCreate) -> CarpetaResponse:
        """Crea una nueva carpeta."""
        logger.info(f"Creando carpeta: {carpeta_data.nombre}")
        
        try:
            # Validar que el parent_id existe si se proporciona
            if carpeta_data.parent_id:
                parent = await self.repository.get_by_id(carpeta_data.parent_id)
                if not parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Carpeta padre con ID {carpeta_data.parent_id} no encontrada"
                    )
            
            carpeta = await self.repository.create(carpeta_data.model_dump())
            logger.info(f"Carpeta creada exitosamente: {carpeta.id}")
            return CarpetaResponse.model_validate(carpeta)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error al crear carpeta: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear carpeta: {str(e)}"
            )
    
    async def update_carpeta(
        self,
        carpeta_id: UUID,
        carpeta_data: CarpetaUpdate
    ) -> CarpetaResponse:
        """Actualiza una carpeta existente."""
        logger.info(f"Actualizando carpeta: {carpeta_id}")
        
        try:
            # Validar que la carpeta existe
            carpeta = await self.repository.get_by_id(carpeta_id)
            if not carpeta:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Carpeta con ID {carpeta_id} no encontrada"
                )
            
            # Validar que el nuevo parent_id existe si se proporciona
            if carpeta_data.parent_id:
                # Evitar ciclos: no permitir que una carpeta sea su propio padre
                if carpeta_data.parent_id == carpeta_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Una carpeta no puede ser su propio padre"
                    )
                
                parent = await self.repository.get_by_id(carpeta_data.parent_id)
                if not parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Carpeta padre con ID {carpeta_data.parent_id} no encontrada"
                    )
            
            # Actualizar solo los campos proporcionados
            update_data = carpeta_data.model_dump(exclude_unset=True)
            carpeta = await self.repository.update(carpeta_id, update_data)
            logger.info(f"Carpeta actualizada exitosamente: {carpeta_id}")
            return CarpetaResponse.model_validate(carpeta)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error al actualizar carpeta: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al actualizar carpeta: {str(e)}"
            )
    
    async def delete_carpeta(self, carpeta_id: UUID) -> None:
        """Elimina una carpeta por su ID."""
        logger.info(f"Eliminando carpeta: {carpeta_id}")
        
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Carpeta con ID {carpeta_id} no encontrada"
            )
        
        try:
            await self.repository.delete(carpeta_id)
            logger.info(f"Carpeta eliminada exitosamente: {carpeta_id}")
        except Exception as e:
            logger.error(f"Error al eliminar carpeta: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al eliminar carpeta: {str(e)}"
            )
