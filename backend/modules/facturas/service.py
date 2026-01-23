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
    InventarioCodigoOut,
    AnticipoUpdateIn,
    AnticipoOut,
    SubmitResponsableOut,
    SubmitErrorDetail,
    CentrosPatchIn,
    CentrosOut,
    AsignarCarpetaResponse
)
from typing import List, Optional, Set, Dict
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from db.models import File


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
        area_id: Optional[UUID] = None,
        estado: Optional[str] = None
    ) -> FacturasPaginatedResponse:
        """Lista todas las facturas con paginación y filtros."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}, area_id={area_id}, estado={estado}")
        facturas, total = await self.repository.get_all(skip=skip, limit=limit, area_id=area_id, estado=estado)
        
        items = []
        for f in facturas:
            # Mapear files con uploaded_at desde created_at
            from modules.files.schemas import FileMiniOut
            files_out = [
                FileMiniOut(
                    id=file.id,
                    doc_type=file.doc_type,
                    filename=file.filename,
                    content_type=file.content_type,
                    uploaded_at=file.created_at
                )
                for file in f.files
            ]
            
            # Mapear códigos de inventario
            from modules.facturas.schemas import InventarioCodigoOut, CarpetaEnFactura
            inventarios_codigos_out = [
                InventarioCodigoOut(
                    codigo=codigo.codigo,
                    valor=codigo.valor,
                    created_at=codigo.created_at
                )
                for codigo in f.inventario_codigos
            ]
            
            # Mapear carpeta si existe
            carpeta_out = None
            if f.carpeta:
                carpeta_out = CarpetaEnFactura(
                    id=f.carpeta.id,
                    nombre=f.carpeta.nombre,
                    parent_id=f.carpeta.parent_id
                )
            
            items.append(FacturaListItem(
                id=f.id,
                proveedor=f.proveedor,
                numero_factura=f.numero_factura,
                fecha_emision=f.fecha_emision,
                area=f.area.nombre if f.area else "Sin área",
                area_origen_id=f.area_origen_id,
                total=float(f.total),
                estado=f.estado.label if f.estado else "Sin estado",
                centro_costo=f.centro_costo.nombre if f.centro_costo else None,
                centro_operacion=f.centro_operacion.nombre if f.centro_operacion else None,
                centro_costo_id=f.centro_costo_id,
                centro_operacion_id=f.centro_operacion_id,
                requiere_entrada_inventarios=f.requiere_entrada_inventarios,
                destino_inventarios=f.destino_inventarios,
                presenta_novedad=f.presenta_novedad,
                inventarios_codigos=inventarios_codigos_out,
                tiene_anticipo=f.tiene_anticipo,
                porcentaje_anticipo=float(f.porcentaje_anticipo) if f.porcentaje_anticipo is not None else None,
                intervalo_entrega_contabilidad=f.intervalo_entrega_contabilidad,
                es_gasto_adm=f.es_gasto_adm,
                motivo_devolucion=f.motivo_devolucion,
                files=files_out,
                carpeta_id=f.carpeta_id,
                carpeta=carpeta_out
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
            updated_at=factura.updated_at,
            motivo_devolucion=factura.motivo_devolucion
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
    
    async def asignar_carpeta(
        self,
        factura_id: UUID,
        carpeta_id: UUID
    ) -> AsignarCarpetaResponse:
        """Asigna una factura a una carpeta."""
        logger.info(f"Asignando factura {factura_id} a carpeta {carpeta_id}")
        
        # Verificar que la factura existe
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Verificar que la carpeta existe
        if self.db:
            from db.models import Carpeta
            from sqlalchemy import select
            
            result = await self.db.execute(
                select(Carpeta).where(Carpeta.id == carpeta_id)
            )
            carpeta = result.scalar_one_or_none()
            
            if not carpeta:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Carpeta con ID {carpeta_id} no encontrada"
                )
        
        # Actualizar carpeta_id en la factura
        factura_actualizada = await self.repository.update(
            factura_id,
            {"carpeta_id": carpeta_id}
        )
        
        if not factura_actualizada:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al asignar carpeta a factura"
            )
        
        return AsignarCarpetaResponse(
            id=factura_actualizada.id,
            numero_factura=factura_actualizada.numero_factura,
            carpeta_id=carpeta_id,
            carpeta_nombre=carpeta.nombre if carpeta else "N/A",
            updated_at=factura_actualizada.updated_at
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
        
        # Lógica: Si se asigna un área nueva, cambiar estado a "Asignada" (estado_id = 2)
        update_data = factura_data.model_dump(exclude_unset=True)
        if factura_data.area_id is not None and factura_data.area_id != factura.area_id:
            logger.info(f"Área cambiada de {factura.area_id} a {factura_data.area_id}, actualizando estado a Asignada")
            update_data['estado_id'] = 2  # Estado: Asignada
            
            # IMPORTANTE: Si area_origen_id es NULL, establecerlo la primera vez
            # Esto guarda el área original asignada por Facturación y nunca cambia
            if factura.area_origen_id is None:
                update_data['area_origen_id'] = factura_data.area_id
                logger.info(f"Estableciendo area_origen_id: {factura_data.area_id}")
        
        factura = await self.repository.update(factura_id, update_data)
        return await self.get_factura(factura.id)
    
    async def get_inventarios(
        self,
        factura_id: UUID
    ) -> InventariosOut:
        """
        Obtiene los inventarios de una factura.
        """
        logger.info(f"Obteniendo inventarios de factura ID: {factura_id}")
        
        from sqlalchemy import select
        from db.models import Factura, FacturaInventarioCodigo
        
        # Verificar que la factura existe
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Obtener códigos de inventario
        result_codigos = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
            .order_by(FacturaInventarioCodigo.codigo)
        )
        codigos = result_codigos.scalars().all()
        
        # Convertir a esquema de salida
        from modules.facturas.schemas import InventarioCodigoOut
        codigos_out = [
            InventarioCodigoOut(
                codigo=c.codigo,
                valor=c.valor,
                created_at=c.created_at
            )
            for c in codigos
        ]
        
        return InventariosOut(
            factura_id=factura.id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            codigos=codigos_out
        )
    
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
            
            # Validación: Si no requiere inventarios, NO puede venir presenta_novedad=true ni código NP
            if inventarios_data.presenta_novedad is True:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Inventarios inválido",
                        "error": "presenta_novedad no puede ser true cuando requiere_entrada_inventarios=false"
                    }
                )
            
            if inventarios_data.codigos:
                payload_codes = {c.codigo.upper() for c in inventarios_data.codigos}
                if 'NP' in payload_codes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "message": "Inventarios inválido",
                            "error": "No puede incluir código NP cuando requiere_entrada_inventarios=false"
                        }
                    )
            
            # Actualizar factura
            factura.requiere_entrada_inventarios = False
            factura.destino_inventarios = None
            factura.presenta_novedad = False
            
            # Eliminar todos los códigos existentes
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
        
        # Validación: presenta_novedad es obligatorio
        if inventarios_data.presenta_novedad is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "error": "presenta_novedad es obligatorio cuando requiere_entrada_inventarios=true"
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
        
        # Definir códigos base requeridos según destino
        CODIGOS_BASE: Dict[str, Set[str]] = {
            "TIENDA": {"OCT", "ECT", "FPC"},
            "ALMACEN": {"OCC", "EDO", "FPC"}
        }
        
        base_codes = CODIGOS_BASE[inventarios_data.destino_inventarios]
        
        # Si presenta_novedad=true, agregar NP a los códigos requeridos
        if inventarios_data.presenta_novedad:
            required_codes = base_codes | {"NP"}
        else:
            required_codes = base_codes
        
        payload_codes = {c.codigo.upper() for c in inventarios_data.codigos}
        
        # Validar: Si presenta_novedad=false, NP NO puede venir
        if not inventarios_data.presenta_novedad and 'NP' in payload_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "extra_codes": ["NP"],
                    "error": "NP no puede incluirse cuando presenta_novedad=false"
                }
            )
        
        # Validar códigos faltantes
        missing_codes = required_codes - payload_codes
        if missing_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "missing_codes": sorted(list(missing_codes)),
                    "error": f"Faltan códigos requeridos: {sorted(list(missing_codes))}"
                }
            )
        
        # Validar códigos extras (no permitidos)
        extra_codes = payload_codes - required_codes
        if extra_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Inventarios inválido",
                    "extra_codes": sorted(list(extra_codes)),
                    "error": f"Códigos no permitidos: {sorted(list(extra_codes))}"
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
        factura.presenta_novedad = inventarios_data.presenta_novedad
        
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
    
    async def get_anticipo(
        self,
        factura_id: UUID
    ) -> AnticipoOut:
        """
        Obtiene los campos de anticipo de una factura.
        """
        logger.info(f"Obteniendo anticipo de factura ID: {factura_id}")
        
        # Verificar que la factura existe
        from sqlalchemy import select
        from db.models import Factura
        
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        return AnticipoOut(
            factura_id=factura.id,
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=float(factura.porcentaje_anticipo) if factura.porcentaje_anticipo is not None else None,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad
        )
    
    async def update_anticipo(
        self,
        factura_id: UUID,
        anticipo_data: AnticipoUpdateIn
    ) -> AnticipoOut:
        """
        Actualiza los campos de anticipo de una factura.
        
        Validaciones (constraints):
        1. check_anticipo_porcentaje_required:
           tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
           - Si tiene_anticipo=true  → porcentaje_anticipo NO puede ser null
           - Si tiene_anticipo=false → porcentaje_anticipo DEBE ser null
        
        2. check_porcentaje_anticipo_range:
           porcentaje_anticipo IS NULL OR (0 <= porcentaje_anticipo <= 100)
           - Si porcentaje_anticipo no es null → debe estar entre 0 y 100
        
        3. intervalo_entrega_contabilidad:
           - Siempre obligatorio
           - Debe ser uno de: 1_SEMANA, 2_SEMANAS, 3_SEMANAS, 1_MES
        """
        logger.info(f"Actualizando anticipo de factura ID: {factura_id}")
        
        # Verificar que la factura existe
        from sqlalchemy import select
        from db.models import Factura
        
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Validaciones de negocio (los schemas ya validaron la estructura básica)
        errors = []
        
        # Validación 1: check_anticipo_porcentaje_required
        # tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
        tiene = anticipo_data.tiene_anticipo
        porcentaje = anticipo_data.porcentaje_anticipo
        
        if tiene and porcentaje is None:
            errors.append({
                "field": "porcentaje_anticipo",
                "code": "check_anticipo_porcentaje_required",
                "reason": "Si tiene_anticipo es true, porcentaje_anticipo no puede ser null"
            })
        
        if not tiene and porcentaje is not None:
            errors.append({
                "field": "porcentaje_anticipo",
                "code": "check_anticipo_porcentaje_required",
                "reason": "Si tiene_anticipo es false, porcentaje_anticipo debe ser null"
            })
        
        # Validación 2: check_porcentaje_anticipo_range
        # Ya validado por Pydantic (ge=0, le=100), pero doble check
        if porcentaje is not None and (porcentaje < 0 or porcentaje > 100):
            errors.append({
                "field": "porcentaje_anticipo",
                "code": "check_porcentaje_anticipo_range",
                "reason": f"porcentaje_anticipo debe estar entre 0 y 100, recibido: {porcentaje}"
            })
        
        # Si hay errores, retornar 400
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Anticipo inválido",
                    "errors": errors
                }
            )
        
        # Actualizar factura
        factura.tiene_anticipo = anticipo_data.tiene_anticipo
        factura.porcentaje_anticipo = anticipo_data.porcentaje_anticipo
        factura.intervalo_entrega_contabilidad = anticipo_data.intervalo_entrega_contabilidad.value
        
        # Commit
        await self.db.commit()
        await self.db.refresh(factura)
        
        logger.info(
            f"Anticipo actualizado para factura {factura_id}: "
            f"tiene_anticipo={factura.tiene_anticipo}, "
            f"porcentaje={factura.porcentaje_anticipo}, "
            f"intervalo={factura.intervalo_entrega_contabilidad}"
        )
        
        return AnticipoOut(
            factura_id=factura.id,
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=float(factura.porcentaje_anticipo) if factura.porcentaje_anticipo is not None else None,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad
        )
    
    async def submit_responsable(
        self,
        factura_id: UUID
    ) -> SubmitResponsableOut:
        """
        Endpoint de transición: Envía la factura desde Responsable a Contabilidad.
        
        Valida todos los requisitos antes de mover la factura:
        - Centro de Costo y Operación
        - Anticipo completo
        - Inventarios correctos (con presenta_novedad y NP)
        
        Si todo cumple, reasigna la factura a área CONTABILIDAD.
        """
        from sqlalchemy import select
        from db.models import Factura, FacturaInventarioCodigo, Area, Estado
        
        logger.info(f"Iniciando submit_responsable para factura {factura_id}")
        
        # Verificar que la factura existe
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Acumuladores de errores
        missing_fields = []
        missing_codes = []
        extra_codes = []
        missing_files = []
        
        # ========== VALIDACIÓN 1: Centro de Costo y Operación ==========
        if factura.centro_costo_id is None:
            missing_fields.append("centro_costo_id")
        if factura.centro_operacion_id is None:
            missing_fields.append("centro_operacion_id")
        
        # ========== VALIDACIÓN 2: Intervalo de entrega ==========
        if factura.intervalo_entrega_contabilidad is None:
            missing_fields.append("intervalo_entrega_contabilidad")
        
        # ========== VALIDACIÓN 3: Anticipo ==========
        # Constraint 1: tiene_anticipo = (porcentaje_anticipo IS NOT NULL)
        if factura.tiene_anticipo and factura.porcentaje_anticipo is None:
            missing_fields.append("porcentaje_anticipo")
        
        if not factura.tiene_anticipo and factura.porcentaje_anticipo is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "No se puede enviar a Contabilidad",
                    "error": "Inconsistencia en anticipo: tiene_anticipo=false pero porcentaje_anticipo tiene valor"
                }
            )
        
        # Constraint 2: porcentaje_anticipo IS NULL OR (0 <= porcentaje_anticipo <= 100)
        if factura.porcentaje_anticipo is not None:
            if factura.porcentaje_anticipo < 0 or factura.porcentaje_anticipo > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "No se puede enviar a Contabilidad",
                        "error": f"porcentaje_anticipo fuera de rango: {factura.porcentaje_anticipo}"
                    }
                )
        
        # ========== VALIDACIÓN 4: Inventarios ==========
        if not factura.requiere_entrada_inventarios:
            # Caso A: No requiere inventarios
            # - destino_inventarios debe ser NULL
            if factura.destino_inventarios is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "No se puede enviar a Contabilidad",
                        "error": "requiere_entrada_inventarios=false pero destino_inventarios tiene valor"
                    }
                )
            
            # - presenta_novedad debe ser false
            if factura.presenta_novedad:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "No se puede enviar a Contabilidad",
                        "error": "requiere_entrada_inventarios=false pero presenta_novedad=true"
                    }
                )
            
            # - NO debe existir código NP
            codigos_result = await self.db.execute(
                select(FacturaInventarioCodigo)
                .where(FacturaInventarioCodigo.factura_id == factura_id)
            )
            codigos = codigos_result.scalars().all()
            
            if any(c.codigo == 'NP' for c in codigos):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "No se puede enviar a Contabilidad",
                        "error": "requiere_entrada_inventarios=false pero existe código NP"
                    }
                )
        
        else:
            # Caso B: Requiere inventarios
            # - destino_inventarios obligatorio
            if factura.destino_inventarios is None:
                missing_fields.append("destino_inventarios")
            else:
                # Validar códigos según destino y presenta_novedad
                CODIGOS_BASE: Dict[str, Set[str]] = {
                    "TIENDA": {"OCT", "ECT", "FPC"},
                    "ALMACEN": {"OCC", "EDO", "FPC"}
                }
                
                base_codes = CODIGOS_BASE.get(factura.destino_inventarios, set())
                
                # Si presenta_novedad=true, agregar NP a requeridos
                if factura.presenta_novedad:
                    required_codes = base_codes | {"NP"}
                else:
                    required_codes = base_codes
                
                # Obtener códigos existentes
                codigos_result = await self.db.execute(
                    select(FacturaInventarioCodigo)
                    .where(FacturaInventarioCodigo.factura_id == factura_id)
                )
                codigos = codigos_result.scalars().all()
                existing_codes = {c.codigo for c in codigos}
                
                # Validar faltantes
                missing = required_codes - existing_codes
                if missing:
                    missing_codes.extend(sorted(list(missing)))
                
                # Validar extras
                extra = existing_codes - required_codes
                if extra:
                    extra_codes.extend(sorted(list(extra)))
                
                # Validar que NP no esté si presenta_novedad=false
                if not factura.presenta_novedad and 'NP' in existing_codes:
                    extra_codes.append('NP')
                
                # Validar valores no vacíos
                for codigo in codigos:
                    if not codigo.valor or not codigo.valor.strip():
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "message": "No se puede enviar a Contabilidad",
                                "error": f"Código {codigo.codigo} tiene valor vacío"
                            }
                        )
        
        # ========== VALIDACIÓN 5: Archivos (opcional según negocio) ==========
        # Comentado por ahora - descomentar si se requiere
        # if factura.requiere_entrada_inventarios:
        #     files_result = await self.db.execute(
        #         select(File).where(File.factura_id == factura_id)
        #     )
        #     files = files_result.scalars().all()
        #     file_types = {f.doc_type for f in files}
        #     
        #     if 'OC_OS' not in file_types:
        #         missing_files.append('OC_OS')
        #     if 'SOPORTE_ENTRADA_INVENTARIOS' not in file_types:
        #         missing_files.append('SOPORTE_ENTRADA_INVENTARIOS')
        # 
        # if factura.presenta_novedad:
        #     if 'NOTA_CREDITO' not in file_types:
        #         missing_files.append('NOTA_CREDITO')
        
        # ========== SI HAY ERRORES, RETORNAR 400 ==========
        if missing_fields or missing_codes or extra_codes or missing_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "No se puede enviar a Contabilidad",
                    "missing_fields": missing_fields,
                    "missing_codes": missing_codes,
                    "extra_codes": extra_codes,
                    "missing_files": missing_files
                }
            )
        
        # ========== VALIDACIÓN EXITOSA: REASIGNAR A CONTABILIDAD ==========
        
        # Buscar área CONTABILIDAD
        area_result = await self.db.execute(
            select(Area).where(Area.nombre.ilike("%contabilidad%"))
        )
        area_contabilidad = area_result.scalar_one_or_none()
        
        if not area_contabilidad:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Área CONTABILIDAD no encontrada en el sistema"
            )
        
        # Buscar estado (puede ser EN_CONTABILIDAD, PENDIENTE_CONTABILIDAD, etc.)
        # Estado tiene campos: code, label (no nombre)
        estado_result = await self.db.execute(
            select(Estado).where(
                (Estado.code.ilike("%contabilidad%")) |
                (Estado.label.ilike("%contabilidad%")) |
                (Estado.label.ilike("%pendiente%"))
            )
        )
        estado_contabilidad = estado_result.scalars().first()
        
        if not estado_contabilidad:
            # Fallback: buscar por ID si existe un catálogo fijo
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Estado para CONTABILIDAD no encontrado en el sistema"
            )
        
        # Guardar área anterior para el histórico (referencia)
        area_anterior_id = factura.area_id
        
        # Actualizar factura
        factura.area_id = area_contabilidad.id
        factura.estado_id = estado_contabilidad.id
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()
        
        # Limpiar motivo de devolución al reenviar
        factura.motivo_devolucion = None
        
        # Commit de cambios
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener códigos para respuesta
        codigos_result = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
        )
        codigos = codigos_result.scalars().all()
        
        # Obtener archivos para respuesta
        files_result = await self.db.execute(
            select(File)
            .where(File.factura_id == factura_id)
        )
        files = files_result.scalars().all()
        
        logger.info(
            f"Factura {factura_id} enviada a CONTABILIDAD exitosamente. "
            f"Área: {area_contabilidad.nombre}, Estado: {estado_contabilidad.label}"
        )
        
        # Construir respuesta
        return SubmitResponsableOut(
            factura_id=factura.id,
            area_id=area_contabilidad.id,
            area_actual=area_contabilidad.nombre,
            estado_id=estado_contabilidad.id,
            estado_actual=estado_contabilidad.label,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            total=float(factura.total),
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            presenta_novedad=factura.presenta_novedad,
            inventario_codigos=[
                InventarioCodigoOut(
                    codigo=c.codigo,
                    valor=c.valor,
                    created_at=c.created_at
                ) for c in codigos
            ],
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=float(factura.porcentaje_anticipo) if factura.porcentaje_anticipo else None,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad,
            files=[
                {
                    "id": str(f.id),
                    "filename": f.filename,
                    "doc_type": f.doc_type,
                    "content_type": f.content_type,
                    "size_bytes": f.size_bytes,
                    "uploaded_at": f.created_at.isoformat() if hasattr(f, 'created_at') and f.created_at else None
                } for f in files
            ]
        )
    
    async def submit_tesoreria(self, factura_id: UUID) -> SubmitResponsableOut:
        """
        Envía una factura desde CONTABILIDAD a TESORERIA.
        
        Validaciones:
        1. Factura debe existir
        2. Factura debe estar actualmente en área CONTABILIDAD
        3. Factura no debe estar ya en TESORERIA
        
        Acción:
        - Cambiar area_id a TESORERIA
        - Cambiar estado_id a 7
        - Limpiar assigned_to_user_id y actualizar assigned_at
        """
        from db.models import Area, Estado, FacturaInventarioCodigo
        from sqlalchemy import select
        
        CONTABILIDAD_AREA_ID = UUID("725f5e5a-49d3-4e44-800f-f5ff21e187ac")
        TESORERIA_AREA_ID = UUID("b067adcd-13ff-420f-9389-42bfaa78cf9f")
        TESORERIA_ESTADO_ID = 7
        
        logger.info(f"Iniciando submit_tesoreria para factura {factura_id}")
        
        # Validación 1: Factura existe
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            logger.warning(f"Factura {factura_id} no encontrada")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Validación 2: Factura debe estar en CONTABILIDAD
        if factura.area_id != CONTABILIDAD_AREA_ID:
            logger.warning(
                f"Factura {factura_id} no está en Contabilidad. "
                f"Área actual: {factura.area_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La factura no está en Contabilidad"
            )
        
        # Validación 3: No debe estar ya en Tesorería
        if factura.area_id == TESORERIA_AREA_ID:
            logger.warning(f"Factura {factura_id} ya está en Tesorería")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La factura ya fue enviada a Tesorería"
            )
        
        # Obtener área Tesorería
        area_result = await self.db.execute(
            select(Area).where(Area.id == TESORERIA_AREA_ID)
        )
        area_tesoreria = area_result.scalar_one_or_none()
        
        if not area_tesoreria:
            logger.error(f"Área Tesorería con ID {TESORERIA_AREA_ID} no encontrada")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Configuración de área Tesorería no encontrada"
            )
        
        # Obtener estado
        estado_result = await self.db.execute(
            select(Estado).where(Estado.id == TESORERIA_ESTADO_ID)
        )
        estado_tesoreria = estado_result.scalar_one_or_none()
        
        if not estado_tesoreria:
            logger.error(f"Estado con ID {TESORERIA_ESTADO_ID} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Configuración de estado no encontrada"
            )
        
        # Actualizar factura
        factura.area_id = TESORERIA_AREA_ID
        factura.estado_id = TESORERIA_ESTADO_ID
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()
        
        # Commit de cambios
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener códigos para respuesta
        codigos_result = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
        )
        codigos = codigos_result.scalars().all()
        
        # Obtener archivos para respuesta
        files_result = await self.db.execute(
            select(File)
            .where(File.factura_id == factura_id)
        )
        files = files_result.scalars().all()
        
        logger.info(
            f"Factura {factura_id} enviada a TESORERIA exitosamente. "
            f"Área: {area_tesoreria.nombre}, Estado: {estado_tesoreria.label}"
        )
        
        # Construir respuesta
        return SubmitResponsableOut(
            factura_id=factura.id,
            area_id=area_tesoreria.id,
            area_actual=area_tesoreria.nombre,
            estado_id=estado_tesoreria.id,
            estado_actual=estado_tesoreria.label,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            total=float(factura.total),
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            presenta_novedad=factura.presenta_novedad,
            inventario_codigos=[
                InventarioCodigoOut(
                    codigo=c.codigo,
                    valor=c.valor,
                    created_at=c.created_at
                ) for c in codigos
            ],
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=float(factura.porcentaje_anticipo) if factura.porcentaje_anticipo else None,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad,
            files=[
                {
                    "id": str(f.id),
                    "filename": f.filename,
                    "doc_type": f.doc_type,
                    "content_type": f.content_type,
                    "size_bytes": f.size_bytes,
                    "uploaded_at": f.created_at.isoformat() if hasattr(f, 'created_at') and f.created_at else None
                } for f in files
            ]
        )
    
    async def close_tesoreria(self, factura_id: UUID) -> SubmitResponsableOut:
        """
        Cierra una factura en TESORERIA cambiando su estado a finalizado.
        
        Validaciones:
        1. Factura debe existir
        2. Factura debe estar actualmente en área TESORERIA
        3. Deben existir los archivos requeridos: PEC, EC, PCE
        
        Acción:
        - Cambiar estado_id a 5 (estado final)
        """
        from db.models import Area, Estado, FacturaInventarioCodigo
        from sqlalchemy import select
        
        TESORERIA_AREA_ID = UUID("b067adcd-13ff-420f-9389-42bfaa78cf9f")
        ESTADO_FINALIZADO_ID = 5
        REQUIRED_DOC_TYPES = {"PEC", "EC", "PCE"}
        
        logger.info(f"Iniciando close_tesoreria para factura {factura_id}")
        
        # Validación 1: Factura existe
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            logger.warning(f"Factura {factura_id} no encontrada")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Validación 2: Factura debe estar en TESORERIA
        if factura.area_id != TESORERIA_AREA_ID:
            logger.warning(
                f"Factura {factura_id} no está en Tesorería. "
                f"Área actual: {factura.area_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La factura no está en Tesorería"
            )
        
        # Validación 3: Verificar archivos requeridos (PEC, EC, PCE)
        files_result = await self.db.execute(
            select(File.doc_type)
            .where(File.factura_id == factura_id)
            .where(File.doc_type.in_(REQUIRED_DOC_TYPES))
        )
        existing_doc_types = {row[0] for row in files_result.all()}
        
        missing_files = list(REQUIRED_DOC_TYPES - existing_doc_types)
        
        if missing_files:
            logger.warning(
                f"Factura {factura_id} no tiene todos los archivos requeridos. "
                f"Faltan: {missing_files}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "No se puede cerrar la factura en Tesorería",
                    "missing_files": sorted(missing_files)
                }
            )
        
        # Obtener área Tesorería
        area_result = await self.db.execute(
            select(Area).where(Area.id == TESORERIA_AREA_ID)
        )
        area_tesoreria = area_result.scalar_one_or_none()
        
        # Obtener estado finalizado
        estado_result = await self.db.execute(
            select(Estado).where(Estado.id == ESTADO_FINALIZADO_ID)
        )
        estado_finalizado = estado_result.scalar_one_or_none()
        
        if not estado_finalizado:
            logger.error(f"Estado con ID {ESTADO_FINALIZADO_ID} no encontrado")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Configuración de estado no encontrada"
            )
        
        # Actualizar factura
        factura.estado_id = ESTADO_FINALIZADO_ID
        
        # Commit de cambios
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener códigos para respuesta
        codigos_result = await self.db.execute(
            select(FacturaInventarioCodigo)
            .where(FacturaInventarioCodigo.factura_id == factura_id)
        )
        codigos = codigos_result.scalars().all()
        
        # Obtener todos los archivos para respuesta
        all_files_result = await self.db.execute(
            select(File)
            .where(File.factura_id == factura_id)
        )
        files = all_files_result.scalars().all()
        
        logger.info(
            f"Factura {factura_id} cerrada en TESORERIA exitosamente. "
            f"Estado: {estado_finalizado.label}"
        )
        
        # Construir respuesta
        return SubmitResponsableOut(
            factura_id=factura.id,
            area_id=area_tesoreria.id if area_tesoreria else TESORERIA_AREA_ID,
            area_actual=area_tesoreria.nombre if area_tesoreria else "Tesorería",
            estado_id=estado_finalizado.id,
            estado_actual=estado_finalizado.label,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            total=float(factura.total),
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            presenta_novedad=factura.presenta_novedad,
            inventario_codigos=[
                InventarioCodigoOut(
                    codigo=c.codigo,
                    valor=c.valor,
                    created_at=c.created_at
                ) for c in codigos
            ],
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=float(factura.porcentaje_anticipo) if factura.porcentaje_anticipo else None,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad,
            files=[
                {
                    "id": str(f.id),
                    "filename": f.filename,
                    "doc_type": f.doc_type,
                    "content_type": f.content_type,
                    "size_bytes": f.size_bytes,
                    "uploaded_at": f.created_at.isoformat() if hasattr(f, 'created_at') and f.created_at else None
                } for f in files
            ]
        )
    
    async def update_centros(
        self,
        factura_id: UUID,
        centros_data: "CentrosPatchIn"
    ) -> "CentrosOut":
        """
        Asigna Centro de Costo y Centro de Operación a una factura.
        
        Validaciones:
        - Factura existe
        - Centro de Costo existe
        - Centro de Operación existe
        - Centro de Operación pertenece al Centro de Costo
        """
        from sqlalchemy import select
        from db.models import Factura, CentroCosto, CentroOperacion
        
        logger.info(f"Asignando centros a factura {factura_id}")
        
        # Verificar que la factura existe
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Verificar que el Centro de Costo existe
        cc_result = await self.db.execute(
            select(CentroCosto).where(CentroCosto.id == centros_data.centro_costo_id)
        )
        centro_costo = cc_result.scalar_one_or_none()
        
        if not centro_costo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Centro de Costo con ID {centros_data.centro_costo_id} no encontrado"
            )
        
        # Verificar que el Centro de Operación existe
        co_result = await self.db.execute(
            select(CentroOperacion).where(CentroOperacion.id == centros_data.centro_operacion_id)
        )
        centro_operacion = co_result.scalar_one_or_none()
        
        if not centro_operacion:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Centro de Operación con ID {centros_data.centro_operacion_id} no encontrado"
            )
        
        # VALIDACIÓN CRÍTICA: El CO debe pertenecer al CC
        if centro_operacion.centro_costo_id != centros_data.centro_costo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Centro de operación no pertenece al centro de costo",
                    "centro_costo_id": str(centros_data.centro_costo_id),
                    "centro_operacion_id": str(centros_data.centro_operacion_id),
                    "centro_operacion_real_cc_id": str(centro_operacion.centro_costo_id)
                }
            )
        
        # Actualizar factura
        factura.centro_costo_id = centros_data.centro_costo_id
        factura.centro_operacion_id = centros_data.centro_operacion_id
        
        await self.db.commit()
        await self.db.refresh(factura)
        
        logger.info(
            f"Centros asignados exitosamente a factura {factura_id}: "
            f"CC={centro_costo.nombre}, CO={centro_operacion.nombre}"
        )
        
        return CentrosOut(
            factura_id=factura.id,
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id
        )

    async def devolver_a_responsable(
        self,
        factura_id: UUID,
        motivo: str
    ) -> dict:
        """
        Devuelve una factura de Contabilidad al Área Responsable original.
        Solo permitido si la factura está en estado de Contabilidad (estado_id = 3).
        Usa area_origen_id que nunca cambia durante el ciclo de vida de la factura.
        """
        from sqlalchemy import select
        from db.models import Factura, Estado, Area
        
        logger.info(f"Devolviendo factura {factura_id} a Responsable. Motivo: {motivo}")
        
        # Obtener factura
        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Validar que esté en estado Contabilidad (estado_id = 3)
        if factura.estado_id != 3:
            result_estado = await self.db.execute(
                select(Estado).where(Estado.id == factura.estado_id)
            )
            estado_actual = result_estado.scalar_one_or_none()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La factura debe estar en estado 'Contabilidad' para poder devolverla. Estado actual: {estado_actual.label if estado_actual else 'Desconocido'}"
            )
        
        # Validar que exista area_origen_id
        if not factura.area_origen_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La factura no tiene un área de origen asignada. No se puede devolver."
            )
        
        # Devolver a área origen (que nunca cambia)
        factura.area_id = factura.area_origen_id
        factura.estado_id = 2  # Estado "Asignada" (Responsable)
        factura.motivo_devolucion = motivo
        factura.assigned_to_user_id = None  # Limpiar asignación específica
        
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener nombre del estado actual
        result_estado = await self.db.execute(
            select(Estado).where(Estado.id == factura.estado_id)
        )
        estado = result_estado.scalar_one_or_none()
        
        # Obtener nombre del área
        result_area = await self.db.execute(
            select(Area).where(Area.id == factura.area_id)
        )
        area = result_area.scalar_one_or_none()
        
        logger.info(
            f"Factura {factura_id} devuelta exitosamente a {area.nombre if area else 'Área desconocida'}"
        )
        
        return {
            "factura_id": str(factura.id),
            "area_id": str(factura.area_id),
            "area_nombre": area.nombre if area else "Desconocido",
            "estado_actual": estado.label if estado else "Desconocido",
            "motivo_devolucion": factura.motivo_devolucion
        }
