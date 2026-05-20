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
    AsignarCarpetaResponse,
    AsignarCarpetaTesoreriaResponse
)
from typing import List, Optional, Set, Dict
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy.exc import IntegrityError, DataError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from db.models import File


class FacturaService:
    """Servicio que contiene la lógica de negocio de facturas."""
    
    def __init__(self, repository: FacturaRepository, db: AsyncSession = None):
        self.repository = repository
        self.db = db
    
    async def list_facturas(
        self,
        skip: int = 0,
        limit: int = 100,
        area_id: Optional[UUID] = None,
        area_origen_id: Optional[UUID] = None,
        estado: Optional[str] = None
    ) -> FacturasPaginatedResponse:
        """Lista todas las facturas con paginación y filtros."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}, area_id={area_id}, area_origen_id={area_origen_id}, estado={estado}")
        facturas, total = await self.repository.get_all(skip=skip, limit=limit, area_id=area_id, area_origen_id=area_origen_id, estado=estado)
        
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
            
            # Mapear carpeta de tesorería si existe
            carpeta_tesoreria_out = None
            if f.carpeta_tesoreria:
                carpeta_tesoreria_out = CarpetaEnFactura(
                    id=f.carpeta_tesoreria.id,
                    nombre=f.carpeta_tesoreria.nombre,
                    parent_id=f.carpeta_tesoreria.parent_id
                )
            
            items.append(FacturaListItem(
                id=f.id,
                proveedor=f.proveedor,
                numero_factura=f.numero_factura,
                fecha_emision=f.fecha_emision,
                fecha_vencimiento=f.fecha_vencimiento,
                area=f.area.nombre if f.area else "Sin área",
                area_id=f.area_id,
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
                devuelta_por_nombre=f.devuelta_por_nombre,
                files=files_out,
                carpeta_id=f.carpeta_id,
                carpeta=carpeta_out,
                carpeta_tesoreria_id=f.carpeta_tesoreria_id,
                carpeta_tesoreria=carpeta_tesoreria_out,
                unidad_negocio_id=f.unidad_negocio_id,
                unidad_negocio=f.unidad_negocio.codigo if f.unidad_negocio else None,
                cuenta_auxiliar_id=f.cuenta_auxiliar_id,
                cuenta_auxiliar=f.cuenta_auxiliar.codigo if f.cuenta_auxiliar else None,
                fecha_envio_gerencia=f.fecha_envio_gerencia,
                fecha_aprobacion_email=f.fecha_aprobacion_email,
                aprobado_por_nombre=f.aprobado_por_nombre,
                aprobado_por_email=f.aprobado_por_email,
                fecha_envio_aprobacion_ops=f.fecha_envio_aprobacion_ops,
                fecha_aprobacion_ops=f.fecha_aprobacion_ops,
                aprobado_ops_nombre=f.aprobado_ops_nombre,
                aprobado_ops_email=f.aprobado_ops_email,
                fecha_envio_aprobacion_calidad=f.fecha_envio_aprobacion_calidad,
                fecha_aprobacion_calidad=f.fecha_aprobacion_calidad,
                aprobado_calidad_nombre=f.aprobado_calidad_nombre,
                aprobado_calidad_email=f.aprobado_calidad_email,
                nit_proveedor=f.nit_proveedor,
                pendiente_confirmacion=f.pendiente_confirmacion,
                ai_area_confianza=f.ai_area_confianza,
                ai_area_razonamiento=f.ai_area_razonamiento,
            ))
        
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return FacturasPaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=limit
        )
    
    async def delete_factura(self, factura_id: UUID) -> None:
        """Elimina una factura y sus registros relacionados."""
        logger.info(f"Eliminando factura con ID: {factura_id}")
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        await self.repository.delete(factura)

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
            motivo_devolucion=factura.motivo_devolucion,
            fecha_envio_gerencia=factura.fecha_envio_gerencia,
            fecha_aprobacion_email=factura.fecha_aprobacion_email,
            aprobado_por_nombre=factura.aprobado_por_nombre,
            aprobado_por_email=factura.aprobado_por_email,
            fecha_envio_aprobacion_ops=factura.fecha_envio_aprobacion_ops,
            fecha_aprobacion_ops=factura.fecha_aprobacion_ops,
            aprobado_ops_nombre=factura.aprobado_ops_nombre,
            aprobado_ops_email=factura.aprobado_ops_email,
            fecha_envio_aprobacion_calidad=factura.fecha_envio_aprobacion_calidad,
            fecha_aprobacion_calidad=factura.fecha_aprobacion_calidad,
            aprobado_calidad_nombre=factura.aprobado_calidad_nombre,
            aprobado_calidad_email=factura.aprobado_calidad_email,
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

        # Evitar duplicado: si ya existe una factura con el mismo numero_factura
        # devolver la existente en lugar de crear un segundo registro huérfano sin PDF.
        existing = await self.repository.get_by_numero(factura_data.numero_factura)
        if existing:
            logger.info(
                f"Factura {factura_data.numero_factura} ya existe (id={existing.id}), "
                "devolviendo registro existente en lugar de crear duplicado."
            )
            return await self.get_factura(existing.id)


        datos = factura_data.model_dump(exclude={"xml_content", "nit"})
        if factura_data.nit:
            datos["nit_proveedor"] = factura_data.nit
        factura = await self.repository.create(datos)

        # Si viene xml_content, ejecutar asignación automática de área por IA
        if factura_data.xml_content and self.db:
            await self._asignar_area_ia(factura, factura_data.xml_content)

        return await self.get_factura(factura.id)

    async def _asignar_area_ia(self, factura, xml_content: str) -> None:
        """Asigna área automáticamente usando el XML DIAN y Claude Haiku."""
        import json
        import asyncio
        from sqlalchemy import select
        from db.models import Area
        from core.config import settings
        from core.xml_parser import parse_xml_dian

        # Parsear XML para obtener datos ricos (ciudad, ítems, etc.)
        try:
            datos = parse_xml_dian(xml_content)
        except Exception:
            datos = None

        areas_result = await self.db.execute(select(Area))
        areas = areas_result.scalars().all()

        area_asignada = None
        confianza = "nula"
        razonamiento = None

        # 1. Intento por texto usando datos del XML + proveedor
        if datos:
            textos_clave = " ".join([
                datos.ciudad_receptor or "",
                datos.direccion_receptor or "",
                *datos.descripciones_items,
                *datos.info_adicional.values(),
            ]).upper()
        else:
            textos_clave = (factura.proveedor or "").upper()

        for area in areas:
            nombre_upper = area.nombre.upper()
            if nombre_upper in ("FACTURACIÓN", "FACTURACION", "ADMINISTRATIVO"):
                continue
            if nombre_upper in textos_clave or area.code.upper() in textos_clave:
                area_asignada = area
                confianza = "alta"
                razonamiento = f"Nombre de área '{area.nombre}' encontrado en datos de la factura."
                break

        # 2. Si no hay match de texto, llamar a Claude Haiku
        if area_asignada is None and settings.anthropic_api_key:
            from anthropic import AsyncAnthropic
            areas_lista = "\n".join(f"- code: {a.code}, nombre: {a.nombre}" for a in areas)
            contexto = (
                f"Proveedor: {factura.proveedor}\n"
                f"Número factura: {factura.numero_factura}\n"
            )
            if datos:
                contexto += (
                    f"Ciudad receptor: {datos.ciudad_receptor or 'N/A'}\n"
                    f"Dirección receptor: {datos.direccion_receptor or 'N/A'}\n"
                    f"Descripciones ítems: {'; '.join(datos.descripciones_items) or 'N/A'}\n"
                    f"Info adicional: {json.dumps(datos.info_adicional, ensure_ascii=False)}\n"
                )

            prompt = f"""Eres un asistente de contabilidad colombiano de Café Quindío.
Asigna esta factura al área correcta basándote en los datos disponibles.

{contexto}
Áreas disponibles:
{areas_lista}

REGLAS:
- Si la factura menciona una ciudad o tienda específica, asígnala al área con ese nombre.
- Si es un tiquete de transporte, asígnala al área de origen del viaje.
- Si no puedes determinar el área con certeza, responde con confianza "baja" o "nula".
- Nunca inventes un área que no esté en la lista.

Responde ÚNICAMENTE con JSON válido:
{{"area_code": "CODE_O_NULL", "confianza": "alta|media|baja|nula", "razonamiento": "explicación breve"}}"""

            try:
                client = AsyncAnthropic(api_key=settings.anthropic_api_key)
                message = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=256,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = message.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw[3:]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()
                if raw.endswith("```"):
                    raw = raw[:-3].strip()
                ai_resp = json.loads(raw)
                ai_code = (ai_resp.get("area_code") or "").strip()
                ai_conf = ai_resp.get("confianza", "nula")
                ai_razon = ai_resp.get("razonamiento", "")

                if ai_code and ai_code.upper() != "NULL":
                    for area in areas:
                        if area.code.upper() == ai_code.upper():
                            area_asignada = area
                            confianza = ai_conf
                            razonamiento = f"[IA] {ai_razon}"
                            break
                else:
                    confianza = "nula"
                    razonamiento = f"[IA] {ai_razon}" if ai_razon else "No se pudo identificar área."
            except Exception:
                confianza = "nula"
                razonamiento = "Error al consultar IA. Requiere asignación manual."

        # Actualizar la factura con los resultados
        factura.ai_area_confianza = confianza
        factura.ai_area_razonamiento = razonamiento
        factura.pendiente_confirmacion = confianza not in ("alta",)
        if area_asignada:
            factura.area_id = area_asignada.id

        await self.db.commit()
        await self.db.refresh(factura)
        logger.info(
            f"Área asignada a factura {factura.numero_factura}: "
            f"{area_asignada.nombre if area_asignada else 'ninguna'} (confianza={confianza})"
        )
    
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
    
    async def asignar_carpeta_tesoreria(
        self,
        factura_id: UUID,
        carpeta_id: UUID
    ) -> AsignarCarpetaTesoreriaResponse:
        """Asigna una factura a una carpeta de tesorería."""
        logger.info(f"Asignando factura {factura_id} a carpeta de tesorería {carpeta_id}")
        
        # Verificar que la factura existe
        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )
        
        # Verificar que la carpeta de tesorería existe
        if self.db:
            from db.models import CarpetaTesoreria
            from sqlalchemy import select
            
            result = await self.db.execute(
                select(CarpetaTesoreria).where(CarpetaTesoreria.id == carpeta_id)
            )
            carpeta = result.scalar_one_or_none()
            
            if not carpeta:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Carpeta de tesorería con ID {carpeta_id} no encontrada"
                )
        
        # Actualizar carpeta_tesoreria_id en la factura
        factura_actualizada = await self.repository.update(
            factura_id,
            {"carpeta_tesoreria_id": carpeta_id}
        )
        
        if not factura_actualizada:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al asignar carpeta de tesorería a factura"
            )
        
        return AsignarCarpetaTesoreriaResponse(
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
        # La novedad (presenta_novedad + código NP) se gestiona de forma independiente.
        if not inventarios_data.requiere_entrada_inventarios:
            logger.info(f"Factura {factura_id} no requiere inventarios - limpiando datos de inventario")

            factura.requiere_entrada_inventarios = False
            factura.destino_inventarios = None
            factura.presenta_novedad = bool(inventarios_data.presenta_novedad)

            # Obtener códigos existentes
            result_existentes = await self.db.execute(
                select(FacturaInventarioCodigo)
                .where(FacturaInventarioCodigo.factura_id == factura_id)
            )
            codigos_existentes = {c.codigo: c for c in result_existentes.scalars().all()}

            # Eliminar todos los códigos EXCEPTO NP (que se maneja con novedad)
            for cod, obj in codigos_existentes.items():
                if cod != 'NP':
                    await self.db.delete(obj)

            # Manejar código NP según presenta_novedad
            np_payload = next((c for c in (inventarios_data.codigos or []) if c.codigo.upper() == 'NP'), None)
            if inventarios_data.presenta_novedad and np_payload:
                # UPSERT del código NP
                if 'NP' in codigos_existentes:
                    codigos_existentes['NP'].valor = np_payload.valor
                else:
                    self.db.add(FacturaInventarioCodigo(
                        factura_id=factura_id,
                        codigo='NP',
                        valor=np_payload.valor
                    ))
            else:
                # Sin novedad: eliminar NP si existía
                if 'NP' in codigos_existentes:
                    await self.db.delete(codigos_existentes['NP'])

            try:
                await self.db.commit()
                await self.db.refresh(factura)
            except (IntegrityError, DataError) as exc:
                await self.db.rollback()
                logger.error(f"Error de BD en update_inventarios (no requiere): {exc}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "Error al guardar inventarios", "error": str(exc.orig)}
                )
            except OperationalError as exc:
                await self.db.rollback()
                logger.error(f"Error de conexión BD en update_inventarios: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Error de conexión con la base de datos"
                )

            codigos_out = []
            if inventarios_data.presenta_novedad and np_payload:
                codigos_out = [InventarioCodigoOut(codigo='NP', valor=np_payload.valor, created_at=factura.updated_at)]

            return InventariosOut(
                factura_id=factura.id,
                requiere_entrada_inventarios=False,
                destino_inventarios=None,
                codigos=codigos_out
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
        
        # Códigos opcionales permitidos en cualquier caso
        OPTIONAL_CODES = {"NSC", "DCC", "ECD", "NP"}

        # Validar códigos faltantes (solo requeridos)
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

        # Validar códigos extras (se permiten los opcionales)
        extra_codes = payload_codes - required_codes - OPTIONAL_CODES
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

        # 2. Deduplicar payload: si el frontend envía múltiples entradas del mismo
        # código (ej. dos OCT), tomar el último valor para respetar el unique constraint.
        payload_dedup: dict = {}
        for codigo_in in inventarios_data.codigos:
            payload_dedup[codigo_in.codigo.upper()] = codigo_in

        # 3. Procesar códigos del payload (deduplicados)
        codigos_procesados = set()
        for codigo_upper, codigo_in in payload_dedup.items():
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
        
        # 4. Eliminar códigos que no están en el payload (limpieza)
        for codigo_key, codigo_obj in codigos_existentes.items():
            if codigo_key not in codigos_procesados:
                await self.db.delete(codigo_obj)
                logger.debug(f"Eliminando código {codigo_key} para factura {factura_id}")
        
        # Commit
        try:
            await self.db.commit()
            await self.db.refresh(factura)
        except (IntegrityError, DataError) as exc:
            await self.db.rollback()
            logger.error(f"Error de BD en update_inventarios (requiere): {exc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Error al guardar inventarios", "error": str(exc.orig)}
            )
        except OperationalError as exc:
            await self.db.rollback()
            logger.error(f"Error de conexión BD en update_inventarios: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error de conexión con la base de datos"
            )

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
        try:
            await self.db.commit()
            await self.db.refresh(factura)
        except (IntegrityError, DataError) as exc:
            await self.db.rollback()
            logger.error(f"Error de BD en update_anticipo para factura {factura_id}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Error al guardar anticipo", "error": str(exc.orig)}
            )
        except OperationalError as exc:
            await self.db.rollback()
            logger.error(f"Error de conexión BD en update_anticipo: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error de conexión con la base de datos"
            )

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

        # Área Financiera (Compras) — sin restricciones, pasa directamente a Contabilidad
        FINANCIERA_AREA_ID = UUID("a38a557e-09af-4b8e-ba08-528769d19208")
        if factura.area_id == FINANCIERA_AREA_ID:
            area_result = await self.db.execute(
                select(Area).where(Area.nombre.ilike("%contabilidad%"))
            )
            area_contabilidad = area_result.scalar_one_or_none()
            if not area_contabilidad:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Área CONTABILIDAD no encontrada"
                )
            estado_result = await self.db.execute(
                select(Estado).where(Estado.id == 3)
            )
            estado_contabilidad = estado_result.scalar_one_or_none()
            factura.area_id = area_contabilidad.id
            factura.estado_id = estado_contabilidad.id if estado_contabilidad else 3
            factura.assigned_to_user_id = None
            factura.assigned_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(factura)
            logger.info(f"Factura {factura_id} (Financiera/Compras) enviada a Contabilidad sin restricciones.")
            return {
                "factura_id": str(factura.id),
                "area_id": str(factura.area_id),
                "area_nombre": area_contabilidad.nombre,
                "estado_actual": estado_contabilidad.label if estado_contabilidad else "Contabilidad",
                "missing_fields": [],
                "missing_codes": [],
                "extra_codes": [],
            }

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
                
                # Validar extras (permitir opcionales NSC, DCC, ECD, NP)
                OPTIONAL_CODES = {"NSC", "DCC", "ECD", "NP"}
                extra = existing_codes - required_codes - OPTIONAL_CODES
                if extra:
                    extra_codes.extend(sorted(list(extra)))
                
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
        
        # ========== VALIDACIÓN: APROBACIÓN DUAL para inventario ALMACEN ==========
        # Solo bloquea si el proceso fue iniciado pero no completado
        if factura.requiere_entrada_inventarios and factura.destino_inventarios == 'ALMACEN':
            if factura.fecha_envio_aprobacion_ops and not factura.fecha_aprobacion_ops:
                missing_fields.append("aprobacion_gerencia_operaciones")
            if factura.fecha_envio_aprobacion_calidad and not factura.fecha_aprobacion_calidad:
                missing_fields.append("aprobacion_calidad_cafe")

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
        
        # Guardar área del responsable como origen para poder devolver correctamente
        factura.area_origen_id = factura.area_id

        # Actualizar factura
        factura.area_id = area_contabilidad.id
        factura.estado_id = estado_contabilidad.id
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()
        factura.fecha_envio_contabilidad = datetime.utcnow()

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
            fecha_vencimiento=factura.fecha_vencimiento,
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
        factura.fecha_envio_tesoreria = datetime.utcnow()

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
            fecha_vencimiento=factura.fecha_vencimiento,
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
    
    async def submit_gadmin_tesoreria(self, factura_id: UUID) -> SubmitResponsableOut:
        """
        Envía una factura desde GADMIN directamente a TESORERIA (sin pasar por Contabilidad).
        """
        from db.models import Area, Estado, FacturaInventarioCodigo
        from sqlalchemy import select

        GADMIN_AREA_ID = UUID("c1589d0c-736b-4af4-89f2-81900d2dac16")
        TESORERIA_AREA_ID = UUID("b067adcd-13ff-420f-9389-42bfaa78cf9f")
        TESORERIA_ESTADO_ID = 7

        factura = await self.repository.get_by_id(factura_id)
        if not factura:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Factura con ID {factura_id} no encontrada")

        if factura.area_id != GADMIN_AREA_ID:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La factura no pertenece al área Gastos Fijos Café Quindío")

        area_result = await self.db.execute(select(Area).where(Area.id == TESORERIA_AREA_ID))
        area_tesoreria = area_result.scalar_one_or_none()
        if not area_tesoreria:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Área Tesorería no encontrada")

        estado_result = await self.db.execute(select(Estado).where(Estado.id == TESORERIA_ESTADO_ID))
        estado_tesoreria = estado_result.scalar_one_or_none()
        if not estado_tesoreria:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Estado Tesorería no encontrado")

        # Guardar origen antes de mover
        if factura.area_origen_id is None:
            factura.area_origen_id = GADMIN_AREA_ID

        factura.area_id = TESORERIA_AREA_ID
        factura.estado_id = TESORERIA_ESTADO_ID
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(factura)

        codigos_result = await self.db.execute(
            select(FacturaInventarioCodigo).where(FacturaInventarioCodigo.factura_id == factura_id)
        )
        codigos = codigos_result.scalars().all()

        files_result = await self.db.execute(
            select(File).where(File.factura_id == factura_id)
        )
        files = files_result.scalars().all()

        from modules.facturas.schemas import InventarioCodigoOut
        from modules.files.schemas import FileMiniOut

        return SubmitResponsableOut(
            factura_id=factura.id,
            area_id=factura.area_id,
            area_actual=area_tesoreria.nombre,
            estado_id=factura.estado_id,
            estado_actual=estado_tesoreria.label,
            proveedor=factura.proveedor,
            numero_factura=factura.numero_factura,
            fecha_emision=factura.fecha_emision,
            fecha_vencimiento=factura.fecha_vencimiento,
            total=float(factura.total),
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            requiere_entrada_inventarios=factura.requiere_entrada_inventarios,
            destino_inventarios=factura.destino_inventarios,
            presenta_novedad=factura.presenta_novedad,
            inventario_codigos=[InventarioCodigoOut(codigo=c.codigo, valor=c.valor, created_at=c.created_at) for c in codigos],
            tiene_anticipo=factura.tiene_anticipo,
            porcentaje_anticipo=factura.porcentaje_anticipo,
            intervalo_entrega_contabilidad=factura.intervalo_entrega_contabilidad or '1_SEMANA',
            es_gasto_adm=factura.es_gasto_adm,
            files=[],
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
        factura.fecha_cierre = datetime.utcnow()

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
            f"Factura {factura_id} pagada en TESORERIA exitosamente. "
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
            fecha_vencimiento=factura.fecha_vencimiento,
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
        motivo: str,
        user_id: str
    ) -> dict:
        """
        Devuelve una factura de Contabilidad al Área Responsable original.
        Solo permitido si la factura está en estado de Contabilidad (estado_id = 3).
        Usa area_origen_id que nunca cambia durante el ciclo de vida de la factura.
        """
        from sqlalchemy import select
        from db.models import Factura, Estado, Area, User

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
        
        # Capturar nombre del usuario que devuelve
        result_user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user_devuelve = result_user.scalar_one_or_none()

        # Devolver a área origen (que nunca cambia)
        factura.area_id = factura.area_origen_id
        factura.estado_id = 2  # Estado "Asignada" (Responsable)
        factura.motivo_devolucion = motivo
        factura.devuelta_por_nombre = user_devuelve.nombre if user_devuelve else None
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
            "motivo_devolucion": factura.motivo_devolucion,
            "devuelta_por_nombre": factura.devuelta_por_nombre,
        }

    async def devolver_a_facturacion(
        self,
        factura_id: UUID,
        motivo: str,
        user_id: str
    ) -> dict:
        """
        Devuelve una factura de Responsable al área de Facturación.
        Solo permitido si la factura está en estado de Responsable (estado_id = 2).
        Asigna al usuario de Facturación y cambia estado a "Recibida" (estado_id = 1).
        """
        from sqlalchemy import select
        from db.models import Factura, Estado, Area, User
        
        logger.info(f"Devolviendo factura {factura_id} a Facturación. Motivo: {motivo}")
        
        # ID del usuario de Facturación (Marlin CQ)
        FACTURACION_USER_ID = "24c529cd-f587-4076-8d9e-4e38c743cb0a"
        
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
        
        # Validar que esté en estado Responsable/Asignada (estado_id = 2)
        if factura.estado_id != 2:
            result_estado = await self.db.execute(
                select(Estado).where(Estado.id == factura.estado_id)
            )
            estado_actual = result_estado.scalar_one_or_none()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La factura debe estar en estado 'Asignada' (Responsable) para poder devolverla a Facturación. Estado actual: {estado_actual.label if estado_actual else 'Desconocido'}"
            )
        
        # Buscar área de Facturación por código 'fact'
        result_area = await self.db.execute(
            select(Area).where(Area.code == 'fact')
        )
        area_facturacion = result_area.scalar_one_or_none()
        
        if not area_facturacion:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se encontró el área de Facturación en el sistema"
            )
        
        # Verificar que el usuario de Facturación existe
        result_user = await self.db.execute(
            select(User).where(User.id == FACTURACION_USER_ID)
        )
        user_facturacion = result_user.scalar_one_or_none()
        
        if not user_facturacion:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se encontró el usuario de Facturación en el sistema"
            )
        
        # Capturar nombre del usuario que devuelve
        result_user_devuelve = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user_devuelve = result_user_devuelve.scalar_one_or_none()

        # Devolver a Facturación
        factura.area_id = area_facturacion.id
        factura.estado_id = 1  # Estado "Recibida" (vuelve a Facturación)
        factura.motivo_devolucion = motivo
        factura.devuelta_por_nombre = user_devuelve.nombre if user_devuelve else None
        factura.assigned_to_user_id = FACTURACION_USER_ID  # Asignar específicamente a Marlin CQ
        
        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener nombre del estado actual
        result_estado = await self.db.execute(
            select(Estado).where(Estado.id == factura.estado_id)
        )
        estado = result_estado.scalar_one_or_none()
        
        logger.info(
            f"Factura {factura_id} devuelta exitosamente a Facturación (Usuario: {user_facturacion.nombre})"
        )

        return {
            "factura_id": str(factura.id),
            "area_id": str(factura.area_id),
            "area_nombre": area_facturacion.nombre,
            "estado_actual": estado.label if estado else "Desconocido",
            "motivo_devolucion": factura.motivo_devolucion,
            "devuelta_por_nombre": factura.devuelta_por_nombre,
            "usuario_facturacion": user_facturacion.nombre,
        }

    async def devolver_a_tesoreria_sin_pagar(self, factura_id: UUID) -> dict:
        """
        Revierte una factura de estado 'Pagada' a 'En Tesorería' (estado_id=7).
        Limpia la carpeta de tesorería asignada para que aparezca en la raíz
        de Carpetas Pendientes por Pagar.
        Solo permitido si la factura está en estado Pagada (estado_id=5).
        """
        from sqlalchemy import select, update
        from db.models import Factura, Estado

        PAGADA_ESTADO_ID = 5
        TESORERIA_ESTADO_ID = 7

        result = await self.db.execute(select(Factura).where(Factura.id == factura_id))
        factura = result.scalar_one_or_none()

        if not factura:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Factura con ID {factura_id} no encontrada"
            )

        if factura.estado_id != PAGADA_ESTADO_ID:
            result_estado = await self.db.execute(
                select(Estado).where(Estado.id == factura.estado_id)
            )
            estado_actual = result_estado.scalar_one_or_none()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se puede devolver una factura en estado Pagada. Estado actual: {estado_actual.label if estado_actual else 'Desconocido'}"
            )

        factura.estado_id = TESORERIA_ESTADO_ID
        factura.carpeta_tesoreria_id = None

        await self.db.commit()
        await self.db.refresh(factura)

        logger.info(f"Factura {factura_id} devuelta a Tesorería (sin pagar). carpeta_tesoreria_id limpiada.")

        return {
            "factura_id": str(factura.id),
            "estado_actual": "En Tesorería",
            "carpeta_tesoreria_id": None,
        }

    # =========================================================================
    # APROBACIÓN POR CORREO ELECTRÓNICO
    # =========================================================================

    async def enviar_correo_aprobacion(
        self,
        factura_id: UUID,
        aprobador_id: UUID,
        comentario: Optional[str] = None,
        solicitante_id: Optional[UUID] = None,
    ) -> dict:
        """Genera un token de aprobación y envía el correo al gerente seleccionado."""
        import secrets
        from datetime import timezone, timedelta
        from sqlalchemy import select
        from db.models import Factura, AprobadorGerencia, TokenAprobacionFactura, File, User
        from core.email_service import email_service
        from core.config import settings

        result = await self.db.execute(
            select(Factura).where(Factura.id == factura_id)
        )
        factura = result.scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")

        result_apr = await self.db.execute(
            select(AprobadorGerencia).where(
                AprobadorGerencia.id == aprobador_id,
                AprobadorGerencia.is_active == True,
            )
        )
        aprobador = result_apr.scalar_one_or_none()
        if not aprobador:
            raise HTTPException(status_code=404, detail="Aprobador no encontrado o inactivo.")

        token_str = secrets.token_urlsafe(48)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=72)

        token_obj = TokenAprobacionFactura(
            factura_id=factura.id,
            token=token_str,
            aprobador_email=aprobador.email,
            aprobador_nombre=aprobador.nombre,
            usado=False,
            expires_at=expires_at,
        )
        self.db.add(token_obj)
        factura.fecha_envio_gerencia = datetime.now(tz=timezone.utc)
        await self.db.commit()

        # Nombre de quien está solicitando la aprobación
        solicitante_nombre = None
        if solicitante_id:
            result_user = await self.db.execute(
                select(User).where(User.id == solicitante_id)
            )
            user_obj = result_user.scalar_one_or_none()
            if user_obj:
                solicitante_nombre = user_obj.nombre

        # Intentar obtener el PDF de la factura para adjuntarlo
        pdf_bytes = None
        pdf_filename = None
        try:
            import asyncio
            from core.s3_service import s3_service
            from pathlib import Path

            result_pdf = await self.db.execute(
                select(File).where(
                    File.factura_id == factura.id,
                    File.doc_type == "FACTURA_PDF",
                ).limit(1)
            )
            pdf_file = result_pdf.scalar_one_or_none()

            if pdf_file:
                if pdf_file.storage_provider == "local":
                    p = Path(pdf_file.storage_path)
                    if p.exists():
                        pdf_bytes = p.read_bytes()
                        pdf_filename = pdf_file.filename
                    else:
                        logger.warning(f"PDF local no existe en disco: {pdf_file.storage_path}")
                elif pdf_file.storage_provider == "s3":
                    pdf_bytes, _ = await asyncio.to_thread(
                        s3_service.get_file_with_metadata, pdf_file.storage_path
                    )
                    pdf_filename = pdf_file.filename
            else:
                # Fallback: buscar directamente en S3 si no hay registro en BD
                logger.info(f"No hay registro FACTURA_PDF en BD para {factura.id}, buscando en S3...")
                s3_prefix = f"dev/facturas/{factura.id}/FACTURA_PDF/"
                s3_files = await asyncio.to_thread(s3_service.list_files_in_prefix, s3_prefix)
                if s3_files:
                    first = s3_files[0]
                    pdf_bytes, _ = await asyncio.to_thread(
                        s3_service.get_file_with_metadata, first["key"]
                    )
                    pdf_filename = first["filename"]
                    logger.info(f"PDF encontrado en S3 via fallback: {first['key']}")
                else:
                    logger.warning(f"No se encontró FACTURA_PDF en BD ni en S3 para factura {factura.numero_factura}")
        except Exception as e:
            logger.warning(f"No se pudo obtener PDF para adjuntar al correo: {e}")

        await email_service.enviar_solicitud_aprobacion_factura(
            factura=factura,
            aprobador_nombre=aprobador.nombre,
            aprobador_email=aprobador.email,
            token_str=token_str,
            comentario=comentario,
            pdf_bytes=pdf_bytes,
            pdf_filename=pdf_filename,
            solicitante_nombre=solicitante_nombre,
        )

        logger.info(
            f"Correo de aprobación enviado para factura {factura.numero_factura} "
            f"a {aprobador.email}"
        )
        return {"message": f"Correo de aprobación enviado a {aprobador.nombre} ({aprobador.email})."}

    async def aprobar_por_token(self, token_str: str, ip: str) -> dict:
        """Aprueba una factura usando el token recibido por email (endpoint público)."""
        from datetime import timezone
        from sqlalchemy import select
        from db.models import Factura, TokenAprobacionFactura
        from core.email_service import email_service
        from core.config import settings

        result = await self.db.execute(
            select(TokenAprobacionFactura).where(TokenAprobacionFactura.token == token_str)
        )
        token_obj = result.scalar_one_or_none()
        if not token_obj:
            raise HTTPException(status_code=404, detail="Token no válido.")
        if token_obj.usado:
            raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado anteriormente.")

        now_utc = datetime.now(tz=timezone.utc)
        if now_utc > token_obj.expires_at:
            raise HTTPException(status_code=400, detail="El enlace de aprobación ha expirado (72 horas).")

        token_obj.usado = True
        token_obj.usado_at = now_utc
        token_obj.usado_por_ip = ip

        result_f = await self.db.execute(
            select(Factura).where(Factura.id == token_obj.factura_id)
        )
        factura = result_f.scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")

        factura.fecha_aprobacion_email = now_utc
        factura.aprobado_por_nombre = token_obj.aprobador_nombre
        factura.aprobado_por_email = token_obj.aprobador_email

        await self.db.commit()

        # Notificar al responsable
        responsable_email = getattr(settings, "email_responsable", None)
        if responsable_email:
            await email_service.enviar_notificacion_factura_aprobada(
                factura=factura,
                email_responsable=responsable_email,
            )

        logger.info(
            f"Factura {factura.numero_factura} aprobada por token por {token_obj.aprobador_nombre}"
        )
        return {
            "factura_id": str(factura.id),
            "numero_factura": factura.numero_factura,
            "proveedor": factura.proveedor,
            "total": float(factura.total),
            "aprobado_por_nombre": factura.aprobado_por_nombre,
            "aprobado_por_email": factura.aprobado_por_email,
            "fecha_aprobacion_email": factura.fecha_aprobacion_email,
        }

    async def historial_area(self, user_id: UUID) -> list:
        """
        Retorna el historial de facturas que pasaron por el área del usuario responsable.
        Usa tres estrategias combinadas para máxima cobertura:
          1. factura_asignaciones con area_id == area del usuario
          2. facturas donde area_origen_id == area del usuario (historial migration / XML)
          3. facturas actualmente en el área (bandeja activa)
        """
        from sqlalchemy import select
        from db.models import User, Factura, FacturaAsignacion

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.area_id:
            return []

        area_id = user.area_id
        fecha_por_factura: dict = {}

        # Estrategia 1: asignaciones formales al área
        asign_result = await self.db.execute(
            select(FacturaAsignacion.factura_id, FacturaAsignacion.created_at)
            .where(FacturaAsignacion.area_id == area_id)
            .order_by(FacturaAsignacion.created_at.asc())
        )
        for row in asign_result.all():
            fid = row.factura_id
            if fid not in fecha_por_factura:
                fecha_por_factura[fid] = row.created_at

        # Estrategia 2: facturas con area_origen_id apuntando al área
        origen_result = await self.db.execute(
            select(Factura.id, Factura.assigned_at)
            .where(Factura.area_origen_id == area_id)
        )
        for row in origen_result.all():
            fid = row.id
            if fid not in fecha_por_factura:
                fecha_por_factura[fid] = row.assigned_at

        # Estrategia 3: facturas actualmente en el área (bandeja)
        current_result = await self.db.execute(
            select(Factura.id, Factura.assigned_at)
            .where(Factura.area_id == area_id)
        )
        for row in current_result.all():
            fid = row.id
            if fid not in fecha_por_factura:
                fecha_por_factura[fid] = row.assigned_at

        if not fecha_por_factura:
            return []

        factura_ids = list(fecha_por_factura.keys())

        facturas_result = await self.db.execute(
            select(Factura).where(Factura.id.in_(factura_ids))
        )
        facturas = facturas_result.scalars().all()

        items = []
        for f in facturas:
            items.append({
                "id": str(f.id),
                "numero_factura": f.numero_factura,
                "proveedor": f.proveedor,
                "total": float(f.total),
                "estado_id": f.estado_id,
                "estado_label": f.estado.label if f.estado else "",
                "estado_code": f.estado.code if f.estado else "",
                "es_finalizada": f.estado.is_final if f.estado else False,
                "area_nombre": user.area.nombre if user.area else "",
                "assigned_at": (fecha_por_factura[f.id].isoformat() if fecha_por_factura[f.id] else None),
                "fecha_envio_contabilidad": f.fecha_envio_contabilidad.isoformat() if f.fecha_envio_contabilidad else None,
                "fecha_envio_tesoreria": f.fecha_envio_tesoreria.isoformat() if f.fecha_envio_tesoreria else None,
                "fecha_cierre": f.fecha_cierre.isoformat() if f.fecha_cierre else None,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            })

        items.sort(key=lambda x: x["assigned_at"] or "", reverse=True)
        return items

    # =========================================================================
    # APROBACIÓN DUAL (Gerencia Operaciones + Calidad Café) — Inventario ALMACEN
    # =========================================================================

    async def enviar_aprobacion_dual(
        self,
        factura_id: UUID,
        aprobador_ops_id: UUID,
        aprobador_calidad_id: UUID,
        solicitante_id: Optional[UUID] = None,
    ) -> dict:
        """
        Envía correos de aprobación dual a Gerencia Operaciones y Calidad Café.
        Solo aplica cuando requiere_entrada_inventarios=True y destino=ALMACEN.
        """
        import secrets
        from datetime import timezone, timedelta
        from sqlalchemy import select
        from db.models import Factura, AprobadorGerencia, TokenAprobacionFactura, User
        from core.email_service import email_service
        from core.config import settings

        factura = (await self.db.execute(select(Factura).where(Factura.id == factura_id))).scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada")

        aprobador_ops = (await self.db.execute(select(AprobadorGerencia).where(AprobadorGerencia.id == aprobador_ops_id))).scalar_one_or_none()
        aprobador_calidad = (await self.db.execute(select(AprobadorGerencia).where(AprobadorGerencia.id == aprobador_calidad_id))).scalar_one_or_none()

        if not aprobador_ops:
            raise HTTPException(status_code=404, detail="Aprobador Operaciones no encontrado")
        if not aprobador_calidad:
            raise HTTPException(status_code=404, detail="Aprobador Calidad no encontrado")

        expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=72)
        base_url = getattr(settings, 'frontend_url', 'http://localhost:5173')

        resultados = []
        for aprobador, tipo, campo_envio, campo_id in [
            (aprobador_ops,     'OPS',     'fecha_envio_aprobacion_ops',     'aprobacion_ops_aprobador_id'),
            (aprobador_calidad, 'CALIDAD', 'fecha_envio_aprobacion_calidad', 'aprobacion_calidad_aprobador_id'),
        ]:
            token_str = secrets.token_urlsafe(48)
            token_obj = TokenAprobacionFactura(
                factura_id=factura.id,
                token=token_str,
                aprobador_email=aprobador.email,
                aprobador_nombre=aprobador.nombre,
                tipo_aprobacion=tipo,
                usado=False,
                expires_at=expires_at,
            )
            self.db.add(token_obj)
            setattr(factura, campo_envio, datetime.now(tz=timezone.utc))
            setattr(factura, campo_id, aprobador.id)

            try:
                await email_service.enviar_solicitud_aprobacion_factura(
                    factura=factura,
                    aprobador_nombre=aprobador.nombre,
                    aprobador_email=aprobador.email,
                    token_str=token_str,
                    comentario=f"Aprobación {'Gerencia Operaciones' if tipo == 'OPS' else 'Calidad Café'} requerida",
                )
                resultados.append({"tipo": tipo, "email": aprobador.email, "enviado": True})
            except Exception as e:
                logger.error(f"Error enviando correo aprobación dual {tipo}: {e}")
                resultados.append({"tipo": tipo, "email": aprobador.email, "enviado": False})

        await self.db.commit()
        return {"factura_id": str(factura.id), "aprobaciones_enviadas": resultados}

    async def reenviar_aprobacion_dual(self, factura_id: UUID) -> dict:
        """
        Reenvía correos de aprobación dual a los aprobadores pendientes,
        usando los IDs ya guardados en la factura (sin requerir parámetros).
        """
        import secrets
        from datetime import timezone, timedelta
        from sqlalchemy import select
        from db.models import Factura, AprobadorGerencia, TokenAprobacionFactura
        from core.email_service import email_service
        from core.config import settings

        factura = (await self.db.execute(select(Factura).where(Factura.id == factura_id))).scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada")

        pendientes = []
        if factura.aprobacion_ops_aprobador_id and not factura.fecha_aprobacion_ops:
            pendientes.append(('OPS', factura.aprobacion_ops_aprobador_id, 'fecha_envio_aprobacion_ops'))
        if factura.aprobacion_calidad_aprobador_id and not factura.fecha_aprobacion_calidad:
            pendientes.append(('CALIDAD', factura.aprobacion_calidad_aprobador_id, 'fecha_envio_aprobacion_calidad'))

        if not pendientes:
            raise HTTPException(status_code=400, detail="No hay aprobaciones pendientes para reenviar")

        expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=72)
        base_url = getattr(settings, 'frontend_url', 'http://localhost:5173')
        resultados = []

        for tipo, aprobador_id, campo_envio in pendientes:
            aprobador = (await self.db.execute(select(AprobadorGerencia).where(AprobadorGerencia.id == aprobador_id))).scalar_one_or_none()
            if not aprobador:
                resultados.append({"tipo": tipo, "email": "?", "enviado": False})
                continue

            token_str = secrets.token_urlsafe(48)
            token_obj = TokenAprobacionFactura(
                factura_id=factura.id,
                token=token_str,
                aprobador_email=aprobador.email,
                aprobador_nombre=aprobador.nombre,
                tipo_aprobacion=tipo,
                usado=False,
                expires_at=expires_at,
            )
            self.db.add(token_obj)
            setattr(factura, campo_envio, datetime.now(tz=timezone.utc))

            try:
                await email_service.enviar_solicitud_aprobacion_factura(
                    factura=factura,
                    aprobador_nombre=aprobador.nombre,
                    aprobador_email=aprobador.email,
                    token_str=token_str,
                    comentario=f"Reenvío — Aprobación {'Gerencia Operaciones' if tipo == 'OPS' else 'Calidad Café'} requerida",
                )
                resultados.append({"tipo": tipo, "email": aprobador.email, "enviado": True})
            except Exception as e:
                logger.error(f"Error reenviando correo aprobación dual {tipo}: {e}")
                resultados.append({"tipo": tipo, "email": aprobador.email, "enviado": False})

        await self.db.commit()
        return {"factura_id": str(factura.id), "aprobaciones_enviadas": resultados}

    async def aprobar_por_token_dual(self, token: str, ip: str) -> dict:
        """Procesa la aprobación de un token de aprobación dual (OPS o CALIDAD)."""
        import secrets
        from datetime import timezone
        from sqlalchemy import select
        from db.models import Factura, TokenAprobacionFactura

        now_utc = datetime.now(tz=timezone.utc)
        result = await self.db.execute(select(TokenAprobacionFactura).where(TokenAprobacionFactura.token == token))
        token_obj = result.scalar_one_or_none()

        if not token_obj or token_obj.tipo_aprobacion not in ('OPS', 'CALIDAD'):
            return None  # no es token dual — delegar al handler estándar

        if token_obj.usado:
            raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado.")
        if token_obj.expires_at < now_utc:
            raise HTTPException(status_code=400, detail="El enlace ha expirado (72 horas).")

        token_obj.usado = True
        token_obj.usado_at = now_utc
        token_obj.usado_por_ip = ip

        result_f = await self.db.execute(select(Factura).where(Factura.id == token_obj.factura_id))
        factura = result_f.scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")

        if token_obj.tipo_aprobacion == 'OPS':
            factura.fecha_aprobacion_ops = now_utc
            factura.aprobado_ops_nombre = token_obj.aprobador_nombre
            factura.aprobado_ops_email = token_obj.aprobador_email
        else:
            factura.fecha_aprobacion_calidad = now_utc
            factura.aprobado_calidad_nombre = token_obj.aprobador_nombre
            factura.aprobado_calidad_email = token_obj.aprobador_email

        await self.db.commit()

        tipo_label = "Gerencia Operaciones" if token_obj.tipo_aprobacion == 'OPS' else "Calidad Café"
        return {
            "factura_id": str(factura.id),
            "numero_factura": factura.numero_factura,
            "proveedor": factura.proveedor,
            "total": float(factura.total),
            "tipo_aprobacion": token_obj.tipo_aprobacion,
            "aprobado_por_nombre": token_obj.aprobador_nombre,
            "aprobado_por_email": token_obj.aprobador_email,
            "fecha_aprobacion_email": now_utc,
            "mensaje": f"Aprobación de {tipo_label} registrada exitosamente. Gracias.",
        }

