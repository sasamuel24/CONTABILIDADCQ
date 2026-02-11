"""
Servicio de lógica de negocio para carpetas de tesorería.
"""
from uuid import UUID
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile, HTTPException, status

from .repository import CarpetaTesoreriaRepository
from .schemas import (
    CarpetaTesoreriaCreate,
    CarpetaTesoreriaUpdate,
    CarpetaTesoreriaResponse,
    CarpetaTesoreriaSimple,
    CarpetaTesoreriaWithChildren,
    FacturaEnCarpetaTesoreria
)
from db.models import CarpetaTesoreria, Factura
from core.s3_service import S3Service
from core.logging import logger


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
            'archivo_egreso_url': carpeta.archivo_egreso_url,
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
    
    async def upload_archivo_egreso(
        self,
        carpeta_id: UUID,
        file: UploadFile
    ) -> Optional[CarpetaTesoreriaSimple]:
        """Sube un archivo PDF de control de egresos a S3 y actualiza la carpeta."""
        # Validar que la carpeta existe
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            return None
        
        # Validar que es un PDF
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise ValueError("El archivo debe ser un PDF")
        
        if file.content_type != 'application/pdf':
            raise ValueError("El tipo de contenido debe ser application/pdf")
        
        # Subir a S3
        try:
            s3_service = S3Service()
            s3_key = f"carpetas-tesoreria/{carpeta_id}/archivo-egreso.pdf"
            
            # Leer el contenido del archivo
            file_content = await file.read()
            from io import BytesIO
            file_obj = BytesIO(file_content)
            
            # Subir a S3
            upload_result = s3_service.upload_fileobj(
                fileobj=file_obj,
                key=s3_key,
                content_type='application/pdf'
            )
            
            logger.info(f"Archivo subido a S3: {s3_key}")
            
            # Si hay un archivo anterior, eliminarlo
            if carpeta.archivo_egreso_url:
                try:
                    old_key = carpeta.archivo_egreso_url.split('/')[-3:]  # Extraer key de la URL
                    old_key = '/'.join(old_key)
                    s3_service.delete_file(old_key)
                except Exception as e:
                    logger.warning(f"No se pudo eliminar archivo anterior: {str(e)}")
            
            # Actualizar la URL en la base de datos
            carpeta = await self.repository.update(
                carpeta_id=carpeta_id,
                archivo_egreso_url=s3_key,
                update_archivo=True
            )
            
            if not carpeta:
                return None
            
            return CarpetaTesoreriaSimple.model_validate(carpeta)
            
        except Exception as e:
            logger.error(f"Error al subir archivo a S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al subir archivo: {str(e)}"
            )
    
    async def delete_archivo_egreso(
        self,
        carpeta_id: UUID
    ) -> Optional[CarpetaTesoreriaSimple]:
        """Elimina el archivo PDF de control de egresos de S3 y actualiza la carpeta."""
        # Validar que la carpeta existe
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            return None
        
        # Eliminar de S3 si existe
        if carpeta.archivo_egreso_url:
            try:
                s3_service = S3Service()
                s3_service.delete_file(carpeta.archivo_egreso_url)
                logger.info(f"Archivo eliminado de S3: {carpeta.archivo_egreso_url}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar archivo de S3: {str(e)}")
        
        # Actualizar la URL en la base de datos a NULL
        carpeta = await self.repository.update(
            carpeta_id=carpeta_id,
            archivo_egreso_url=None,
            update_archivo=True
        )
        
        if not carpeta:
            return None
        
        return CarpetaTesoreriaSimple.model_validate(carpeta)
    
    async def get_archivo_egreso_url(
        self,
        carpeta_id: UUID
    ) -> Optional[str]:
        """Obtiene la URL prefirmada para descargar el archivo PDF de control de egresos."""
        # Validar que la carpeta existe
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            raise ValueError("Carpeta no encontrada")
        
        if not carpeta.archivo_egreso_url:
            raise ValueError("La carpeta no tiene archivo PDF adjunto")
        
        # Generar URL prefirmada
        try:
            s3_service = S3Service()
            url = s3_service.presign_get_url(carpeta.archivo_egreso_url, expires_in=600)
            logger.info(f"URL prefirmada generada para carpeta {carpeta_id}")
            return url
        except Exception as e:
            logger.error(f"Error al generar URL prefirmada: {str(e)}")
            raise
    
    async def download_archivo_egreso(
        self,
        carpeta_id: UUID
    ) -> Optional[bytes]:
        """Descarga el contenido del archivo PDF de control de egresos desde S3."""
        # Validar que la carpeta existe
        carpeta = await self.repository.get_by_id(carpeta_id)
        if not carpeta:
            raise ValueError("Carpeta no encontrada")
        
        if not carpeta.archivo_egreso_url:
            raise ValueError("La carpeta no tiene archivo PDF adjunto")
        
        # Descargar desde S3
        try:
            s3_service = S3Service()
            file_content = s3_service.get_file_content(carpeta.archivo_egreso_url)
            logger.info(f"Archivo descargado para carpeta {carpeta_id}")
            return file_content
        except Exception as e:
            logger.error(f"Error al descargar archivo desde S3: {str(e)}")
            raise
