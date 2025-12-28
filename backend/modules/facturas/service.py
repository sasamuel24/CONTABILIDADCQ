"""
Capa de servicio para la lógica de negocio de facturas.
"""
from modules.facturas.repository import FacturaRepository
from modules.facturas.schemas import (
    FacturaCreate,
    FacturaUpdate,
    FacturaResponse,
    FacturasPaginatedResponse,
    FacturaListItem,
    EstadoUpdateResponse,
    InventariosPatchIn,
    InventariosOut,
    InventarioCodigoOut
)
from typing import List, Optional, Set, Dict
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession


class FacturaService:
    """Servicio que contiene la lógica de negocio de facturas."""
    
    def __init__(self, repository: FacturaRepository, db: AsyncSession = None):
        self.repository = repository
        self.db = db
    
    async def _validate_centro_operacion(
        self, 
        centro_costo_id: Optional[UUID],
        centro_operacion_id: Optional[UUID]
    ):
        """Valida que el centro de operación pertenezca al centro de costo."""
        if centro_operacion_id and not centro_costo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede asignar un Centro de Operación sin un Centro de Costo"
            )
        
        if centro_operacion_id and centro_costo_id and self.db:
            from db.models import CentroOperacion
            from sqlalchemy import select
            
            result = await self.db.execute(
                select(CentroOperacion).where(CentroOperacion.id == centro_operacion_id)
            )
            centro_op = result.scalar_one_or_none()
            
            if not centro_op:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Centro de Operación con ID {centro_operacion_id} no encontrado"
                )
            
            if centro_op.centro_costo_id != centro_costo_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El Centro de Operación seleccionado no pertenece al Centro de Costo especificado"
                )
    
    async def list_facturas(
        self,
        skip: int = 0,
        limit: int = 100,
        area_id: Optional[UUID] = None
    ) -> FacturasPaginatedResponse:
        """Lista todas las facturas con paginación y filtros."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}, area_id={area_id}")
        facturas, total = await self.repository.get_all(skip=skip, limit=limit, area_id=area_id)
        
        items = []
        for f in facturas:
            items.append(FacturaListItem(
                id=f.id,
                proveedor=f.proveedor,
                numero_factura=f.numero_factura,
                fecha_emision=f.fecha_emision,
                area=f.area.nombre if f.area else "Sin área",
                total=float(f.total),
                estado=f.estado.label if f.estado else "Sin estado",
                centro_costo=f.centro_costo.nombre if f.centro_costo else None,
                centro_operacion=f.centro_operacion.nombre if f.centro_operacion else None
            ))
        
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return FacturasPaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=limit
        )
    
    async def get_factura(self, factura_id: UUID) -> FacturaResponse:
        """Obtiene una factura por ID."""
        logger.info(f"Obteniendo factura con ID: {factura_id}")
        factura = await self.repository.get_by_id(factura_id)
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        return FacturaResponse(
            id=factura.id,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            area_id=factura.area_id,
            area=factura.area.nombre if factura.area else "Sin área",
            total=float(factura.total),
            estado_id=factura.estado_id,
            estado=factura.estado.label if factura.estado else "Sin estado",
            assigned_to_user_id=factura.assigned_to_user_id,
            assigned_at=factura.assigned_at,
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            centro_costo=factura.centro_costo.nombre if factura.centro_costo else None,
            centro_operacion=factura.centro_operacion.nombre if factura.centro_operacion else None,
            created_at=factura.created_at,
            updated_at=factura.updated_at
        )
    
    async def get_factura_by_numero(self, numero_factura: str) -> FacturaResponse:
        """Obtiene una factura por número."""
        logger.info(f"Obteniendo factura con número: {numero_factura}")
        factura = await self.repository.get_by_numero(numero_factura)
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con número {numero_factura} no encontrada"
            )
        
        return await self.get_factura(factura.id)
    
    async def create_factura(self, factura_data: FacturaCreate) -> FacturaResponse:
        """Crea una nueva factura."""
        logger.info(f"Creando nueva factura: {factura_data.numero_factura}")
        
        # Validar relación CC/CO
        await self._validate_centro_operacion(
            factura_data.centro_costo_id,
            factura_data.centro_operacion_id
        )
        
        factura = await self.repository.create(factura_data.model_dump())
        return await self.get_factura(factura.id)
    
    async def update_estado(
        self,
        factura_id: UUID,
        estado_id: int
    ) -> EstadoUpdateResponse:
        """Actualiza el estado de una factura."""
        logger.info(f"Actualizando estado de factura ID: {factura_id}")
        
        factura = await self.repository.update_estado(factura_id, estado_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        return EstadoUpdateResponse(
            id=factura.id,
            estado=factura.estado.label if factura.estado else "Sin estado",
            updated_at=factura.updated_at
        )
    
    async def update_factura(
        self,
        factura_id: UUID,
        factura_data: FacturaUpdate
    ) -> FacturaResponse:
        """Actualiza una factura."""
        logger.info(f"Actualizando factura ID: {factura_id}")
        
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Obtener valores actuales o nuevos
        centro_costo_id = factura_data.centro_costo_id if factura_data.centro_costo_id is not None else factura.centro_costo_id
        centro_operacion_id = factura_data.centro_operacion_id if factura_data.centro_operacion_id is not None else factura.centro_operacion_id
        
        # Validar relación CC/CO
        await self._validate_centro_operacion(centro_costo_id, centro_operacion_id)
        
        factura = await self.repository.update(factura_id, factura_data.model_dump(exclude_unset=True))
        return await self.get_factura(factura.id)
    
    async def update_inventarios(
        self,
        factura_id: UUID,
        inventarios_data: InventariosPatchIn
    ) -> InventariosOut:
        """
        Actualiza los inventarios de una factura.
        
        Lógica de negocio:
        - Si requiere_entrada_inventarios = false:
          - destino_inventarios se setea a NULL
          - Se eliminan todos los códigos existentes
        - Si requiere_entrada_inventarios = true:
          - destino_inventarios es obligatorio
          - codigos es obligatorio y no puede estar vacío
          - Se validan los códigos según el destino (TIENDA o ALMACEN)
          - Se hace UPSERT: actualiza existentes, crea nuevos, elimina no presentes
        """
        logger.info(f"Actualizando inventarios de factura ID: {factura_id}")
        
        # Verificar que la factura existe
        from sqlalchemy import select
        from db.models import Factura, FacturaInventarioCodigo
        
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Caso 1: No requiere entrada de inventarios
        if not inventarios_data.requiere_entrada_inventarios:
            logger.info(f"Factura {factura_id} no requiere inventarios - limpiando datos")
            
            # Actualizar factura
            factura.requiere_entrada_inventarios = False
            factura.destino_inventarios = None
            
            # Eliminar todos los códigos existentes
            await self.db.execute(
                select(FacturaInventarioCodigo)
                .where(FacturaInventarioCodigo.factura_id == factura_id)
            )
            codigos_existentes = (await self.db.execute(
                select(FacturaInventarioCodigo)
                .where(FacturaInventarioCodigo.factura_id == factura_id)
            )).scalars().all()
            
            for codigo in codigos_existentes:
                await self.db.delete(codigo)
            
            await self.db.commit()
            await self.db.refresh(factura)
            
            return InventariosOut(
                factura_id=factura.id,
                requiere_entrada_inventarios=False,
                destino_inventarios=None,
                codigos=[]
            )
        
        # Caso 2: Requiere entrada de inventarios
        logger.info(f"Factura {factura_id} requiere inventarios - validando datos")
        
        # Validación: destino_inventarios es obligatorio
        if not inventarios_data.destino_inventarios:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "error": "destino_inventarios es obligatorio cuando requiere_entrada_inventarios=true"
                }
            )
        
        # Validación: codigos es obligatorio y no vacío
        if not inventarios_data.codigos or len(inventarios_data.codigos) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "error": "codigos es obligatorio y no puede estar vacío cuando requiere_entrada_inventarios=true"
                }
            )
        
        # Definir códigos requeridos según destino
        CODIGOS_REQUERIDOS: Dict[str, Set[str]] = {
            "TIENDA": {"OCT", "ECT", "FPC"},
            "ALMACEN": {"OCC", "EDO", "FPC"}
        }
        
        required_codes = CODIGOS_REQUERIDOS[inventarios_data.destino_inventarios]
        payload_codes = {c.codigo.upper() for c in inventarios_data.codigos}
        
        # Validar códigos faltantes
        missing_codes = required_codes - payload_codes
        if missing_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "missing_codes": list(missing_codes),
                    "error": f"Faltan códigos requeridos para {inventarios_data.destino_inventarios}: {missing_codes}"
                }
            )
        
        # Validar códigos extras
        extra_codes = payload_codes - required_codes
        if extra_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "extra_codes": list(extra_codes),
                    "error": f"Códigos no permitidos para {inventarios_data.destino_inventarios}: {extra_codes}"
                }
            )
        
        # Validar valores (ya validado en el schema, pero doble check)
        invalid_values = []
        for codigo_in in inventarios_data.codigos:
            if not codigo_in.valor.strip():
                invalid_values.append({
                    "codigo": codigo_in.codigo,
                    "reason": "empty"
                })
        
        if invalid_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "invalid_values": invalid_values
                }
            )
        
        # Actualizar factura
        factura.requiere_entrada_inventarios = True
        factura.destino_inventarios = inventarios_data.destino_inventarios
        
        # UPSERT lógico de códigos
        # 1. Obtener códigos existentes
        result_codigos = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
        )
        codigos_existentes = {c.codigo: c for c in result_codigos.scalars().all()}
        
        # 2. Procesar códigos del payload
        codigos_procesados = set()
        for codigo_in in inventarios_data.codigos:
            codigo_upper = codigo_in.codigo.upper()
            codigos_procesados.add(codigo_upper)
            
            if codigo_upper in codigos_existentes:
                # Actualizar existente
                codigos_existentes[codigo_upper].valor = codigo_in.valor
                logger.debug(f"Actualizando código {codigo_upper} para factura {factura_id}")
            else:
                # Crear nuevo
                nuevo_codigo = FacturaInventarioCodigo(
                    factura_id=factura_id,
                    codigo=codigo_upper,
                    valor=codigo_in.valor
                )
                self.db.add(nuevo_codigo)
                logger.debug(f"Creando código {codigo_upper} para factura {factura_id}")
        
        # 3. Eliminar códigos que no están en el payload (limpieza)
        for codigo_key, codigo_obj in codigos_existentes.items():
            if codigo_key not in codigos_procesados:
                await self.db.delete(codigo_obj)
                logger.debug(f"Eliminando código {codigo_key} para factura {factura_id}")
        
        # Commit
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener códigos actualizados para respuesta
        result_final = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
            .order_by(FacturaInventarioCodigo.codigo)
        )
        codigos_finales = result_final.scalars().all()
        
        return InventariosOut(
            factura_id=factura.id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            codigos=[
                InventarioCodigoOut(
                    codigo=c.codigo,
                    valor=c.valor,
                    created_at=c.created_at
                )
                for c in codigos_finales
            ]
        )
