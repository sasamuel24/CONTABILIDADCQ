"""
Servicio de lógica de negocio para carpetas de tesorería.
"""
from uuid import UUID
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from .repository import CarpetaTesoreriaRepository
from .schemas import (
    CarpetaTesoreriaCreate,
    CarpetaTesoreriaUpdate,
    CarpetaTesoreriaResponse,
    CarpetaTesoreriaWithChildren,
    FacturaEnCarpetaTesoreria
)
from db.models import CarpetaTesoreria, Factura


class CarpetaTesoreriaService:
    """Servicio para gestionar carpetas de tesorería."""
    
    def __init__(self, db: AsyncSession):
        self.repository = CarpetaTesoreriaRepository(db)
    
    async def get_carpeta(self, carpeta_id: UUID) -> Optional[CarpetaTesoreriaResponse]:
        """Obtiene una carpeta por ID."""
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            return None
        return CarpetaTesoreriaResponse.model_validate(carpeta)
    
    async def get_all_carpetas(
        self,
        parent_id: Optional[UUID] = None
    ) -> List[CarpetaTesoreriaWithChildren]:
        """Obtiene todas las carpetas, opcionalmente filtradas por parent_id."""
        carpetas = await self.repository.get_all(parent_id=parent_id)
        
        # Convertir a diccionarios para evitar problemas de lazy loading
        result = []
        for carpeta in carpetas:
            carpeta_dict = await self._carpeta_to_dict(carpeta)
            result.append(CarpetaTesoreriaWithChildren.model_validate(carpeta_dict))
        
        return result
    
    async def _carpeta_to_dict(self, carpeta: CarpetaTesoreria) -> dict:
        """Convierte una carpeta a diccionario cargando todas sus relaciones."""
        children_list = []
        if carpeta.children:
            for child in carpeta.children:
                children_list.append(await self._carpeta_to_dict(child))
        
        facturas_list = []
        if carpeta.facturas:
            for factura in carpeta.facturas:
                facturas_list.append({
                    'id': factura.id,
                    'numero_factura': factura.numero_factura,
                    'proveedor': factura.proveedor,
                    'total': factura.total,
                    'carpeta_nombre': carpeta.nombre
                })
        
        return {
            'id': carpeta.id,
            'nombre': carpeta.nombre,
            'parent_id': carpeta.parent_id,
            'factura_id': carpeta.factura_id,
            'created_at': carpeta.created_at,
            'updated_at': carpeta.updated_at,
            'children': children_list,
            'facturas': facturas_list
        }
    
    async def create_carpeta(
        self,
        data: CarpetaTesoreriaCreate,
        created_by: Optional[UUID] = None
    ) -> CarpetaTesoreriaResponse:
        """Crea una nueva carpeta de tesorería."""
        # Validar que la carpeta padre existe si se especifica
        if data.parent_id:
            parent = await self.repository.get_by_id(data.parent_id)
            if not parent:
                raise ValueError(f"Carpeta padre con ID {data.parent_id} no encontrada")
        
        carpeta = await self.repository.create(
            nombre=data.nombre,
            parent_id=data.parent_id,
            created_by=created_by
        )
        return CarpetaTesoreriaResponse.model_validate(carpeta)
    
    async def update_carpeta(
        self,
        carpeta_id: UUID,
        data: CarpetaTesoreriaUpdate
    ) -> Optional[CarpetaTesoreriaResponse]:
        """Actualiza una carpeta existente."""
        # Validar que la carpeta padre existe si se especifica
        if data.parent_id:
            parent = await self.repository.get_by_id(data.parent_id)
            if not parent:
                raise ValueError(f"Carpeta padre con ID {data.parent_id} no encontrada")
        
        # Prevenir que una carpeta sea su propio padre
        if data.parent_id == carpeta_id:
            raise ValueError("Una carpeta no puede ser su propia carpeta padre")
        
        carpeta = await self.repository.update(
            carpeta_id=carpeta_id,
            nombre=data.nombre,
            parent_id=data.parent_id
        )
        
        if not carpeta:
            return None
        
        return CarpetaTesoreriaResponse.model_validate(carpeta)
    
    async def delete_carpeta(self, carpeta_id: UUID) -> bool:
        """Elimina una carpeta y sus hijos en cascada."""
        return await self.repository.delete(carpeta_id)
    
    async def get_facturas_by_carpeta(
        self,
        carpeta_id: UUID
    ) -> List[FacturaEnCarpetaTesoreria]:
        """Obtiene todas las facturas asignadas a una carpeta."""
        facturas = await self.repository.get_facturas_by_carpeta(carpeta_id)
        return [
            FacturaEnCarpetaTesoreria(
                id=f.id,
                numero_factura=f.numero_factura,
                proveedor=f.proveedor,
                total=float(f.total),
                carpeta_nombre=f.carpeta_tesoreria.nombre if f.carpeta_tesoreria else None
            )
            for f in facturas
        ]
    
    async def asignar_factura(
        self,
        factura_id: UUID,
        carpeta_id: Optional[UUID]
    ) -> Optional[dict]:
        """Asigna o desasigna una factura a una carpeta de tesorería."""
        # Validar que la carpeta existe si se especifica
        if carpeta_id:
            carpeta = await self.repository.get_by_id(carpeta_id)
            if not carpeta:
                raise ValueError(f"Carpeta con ID {carpeta_id} no encontrada")
        
        factura = await self.repository.asignar_factura_a_carpeta(
            factura_id=factura_id,
            carpeta_id=carpeta_id
        )
        
        if not factura:
            return None
        
        return {
            "factura_id": factura.id,
            "carpeta_tesoreria_id": factura.carpeta_tesoreria_id,
            "mensaje": "Factura asignada exitosamente" if carpeta_id else "Factura desasignada exitosamente"
        }
    
    async def search_carpetas(self, query: str) -> List[CarpetaTesoreriaResponse]:
        """Busca carpetas por nombre."""
        carpetas = await self.repository.search(query)
        return [
            CarpetaTesoreriaResponse.model_validate(c)
            for c in carpetas
        ]
