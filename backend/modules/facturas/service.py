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
    FacturaBandejaItem,
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
    AsignarCarpetaTesoreriaResponse,
    AsignarCarpetaTesoreriaMasivoResponse,
    FacturaNoArchivadaOut,
)
from typing import List, Optional, Set, Dict
from core.logging import logger
from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy.exc import IntegrityError, DataError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from db.models import File


# Áreas canónicas del auto-ruteo OC (mismos ids en local y producción)
RADICACION_AREA_ID = UUID("498e9fdb-25f5-42f9-beb8-92564ab6bdf4")
CONTABILIDAD_AREA_ID_RUTEO = UUID("725f5e5a-49d3-4e44-800f-f5ff21e187ac")
ESTADO_PENDIENTE_CONTABILIDAD = 3

# Tipos de movimiento de `factura_movimientos`. Coinciden con los `tipo` que ya
# consume el historial en el frontend, para que los eventos reales se pinten con
# el mismo icono que los sintéticos a los que reemplazan.
MOV_ASIGNACION = "asignacion"                 # pase de un área a otra
MOV_ENVIO_CONTABILIDAD = "envio_contabilidad"
MOV_ENVIO_TESORERIA = "envio_tesoreria"
MOV_DEVOLUCION = "devolucion"
MOV_CIERRE = "cierre"
MOV_RECHAZO_EMAIL = "rechazo_email"        # el aprobador rechazó desde el correo


class FacturaService:
    """Servicio que contiene la lógica de negocio de facturas."""

    def __init__(self, repository: FacturaRepository, db: AsyncSession = None):
        self.repository = repository
        self.db = db

    async def registrar_movimiento(
        self,
        factura_id: UUID,
        tipo: str,
        area_desde_id: Optional[UUID] = None,
        area_hasta_id: Optional[UUID] = None,
        estado_desde_id: Optional[int] = None,
        estado_hasta_id: Optional[int] = None,
        user_id: Optional[UUID] = None,
        motivo: Optional[str] = None,
    ) -> None:
        """Deja constancia de un movimiento real de la factura.

        Se limita a encolar la fila en la sesión: el commit lo hace la operación
        que la origina, así el movimiento y el cambio viajan en la MISMA
        transacción (o no ocurre ninguno de los dos).

        Nunca interrumpe la operación de negocio: si la bitácora falla, se
        registra el error y el flujo continúa. Perder una fila de historial es
        malo; perder el pase de la factura, peor.
        """
        if self.db is None:
            return

        try:
            from db.models import FacturaMovimiento, User
            from sqlalchemy import select

            user_nombre = None
            if user_id:
                res = await self.db.execute(select(User).where(User.id == user_id))
                usuario = res.scalar_one_or_none()
                user_nombre = usuario.nombre if usuario else None

            self.db.add(FacturaMovimiento(
                factura_id=factura_id,
                tipo=tipo,
                area_desde_id=area_desde_id,
                area_hasta_id=area_hasta_id,
                estado_desde_id=estado_desde_id,
                estado_hasta_id=estado_hasta_id,
                user_id=user_id,
                user_nombre=user_nombre,
                motivo=motivo,
            ))
        except Exception as e:  # pragma: no cover - la bitácora nunca bloquea el flujo
            logger.error(f"No se pudo registrar el movimiento de la factura {factura_id}: {e}")

    @staticmethod
    def _to_uuid(valor) -> Optional[UUID]:
        """Normaliza a UUID los ids que llegan como str desde el token JWT."""
        if valor is None or isinstance(valor, UUID):
            return valor
        try:
            return UUID(str(valor))
        except (ValueError, AttributeError, TypeError):
            return None


    async def list_facturas(
        self,
        skip: int = 0,
        limit: int = 100,
        area_id: Optional[UUID] = None,
        area_origen_id: Optional[UUID] = None,
        estado: Optional[str] = None,
        search: Optional[str] = None,
        only_in_carpeta: bool = False,
        solo_tiendas: bool = False,
        estado_code: Optional[str] = None,
        factura_id: Optional[UUID] = None,
    ) -> FacturasPaginatedResponse:
        """Lista todas las facturas con paginación y filtros."""
        logger.info(f"Listando facturas: skip={skip}, limit={limit}, area_id={area_id}, estado={estado}, search={search}, only_in_carpeta={only_in_carpeta}, solo_tiendas={solo_tiendas}, estado_code={estado_code}, factura_id={factura_id}")
        facturas, total = await self.repository.get_all(skip=skip, limit=limit, area_id=area_id, area_origen_id=area_origen_id, estado=estado, search=search, only_in_carpeta=only_in_carpeta, solo_tiendas=solo_tiendas, estado_code=estado_code, factura_id=factura_id)
        
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
                es_activo_fijo=f.es_activo_fijo,
                motivo_devolucion=f.motivo_devolucion,
                devuelta_por_nombre=f.devuelta_por_nombre,
                fecha_rechazo_email=f.fecha_rechazo_email,
                rechazado_por_nombre=f.rechazado_por_nombre,
                motivo_rechazo_email=f.motivo_rechazo_email,
                tipo_rechazo_email=f.tipo_rechazo_email,
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
                fecha_envio_contabilidad=f.fecha_envio_contabilidad,
                fecha_envio_tesoreria=f.fecha_envio_tesoreria,
                fecha_cierre=f.fecha_cierre,
                nit_proveedor=f.nit_proveedor,
                pendiente_confirmacion=f.pendiente_confirmacion,
                ai_area_confianza=f.ai_area_confianza,
                ai_area_razonamiento=f.ai_area_razonamiento,
                tipo_doc=f.tipo_doc,
                numero_oc=f.numero_oc,
                estado_oc=f.estado_oc,
                enrutada_automaticamente=f.enrutada_automaticamente,
            ))
        
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return FacturasPaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=limit
        )
    
    async def bandeja_tesoreria(self) -> List[FacturaBandejaItem]:
        """Bandeja de Tesorería: lista mínima de facturas en carpeta (query plana)."""
        rows = await self.repository.get_bandeja_tesoreria()
        return [
            FacturaBandejaItem(
                id=r.id,
                numero_factura=r.numero_factura,
                proveedor=r.proveedor,
                total=float(r.total),
                estado=r.estado or '',
                area=r.area or '',
                fecha_emision=r.fecha_emision,
                fecha_vencimiento=r.fecha_vencimiento,
                carpeta_id=r.carpeta_id,
                fecha_cierre=r.fecha_cierre,
            )
            for r in rows
        ]

    async def get_area_counts(self):
        """Retorna conteo de facturas por área (query única con GROUP BY)."""
        return await self.repository.get_counts_by_area()

    async def represadas_tiendas(self):
        """Resumen de facturas represadas (estado 'asignada') por tienda.

        Usado por el rol jefe_zona para monitorear, en solo lectura, cuántas
        facturas siguen sin enviarse a Contabilidad en cada tienda.
        """
        return await self.repository.get_represadas_tiendas()

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
            fecha_vencimiento=factura.fecha_vencimiento,
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
            unidad_negocio_id=factura.unidad_negocio_id,
            unidad_negocio=factura.unidad_negocio.descripcion if factura.unidad_negocio else None,
            tipo_doc=factura.tipo_doc,
            numero_oc=factura.numero_oc,
            estado_oc=factura.estado_oc,
            enrutada_automaticamente=factura.enrutada_automaticamente,
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
        # Y el mismo proveedor, devolver la existente en lugar de crear un segundo
        # registro huérfano sin PDF. El número solo no basta: textos genéricos como
        # 'CUENTA DE COBRO JUNIO' se repiten entre proveedores distintos y devolver
        # la factura de otro proveedor termina adjuntándole el PDF equivocado.
        existing = await self.repository.get_by_numero_and_proveedor(
            factura_data.numero_factura, factura_data.proveedor
        )
        if existing:
            logger.info(
                f"Factura {factura_data.numero_factura} de {factura_data.proveedor} "
                f"ya existe (id={existing.id}), devolviendo registro existente "
                "en lugar de crear duplicado."
            )
            return await self.get_factura(existing.id)


        datos = factura_data.model_dump(exclude={"xml_content", "nit", "c_costo", "c_operacion", "unidad_negocio", "distribucion"})
        if factura_data.nit:
            datos["nit_proveedor"] = factura_data.nit

        # N8N envía centro de costo/operación y unidad de negocio como texto
        # (código o nombre); se resuelven contra los catálogos para que la app
        # los muestre con la UI existente. Si no hay match se deja NULL.
        if self.db:
            from db.models import CentroCosto, CentroOperacion, UnidadNegocio
            if factura_data.c_costo and not datos.get("centro_costo_id"):
                datos["centro_costo_id"] = await self._resolver_catalogo_id(
                    CentroCosto, factura_data.c_costo, "nombre"
                )
            if factura_data.c_operacion and not datos.get("centro_operacion_id"):
                datos["centro_operacion_id"] = await self._resolver_catalogo_id(
                    CentroOperacion, factura_data.c_operacion, "nombre"
                )
            if factura_data.unidad_negocio and not datos.get("unidad_negocio_id"):
                datos["unidad_negocio_id"] = await self._resolver_catalogo_id(
                    UnidadNegocio, factura_data.unidad_negocio, "descripcion"
                )

        factura = await self.repository.create(datos)

        # Distribución CC/CO de la orden de compra (múltiples líneas con %)
        distribucion_creada = False
        if factura_data.distribucion and self.db:
            distribucion_creada = await self._crear_distribucion_oc(factura, factura_data.distribucion)

        # Distribución implícita: si no vino tabla pero la OC trae CC + CO de
        # cabecera, crear una sola línea al 100% para que Contabilidad vea la
        # tabla de distribución llena sin trabajo extra en N8N.
        if (
            not distribucion_creada
            and self.db
            and factura.numero_oc
            and factura.centro_costo_id
            and factura.centro_operacion_id
        ):
            distribucion_creada = await self._crear_distribucion_unica(factura)

        # Auto-ruteo OC: si la factura trae orden de compra y los datos que el
        # responsable llenaría a mano (CC + CO en cabecera, o distribución
        # completa), salta directo a Contabilidad. Las que no cumplen siguen
        # el flujo normal (Radicación → responsable).
        auto_ruteada = await self._auto_rutear_a_contabilidad(factura, distribucion_creada)

        # Si viene xml_content, ejecutar asignación automática de área por IA
        # (solo para las que siguen el flujo normal)
        if factura_data.xml_content and self.db and not auto_ruteada:
            await self._asignar_area_ia(factura, factura_data.xml_content)

        return await self.get_factura(factura.id)

    async def _auto_rutear_a_contabilidad(self, factura, distribucion_creada: bool = False) -> bool:
        """Evalúa la regla de auto-ruteo OC y, si aplica, envía la factura
        directo a Contabilidad al momento de crearla.

        Regla: numero_oc presente + clasificación contable completa (CC + CO
        en cabecera, o distribución CC/CO creada) + sin entrada de inventarios.
        area_origen_id queda en Radicación para que una devolución desde
        Contabilidad caiga allá. Controlado por el flag AUTO_RUTEO_OC.
        """
        from core.config import settings

        if not (settings.auto_ruteo_oc and self.db):
            return False
        clasificacion_completa = (
            (factura.centro_costo_id and factura.centro_operacion_id)
            or distribucion_creada
        )
        if not (
            factura.numero_oc
            and clasificacion_completa
            and not factura.requiere_entrada_inventarios
        ):
            return False

        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = CONTABILIDAD_AREA_ID_RUTEO
        factura.area_origen_id = RADICACION_AREA_ID
        factura.estado_id = ESTADO_PENDIENTE_CONTABILIDAD
        factura.fecha_envio_contabilidad = datetime.utcnow()
        factura.enrutada_automaticamente = True
        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_ENVIO_CONTABILIDAD,
            area_desde_id=area_previa,
            area_hasta_id=CONTABILIDAD_AREA_ID_RUTEO,
            estado_desde_id=estado_previo,
            estado_hasta_id=ESTADO_PENDIENTE_CONTABILIDAD,
            motivo="Auto-ruteo por OC: la factura llegó con OC y clasificación completa.",
        )
        await self.db.commit()
        await self.db.refresh(factura)

        logger.info(
            f"Auto-ruteo OC: factura {factura.numero_factura} ({factura.proveedor}) "
            f"con OC {factura.numero_oc} enviada directo a Contabilidad."
        )
        return True

    async def _crear_distribucion_oc(self, factura, items) -> bool:
        """Crea las filas de distribución CC/CO enviadas por N8N desde la OC.

        Todo-o-nada: si alguna línea no resuelve CC o CO contra los catálogos,
        no se crea ninguna fila (la factura sigue el flujo normal y el
        responsable la completa a mano). Acepta `porcentaje` directo o `valor`
        en pesos (se convierte a % del total de la distribución); los
        porcentajes se normalizan para sumar exactamente 100.
        """
        from db.models import CentroCosto, CentroOperacion, UnidadNegocio, FacturaDistribucionCCCO

        filas = []
        for item in items:
            cc_id = await self._resolver_catalogo_id(CentroCosto, item.c_costo, "nombre")
            co_id = await self._resolver_catalogo_id(CentroOperacion, item.c_operacion, "nombre")
            if not (cc_id and co_id):
                logger.warning(
                    f"Distribución OC de factura {factura.numero_factura}: línea "
                    f"cc='{item.c_costo}' co='{item.c_operacion}' no resuelve; "
                    "se omite TODA la distribución."
                )
                return False
            un_id = None
            if item.unidad_negocio:
                un_id = await self._resolver_catalogo_id(UnidadNegocio, item.unidad_negocio, "descripcion")
            filas.append({"cc": cc_id, "co": co_id, "un": un_id, "pct": item.porcentaje, "valor": item.valor})

        # Derivar porcentajes: directos, por valor, o partes iguales
        if all(f["pct"] is not None for f in filas):
            pcts = [float(f["pct"]) for f in filas]
        elif all(f["valor"] is not None for f in filas):
            total_valores = sum(float(f["valor"]) for f in filas)
            if total_valores <= 0:
                logger.warning(f"Distribución OC de factura {factura.numero_factura}: valores en 0; se omite.")
                return False
            pcts = [float(f["valor"]) / total_valores * 100 for f in filas]
        elif len(filas) == 1:
            pcts = [100.0]
        else:
            logger.warning(
                f"Distribución OC de factura {factura.numero_factura}: líneas sin "
                "porcentaje ni valor consistentes; se omite."
            )
            return False

        # Normalizar redondeo para que la suma sea exactamente 100
        pcts = [round(p, 2) for p in pcts]
        diferencia = round(100.0 - sum(pcts), 2)
        if abs(diferencia) > 5:
            logger.warning(
                f"Distribución OC de factura {factura.numero_factura}: los "
                f"porcentajes suman {sum(pcts)}%; se omite la distribución."
            )
            return False
        pcts[-1] = round(pcts[-1] + diferencia, 2)

        for f, pct in zip(filas, pcts):
            self.db.add(FacturaDistribucionCCCO(
                factura_id=factura.id,
                centro_costo_id=f["cc"],
                centro_operacion_id=f["co"],
                unidad_negocio_id=f["un"],
                porcentaje=pct,
            ))
        await self.db.commit()

        logger.info(
            f"Distribución OC creada para factura {factura.numero_factura}: "
            f"{len(filas)} línea(s), porcentajes={pcts}."
        )
        return True

    async def _crear_distribucion_unica(self, factura) -> bool:
        """Crea una distribución de una sola línea (100%) con el CC/CO/UN de
        cabecera de la factura. Usado cuando la OC no trae tabla de distribución."""
        from db.models import FacturaDistribucionCCCO

        self.db.add(FacturaDistribucionCCCO(
            factura_id=factura.id,
            centro_costo_id=factura.centro_costo_id,
            centro_operacion_id=factura.centro_operacion_id,
            unidad_negocio_id=factura.unidad_negocio_id,
            porcentaje=100,
        ))
        await self.db.commit()
        logger.info(
            f"Distribución única (100%) creada para factura {factura.numero_factura} "
            "con el CC/CO de cabecera."
        )
        return True

    async def _resolver_catalogo_id(self, model, texto: str, campo_nombre: str):
        """Busca un registro de catálogo por código o nombre (sin distinguir mayúsculas).

        Retorna el id si hay match exacto; None (con warning) si no existe.
        """
        from sqlalchemy import select, func, or_
        texto = texto.strip()
        campo = getattr(model, campo_nombre)
        condiciones = [
            func.upper(model.codigo) == texto.upper(),
            func.upper(campo) == texto.upper(),
        ]
        # N8N suele tratar códigos como número y les quita los ceros iniciales
        # ("0801" llega como "801"): comparar también sin ceros a la izquierda.
        if texto.isdigit():
            condiciones.append(func.ltrim(model.codigo, "0") == texto.lstrip("0"))
        result = await self.db.execute(
            select(model.id)
            .where(or_(*condiciones))
            .limit(1)
        )
        encontrado = result.scalar_one_or_none()
        if not encontrado:
            logger.warning(
                f"{model.__name__} '{texto}' no encontrado en catálogo; "
                "la factura se guarda sin ese vínculo."
            )
        return encontrado

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
            area_previa = factura.area_id
            factura.area_id = area_asignada.id
            if area_previa != area_asignada.id:
                await self.registrar_movimiento(
                    factura_id=factura.id,
                    tipo=MOV_ASIGNACION,
                    area_desde_id=area_previa,
                    area_hasta_id=area_asignada.id,
                    estado_desde_id=factura.estado_id,
                    estado_hasta_id=factura.estado_id,
                    motivo=f"Clasificación automática al radicar (confianza {confianza}).",
                )

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
    
    async def asignar_carpeta_tesoreria_masivo(
        self,
        carpeta_id: UUID,
        factura_ids: List[UUID],
    ) -> AsignarCarpetaTesoreriaMasivoResponse:
        """Archiva varias facturas en una carpeta de tesorería en UNA transacción.

        Antes el frontend hacía una petición por factura, todas en paralelo. Con
        lotes grandes parte de esas peticiones moría antes de llegar al servidor
        y el usuario quedaba sin saber cuáles faltaban. Aquí entra una sola
        petición, se resuelve con un UPDATE y se devuelve el detalle de lo que no
        se pudo archivar.
        """
        from sqlalchemy import select, update as sa_update
        from db.models import CarpetaTesoreria, Factura

        logger.info(
            f"Archivado masivo: {len(factura_ids)} facturas a carpeta de tesorería {carpeta_id}"
        )

        carpeta_result = await self.db.execute(
            select(CarpetaTesoreria).where(CarpetaTesoreria.id == carpeta_id)
        )
        carpeta = carpeta_result.scalar_one_or_none()
        if not carpeta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Carpeta de tesorería con ID {carpeta_id} no encontrada",
            )

        # Preservar el orden de llegada pero sin repetidos.
        ids_unicos = list(dict.fromkeys(factura_ids))

        existentes_result = await self.db.execute(
            select(Factura.id).where(Factura.id.in_(ids_unicos))
        )
        ids_existentes = {row[0] for row in existentes_result}

        no_archivadas = [
            FacturaNoArchivadaOut(factura_id=fid, motivo="La factura ya no existe en el sistema")
            for fid in ids_unicos
            if fid not in ids_existentes
        ]

        archivadas = 0
        if ids_existentes:
            await self.db.execute(
                sa_update(Factura)
                .where(Factura.id.in_(list(ids_existentes)))
                .values(carpeta_tesoreria_id=carpeta_id)
                .execution_options(synchronize_session=False)
            )
            await self.db.commit()
            archivadas = len(ids_existentes)

        if no_archivadas:
            logger.warning(
                f"Archivado masivo: {archivadas} archivadas, {len(no_archivadas)} sin archivar"
            )

        return AsignarCarpetaTesoreriaMasivoResponse(
            carpeta_id=carpeta_id,
            carpeta_nombre=carpeta.nombre,
            solicitadas=len(ids_unicos),
            archivadas=archivadas,
            no_archivadas=no_archivadas,
        )

    async def update_factura(
        self,
        factura_id: UUID,
        factura_data: FacturaUpdate,
        user_id: Optional[UUID] = None,
    ) -> FacturaResponse:
        """Actualiza una factura.

        `user_id` es opcional porque este endpoint también lo consumen procesos
        sin sesión (ingesta): sin usuario el movimiento queda igualmente
        registrado, solo que sin autor.
        """
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
        
        # Lógica: Si se asigna un área nueva, cambiar estado a "Asignada" (estado_id = 2).
        # Excepción: si el destino es Contabilidad, el estado correcto es "Pendiente en
        # contabilidad" (3); dejarla en 2 la volvía invisible para el flujo (aparecía en
        # la bandeja de Contabilidad pero el botón Devolver rechazaba con 400).
        update_data = factura_data.model_dump(exclude_unset=True)
        if factura_data.area_id is not None and factura_data.area_id != factura.area_id:
            va_a_contabilidad = factura_data.area_id == CONTABILIDAD_AREA_ID_RUTEO
            update_data['estado_id'] = ESTADO_PENDIENTE_CONTABILIDAD if va_a_contabilidad else 2
            if va_a_contabilidad and not factura.fecha_envio_contabilidad:
                update_data['fecha_envio_contabilidad'] = datetime.utcnow()
            logger.info(
                f"Área cambiada de {factura.area_id} a {factura_data.area_id}, "
                f"estado -> {update_data['estado_id']}"
            )

            # IMPORTANTE: Si area_origen_id es NULL, establecerlo la primera vez
            # Esto guarda el área original asignada por Radicación y nunca cambia.
            # Si el primer destino es Contabilidad, el origen queda en Radicación:
            # una devolución debe caer allá, nunca en la propia Contabilidad.
            if factura.area_origen_id is None:
                update_data['area_origen_id'] = RADICACION_AREA_ID if va_a_contabilidad else factura_data.area_id
                logger.info(f"Estableciendo area_origen_id: {factura_data.area_id}")

            # Este es el pase que antes solo quedaba en el log del servidor: sin
            # esta fila, el historial tenía que adivinar cuándo llegó la factura
            # al área (y adivinaba mal, ver FacturaMovimiento en db/models.py).
            await self.registrar_movimiento(
                factura_id=factura_id,
                tipo=MOV_ENVIO_CONTABILIDAD if va_a_contabilidad else MOV_ASIGNACION,
                area_desde_id=factura.area_id,
                area_hasta_id=factura_data.area_id,
                estado_desde_id=factura.estado_id,
                estado_hasta_id=update_data['estado_id'],
                user_id=self._to_uuid(user_id),
            )

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
        factura_id: UUID,
        user_id: Optional[UUID] = None,
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
            area_previa = factura.area_id
            estado_previo = factura.estado_id
            factura.area_id = area_contabilidad.id
            factura.estado_id = estado_contabilidad.id if estado_contabilidad else 3
            factura.assigned_to_user_id = None
            factura.assigned_at = datetime.utcnow()
            factura.fecha_envio_contabilidad = datetime.utcnow()
            await self.registrar_movimiento(
                factura_id=factura.id,
                tipo=MOV_ENVIO_CONTABILIDAD,
                area_desde_id=area_previa,
                area_hasta_id=area_contabilidad.id,
                estado_desde_id=estado_previo,
                estado_hasta_id=factura.estado_id,
                user_id=self._to_uuid(user_id),
                motivo="Financiera/Compras envía a Contabilidad (sin validaciones).",
            )
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
        
        # ========== VALIDACIÓN 1 y 2: CC/CO + Intervalo (SOLO CAMINO NORMAL) ==========
        # En el camino de INVENTARIOS no se exigen CC/CO ni intervalo de entrega:
        # los reemplaza la entrada a inventarios. Esto alinea submit_responsable con
        # _faltantes_para_contabilidad y el badge "Listo".
        if not factura.requiere_entrada_inventarios:
            if factura.centro_costo_id is None:
                missing_fields.append("centro_costo_id")
            if factura.centro_operacion_id is None:
                missing_fields.append("centro_operacion_id")
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
        
        # Estado canónico "Pendiente en contabilidad" (id=3), igual que el camino
        # manual (asignaciones/repository fija estado_id=3) y el camino Financiera.
        # NO usar ILIKE '%pendiente%': sin ORDER BY puede devolver id=4 ('Pendiente')
        # o id=7 ('Pendiente en Tesoreria'), dejando la factura en un estado que NO
        # es asignable a Tesorería (validate_factura_assignable_state exige 1,2,3).
        estado_result = await self.db.execute(
            select(Estado).where(Estado.id == 3)
        )
        estado_contabilidad = estado_result.scalar_one_or_none()

        if not estado_contabilidad:
            # Fallback: buscar por ID si existe un catálogo fijo
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Estado para CONTABILIDAD no encontrado en el sistema"
            )
        
        # Guardar área del responsable como origen para poder devolver correctamente
        factura.area_origen_id = factura.area_id

        # Actualizar factura
        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = area_contabilidad.id
        factura.estado_id = estado_contabilidad.id
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()
        factura.fecha_envio_contabilidad = datetime.utcnow()

        # Limpiar motivo de devolución al reenviar
        factura.motivo_devolucion = None

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_ENVIO_CONTABILIDAD,
            area_desde_id=area_previa,
            area_hasta_id=area_contabilidad.id,
            estado_desde_id=estado_previo,
            estado_hasta_id=factura.estado_id,
            user_id=self._to_uuid(user_id),
            motivo="El responsable validó los datos y envió la factura a Contabilidad.",
        )

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
            es_gasto_adm=factura.es_gasto_adm,
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
            es_activo_fijo=factura.es_activo_fijo,
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

    @staticmethod
    def _faltantes_para_contabilidad(factura, codigos, files) -> list:
        """
        Devuelve la lista de requisitos que le FALTAN a una factura para enviarse
        a Contabilidad (vacía = "Lista"). Mismas reglas que `getMissingItems` en el
        frontend. NO exige nota de crédito.

        Hay DOS caminos excluyentes:

        A) CAMINO INVENTARIOS (requiere_entrada_inventarios = true):
           - Solo datos de inventarios según destino (Tienda u Almacén):
             destino + códigos requeridos con longitud correcta (+NP si hay novedad).
           - Aparte, aprobación dual (solo Almacén): si se inició, debe estar completa.
           - NO se exige CC/CO, intervalo, OC/OS ni aprobación de gerencia simple.

        B) CAMINO NORMAL (sin inventarios):
           - Centro de Costo y Centro de Operación.
           - Intervalo de entrega a Contabilidad.
           - Si NO es gasto administrativo: archivo OC u OS + Aprobación de Gerencia.

        `codigos` y `files` deben venir ya cargados (eager) para evitar lazy-loads.
        """
        faltan = []

        # Anticipo (consistencia; la BD ya lo garantiza vía CheckConstraint)
        if factura.tiene_anticipo and factura.porcentaje_anticipo is None:
            faltan.append("porcentaje_anticipo")

        # ── CAMINO A: INVENTARIOS ──────────────────────────────────────────────
        if factura.requiere_entrada_inventarios:
            if not factura.destino_inventarios:
                faltan.append("destino_inventarios")
            else:
                codigos_set = {c.codigo for c in codigos}
                requeridos = (
                    {"OCT", "ECT", "FPC"} if factura.destino_inventarios == "TIENDA"
                    else {"OCC", "EDO", "FPC"}
                )
                if factura.presenta_novedad:
                    requeridos.add("NP")
                faltan_codigos = requeridos - codigos_set
                if faltan_codigos:
                    faltan.append(f"codigos_faltantes={sorted(faltan_codigos)}")
                # Longitud/formato de cada código (OCT/ECT/OCC/EDO = 5, FPC = 7)
                LONGITUDES = {"OCT": 5, "ECT": 5, "OCC": 5, "EDO": 5, "FPC": 7}
                mal_formato = sorted({
                    c.codigo for c in codigos
                    if LONGITUDES.get(c.codigo) is not None
                    and len((c.valor or "").strip()) != LONGITUDES[c.codigo]
                })
                if mal_formato:
                    faltan.append(f"longitud_incorrecta={mal_formato}")
            # Aprobación dual (solo Almacén): si se inició, debe estar completa
            if factura.destino_inventarios == "ALMACEN":
                if factura.fecha_envio_aprobacion_ops and not factura.fecha_aprobacion_ops:
                    faltan.append("aprobacion_ops")
                if factura.fecha_envio_aprobacion_calidad and not factura.fecha_aprobacion_calidad:
                    faltan.append("aprobacion_calidad")
            return faltan

        # ── CAMINO B: NORMAL (sin inventarios) ─────────────────────────────────
        if factura.centro_costo_id is None:
            faltan.append("centro_costo_id")
        if factura.centro_operacion_id is None:
            faltan.append("centro_operacion_id")
        if not factura.intervalo_entrega_contabilidad:
            faltan.append("intervalo_entrega_contabilidad")
        if not factura.es_gasto_adm:
            doc_types = {f.doc_type for f in files}
            if "OC" not in doc_types and "OS" not in doc_types:
                faltan.append("archivo_OC_OS")
            if not factura.fecha_aprobacion_email:
                faltan.append("aprobacion_gerencia")

        return faltan

    _LABELS_FALTANTES = {
        "porcentaje_anticipo": "Porcentaje de anticipo",
        "centro_costo_id": "Centro de Costo (CC)",
        "centro_operacion_id": "Centro de Operación (CO)",
        "intervalo_entrega_contabilidad": "Intervalo de entrega a Contabilidad",
        "archivo_OC_OS": "Archivo OC u OS",
        "destino_inventarios": "Destino de inventarios (Tienda / Almacén)",
    }

    async def _validar_datos_antes_de_aprobacion(self, factura, excluir: set) -> None:
        """
        La solicitud de aprobación a gerencia debe ser el ÚLTIMO paso del
        Responsable: exige que el resto del checklist de Contabilidad ya esté
        guardado, para que al llegar la aprobación el auto-envío pase completo.
        `excluir` son los requisitos de aprobación que este mismo envío resolverá.
        """
        from sqlalchemy import select
        from db.models import File, FacturaInventarioCodigo

        files = (await self.db.execute(
            select(File).where(File.factura_id == factura.id)
        )).scalars().all()
        codigos = (await self.db.execute(
            select(FacturaInventarioCodigo).where(FacturaInventarioCodigo.factura_id == factura.id)
        )).scalars().all()

        faltan = [
            f for f in self._faltantes_para_contabilidad(factura, codigos, files)
            if f not in excluir
        ]
        if not faltan:
            return

        legibles = []
        for f in faltan:
            if f.startswith("codigos_faltantes="):
                legibles.append(f"Códigos de inventario ({f.split('=', 1)[1]})")
            elif f.startswith("longitud_incorrecta="):
                legibles.append(f"Longitud de códigos ({f.split('=', 1)[1]})")
            else:
                legibles.append(self._LABELS_FALTANTES.get(f, f))
        raise HTTPException(
            status_code=400,
            detail=(
                "La solicitud de aprobación a gerencia es el último paso. "
                "Antes completa y guarda: " + "; ".join(legibles) + "."
            ),
        )

    async def auto_enviar_listas_a_contabilidad(
        self, area_id: UUID, user_id: Optional[UUID] = None
    ) -> list[dict]:
        """
        Barrido automático: envía a Contabilidad TODAS las facturas del área del
        Responsable que ya estén "Listas" (mismas reglas que el badge visible).

        Garantías:
        - Solo se envían facturas que cumplen el checklist completo (`_factura_lista_para_contabilidad`).
        - La transición usa la lógica canónica `submit_responsable` (fija
          fecha_envio_contabilidad, area_origen_id, estado y limpia devolución).
        - Idempotente: una vez enviada, la factura cambia de área y deja de ser candidata.

        Retorna la lista de facturas efectivamente enviadas.
        """
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from db.models import Factura

        result = await self.db.execute(
            select(Factura)
            .options(
                selectinload(Factura.inventario_codigos),
                selectinload(Factura.files),
            )
            .where(Factura.area_id == area_id)
        )
        candidatas = result.scalars().all()

        # Primer paso: decidir cuáles están listas mientras las relaciones siguen
        # cargadas (antes de cualquier commit que expire los objetos).
        listas: list[tuple] = []
        for f in candidatas:
            if not self._faltantes_para_contabilidad(f, f.inventario_codigos, f.files):
                listas.append((f.id, f.numero_factura, f.proveedor))

        # Segundo paso: ejecutar la transición canónica por cada factura lista.
        enviadas: list[dict] = []
        for fid, numero, proveedor in listas:
            try:
                await self.submit_responsable(fid, user_id=user_id)
                enviadas.append({
                    "id": str(fid),
                    "numero_factura": numero,
                    "proveedor": proveedor,
                })
            except HTTPException as e:
                logger.warning(f"Auto-envío omitió factura {numero}: {getattr(e, 'detail', e)}")
            except Exception as e:
                logger.error(f"Auto-envío falló para factura {numero}: {e}")
                await self.db.rollback()

        if enviadas:
            logger.info(f"Auto-envío a Contabilidad: {len(enviadas)} factura(s) enviada(s) del área {area_id}.")
        return enviadas

    async def submit_tesoreria(
        self, factura_id: UUID, user_id: Optional[UUID] = None
    ) -> SubmitResponsableOut:
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
        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = TESORERIA_AREA_ID
        factura.estado_id = TESORERIA_ESTADO_ID
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()
        factura.fecha_envio_tesoreria = datetime.utcnow()

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_ENVIO_TESORERIA,
            area_desde_id=area_previa,
            area_hasta_id=TESORERIA_AREA_ID,
            estado_desde_id=estado_previo,
            estado_hasta_id=TESORERIA_ESTADO_ID,
            user_id=self._to_uuid(user_id),
            motivo="Contabilidad auditó la factura y la envió a Tesorería para pago.",
        )

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
            es_activo_fijo=factura.es_activo_fijo,
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
    
    async def submit_gadmin_tesoreria(
        self, factura_id: UUID, user_id: Optional[UUID] = None
    ) -> SubmitResponsableOut:
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

        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = TESORERIA_AREA_ID
        factura.estado_id = TESORERIA_ESTADO_ID
        factura.assigned_to_user_id = None
        factura.assigned_at = datetime.utcnow()

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_ENVIO_TESORERIA,
            area_desde_id=area_previa,
            area_hasta_id=TESORERIA_AREA_ID,
            estado_desde_id=estado_previo,
            estado_hasta_id=TESORERIA_ESTADO_ID,
            user_id=self._to_uuid(user_id),
            motivo="Gastos Fijos envía directo a Tesorería (sin pasar por Contabilidad).",
        )

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
            es_activo_fijo=factura.es_activo_fijo,
            files=[],
        )

    async def close_tesoreria(
        self, factura_id: UUID, user_id: Optional[UUID] = None
    ) -> SubmitResponsableOut:
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
        estado_previo = factura.estado_id
        factura.estado_id = ESTADO_FINALIZADO_ID
        factura.fecha_cierre = datetime.utcnow()

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_CIERRE,
            area_desde_id=factura.area_id,
            area_hasta_id=factura.area_id,
            estado_desde_id=estado_previo,
            estado_hasta_id=ESTADO_FINALIZADO_ID,
            user_id=self._to_uuid(user_id),
            motivo="Tesorería cerró el proceso de la factura.",
        )

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
            es_activo_fijo=factura.es_activo_fijo,
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
        
        # Validar que esté en estado Contabilidad (estado_id = 3). Se acepta también
        # una factura en estado 2 cuyo ÁREA ya es Contabilidad: son facturas movidas
        # a mano con el cambio de área (que antes forzaba estado 2) y deben poder
        # devolverse igual que las demás.
        en_contabilidad = (
            factura.estado_id == ESTADO_PENDIENTE_CONTABILIDAD
            or (factura.estado_id == 2 and factura.area_id == CONTABILIDAD_AREA_ID_RUTEO)
        )
        if not en_contabilidad:
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

        # Devolver a área origen (que nunca cambia). Las auto-enrutadas por OC
        # tienen origen Radicación: allá deben quedar "Recibida", no "Asignada".
        # Guard: si el origen registrado es la propia Contabilidad (dato legado de
        # facturas asignadas directo a Contabilidad), devolver a Radicación para
        # no dejarla girando en la misma bandeja.
        area_destino = factura.area_origen_id
        if area_destino == CONTABILIDAD_AREA_ID_RUTEO:
            area_destino = RADICACION_AREA_ID
        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = area_destino
        factura.estado_id = 1 if area_destino == RADICACION_AREA_ID else 2
        factura.motivo_devolucion = motivo
        factura.devuelta_por_nombre = user_devuelve.nombre if user_devuelve else None
        factura.assigned_to_user_id = None  # Limpiar asignación específica
        factura.fecha_envio_contabilidad = None  # Limpiar: el paso no se completó

        # `facturas` no tiene columna fecha_devolucion: sin esta fila el historial
        # tenía que aproximar la fecha con updated_at, que se corre con cualquier
        # edición posterior. Aquí queda el momento exacto y quién devolvió.
        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_DEVOLUCION,
            area_desde_id=area_previa,
            area_hasta_id=area_destino,
            estado_desde_id=estado_previo,
            estado_hasta_id=factura.estado_id,
            user_id=self._to_uuid(user_id),
            motivo=motivo,
        )

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
        Devuelve una factura de Responsable al área de Radicación.
        Solo permitido si la factura está en estado de Responsable (estado_id = 2).
        Asigna al usuario de Radicación y cambia estado a "Recibida" (estado_id = 1).
        """
        from sqlalchemy import select
        from db.models import Factura, Estado, Area, User
        
        logger.info(f"Devolviendo factura {factura_id} a Radicación. Motivo: {motivo}")
        
        # ID del usuario de Radicación (Marlin CQ)
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
                detail=f"La factura debe estar en estado 'Asignada' (Responsable) para poder devolverla a Radicación. Estado actual: {estado_actual.label if estado_actual else 'Desconocido'}"
            )
        
        # Buscar área de Radicación por código 'fact'
        result_area = await self.db.execute(
            select(Area).where(Area.code == 'fact')
        )
        area_facturacion = result_area.scalar_one_or_none()
        
        if not area_facturacion:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se encontró el área de Radicación en el sistema"
            )
        
        # Verificar que el usuario de Radicación existe
        result_user = await self.db.execute(
            select(User).where(User.id == FACTURACION_USER_ID)
        )
        user_facturacion = result_user.scalar_one_or_none()
        
        if not user_facturacion:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se encontró el usuario de Radicación en el sistema"
            )
        
        # Capturar nombre del usuario que devuelve
        result_user_devuelve = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user_devuelve = result_user_devuelve.scalar_one_or_none()

        # Devolver a Radicación
        area_previa = factura.area_id
        estado_previo = factura.estado_id
        factura.area_id = area_facturacion.id
        factura.estado_id = 1  # Estado "Recibida" (vuelve a Radicación)
        factura.motivo_devolucion = motivo
        factura.devuelta_por_nombre = user_devuelve.nombre if user_devuelve else None
        factura.assigned_to_user_id = FACTURACION_USER_ID  # Asignar específicamente a Marlin CQ

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_DEVOLUCION,
            area_desde_id=area_previa,
            area_hasta_id=area_facturacion.id,
            estado_desde_id=estado_previo,
            estado_hasta_id=1,
            user_id=self._to_uuid(user_id),
            motivo=motivo,
        )

        await self.db.commit()
        await self.db.refresh(factura)
        
        # Obtener nombre del estado actual
        result_estado = await self.db.execute(
            select(Estado).where(Estado.id == factura.estado_id)
        )
        estado = result_estado.scalar_one_or_none()
        
        logger.info(
            f"Factura {factura_id} devuelta exitosamente a Radicación (Usuario: {user_facturacion.nombre})"
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

    async def devolver_a_tesoreria_sin_pagar(
        self, factura_id: UUID, user_id: Optional[UUID] = None
    ) -> dict:
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

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_DEVOLUCION,
            area_desde_id=factura.area_id,
            area_hasta_id=factura.area_id,
            estado_desde_id=PAGADA_ESTADO_ID,
            estado_hasta_id=TESORERIA_ESTADO_ID,
            user_id=self._to_uuid(user_id),
            motivo="Reversión de pago: la factura vuelve a Pendiente en Tesorería.",
        )

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

        # La aprobación es el último paso: el resto de datos debe estar guardado.
        await self._validar_datos_antes_de_aprobacion(factura, excluir={"aprobacion_gerencia"})

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
        # Una solicitud nueva deja sin efecto el rechazo anterior: si no se limpia,
        # la factura seguiría mostrando el aviso de rechazo ya resuelto.
        self._limpiar_rechazo_email(factura)
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
                    # Primero: buscar el archivo cuyo nombre coincida con el número de factura
                    numero_norm = factura.numero_factura.upper()
                    match_by_name = next(
                        (f for f in s3_files if numero_norm in f["filename"].upper()),
                        None,
                    )
                    if match_by_name:
                        chosen = match_by_name
                        logger.info(f"PDF seleccionado por nombre de factura: {chosen['key']}")
                    else:
                        # Fallback: usar el archivo más antiguo (el subido cuando se creó la factura)
                        s3_files.sort(key=lambda f: f.get("last_modified", ""))
                        chosen = s3_files[0]
                        if len(s3_files) > 1:
                            logger.warning(
                                f"S3 prefix {s3_prefix} tiene {len(s3_files)} archivos; "
                                f"usando el más antiguo: {chosen['filename']}"
                            )
                        logger.info(f"PDF encontrado en S3 via fallback (más antiguo): {chosen['key']}")
                    pdf_bytes, _ = await asyncio.to_thread(
                        s3_service.get_file_with_metadata, chosen["key"]
                    )
                    pdf_filename = chosen["filename"]
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

    @staticmethod
    def _limpiar_rechazo_email(factura) -> None:
        """Borra el rechazo vigente de una factura (al pedir una aprobación nueva)."""
        factura.fecha_rechazo_email = None
        factura.rechazado_por_nombre = None
        factura.rechazado_por_email = None
        factura.motivo_rechazo_email = None
        factura.tipo_rechazo_email = None

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
        token_obj.resultado = "aprobado"

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

    async def rechazar_por_token(self, token_str: str, motivo: str, ip: str) -> dict:
        """Rechaza una factura desde el correo, con el motivo que escribió el aprobador.

        Sirve para los dos correos de aprobación: el de Gerencia (token sin
        `tipo_aprobacion`) y el dual (`OPS` / `CALIDAD`). En el dual basta que UNO
        de los dos rechace para frenar la factura.

        La factura NO cambia de área: mientras espera aprobación sigue en el área
        del responsable que la envió (enviar_correo_aprobacion no la mueve), así
        que ya está donde debe quedar. Lo que sí se limpia es la marca de envío a
        aprobación, para que el responsable pueda corregir y volver a enviarla.
        """
        from datetime import timezone
        from sqlalchemy import select
        from db.models import Factura, TokenAprobacionFactura
        from core.email_service import email_service

        motivo = (motivo or "").strip()
        if len(motivo) < 5:
            raise HTTPException(
                status_code=400,
                detail="Indique el motivo del rechazo (mínimo 5 caracteres).",
            )

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
            raise HTTPException(status_code=400, detail="El enlace ha expirado (72 horas).")

        result_f = await self.db.execute(
            select(Factura).where(Factura.id == token_obj.factura_id)
        )
        factura = result_f.scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")

        token_obj.usado = True
        token_obj.usado_at = now_utc
        token_obj.usado_por_ip = ip
        token_obj.resultado = "rechazado"
        token_obj.motivo_rechazo = motivo

        tipo = token_obj.tipo_aprobacion  # None | 'OPS' | 'CALIDAD'
        factura.fecha_rechazo_email = now_utc
        factura.rechazado_por_nombre = token_obj.aprobador_nombre
        factura.rechazado_por_email = token_obj.aprobador_email
        factura.motivo_rechazo_email = motivo
        factura.tipo_rechazo_email = tipo

        # Devolver la solicitud a cero para que se pueda corregir y reenviar.
        if tipo == "OPS":
            factura.fecha_envio_aprobacion_ops = None
            factura.fecha_aprobacion_ops = None
        elif tipo == "CALIDAD":
            factura.fecha_envio_aprobacion_calidad = None
            factura.fecha_aprobacion_calidad = None
        else:
            factura.fecha_envio_gerencia = None
            factura.fecha_aprobacion_email = None

        etiqueta = {
            "OPS": "Gerencia Operaciones",
            "CALIDAD": "Calidad Café",
        }.get(tipo, "Gerencia")

        await self.registrar_movimiento(
            factura_id=factura.id,
            tipo=MOV_RECHAZO_EMAIL,
            area_desde_id=factura.area_id,
            area_hasta_id=factura.area_id,
            estado_desde_id=factura.estado_id,
            estado_hasta_id=factura.estado_id,
            motivo=f"Rechazada por {token_obj.aprobador_nombre} ({etiqueta}): {motivo}",
        )

        await self.db.commit()
        await self.db.refresh(factura)

        # Avisar a quien la envió: sin este correo el rechazo solo se vería si
        # alguien entra a la factura.
        try:
            destinatarios = [
                r["email"] for r in await self._buscar_responsables_area(factura.area_id)
                if r.get("email")
            ]
            if destinatarios:
                await email_service.enviar_notificacion_factura_rechazada(
                    factura=factura,
                    destinatarios=destinatarios,
                    rechazado_por=token_obj.aprobador_nombre,
                    etiqueta_aprobacion=etiqueta,
                    motivo=motivo,
                )
        except Exception as e:  # el rechazo ya quedó guardado; el correo es secundario
            logger.error(f"No se pudo notificar el rechazo de {factura.numero_factura}: {e}")

        logger.info(
            f"Factura {factura.numero_factura} RECHAZADA por {token_obj.aprobador_nombre} "
            f"({etiqueta}). Motivo: {motivo}"
        )
        return {
            "factura_id": str(factura.id),
            "numero_factura": factura.numero_factura,
            "proveedor": factura.proveedor,
            "total": float(factura.total),
            "rechazado_por_nombre": factura.rechazado_por_nombre,
            "rechazado_por_email": factura.rechazado_por_email,
            "fecha_rechazo_email": factura.fecha_rechazo_email,
            "motivo_rechazo": motivo,
            "tipo_aprobacion": tipo,
        }

    async def historial_area(self, user_id: UUID) -> list:
        """
        Retorna el historial de facturas del área del usuario responsable.

        Una factura pertenece al historial del área X solo si:
          A) está ACTUALMENTE en X (bandeja activa o devuelta aquí), o
          B) X la procesó y la envió HACIA ADELANTE: area_origen_id == X y la factura
             ya avanzó a Contabilidad/Tesorería/Pagada (estado 3/7/5).

        Importante: NO se usan las asignaciones históricas (factura_asignaciones). Esa
        estrategia mantenía en el historial facturas que fueron REASIGNADAS a otro
        responsable (p. ej. Trade → Marketing), dejándolas visibles en el área anterior.
        Con A+B, al reasignarse a otro responsable la factura desaparece del historial
        del área previa, pero las que avanzaron en el flujo se conservan.
        """
        from sqlalchemy import select
        from db.models import User, Factura

        # Estados "avanzados" (la factura ya salió del responsable hacia el flujo contable):
        # 3=Pendiente en contabilidad, 7=Pendiente en Tesorería, 5=Pagada.
        ESTADOS_AVANZADOS = (3, 5, 7)

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.area_id:
            return []

        area_id = user.area_id
        fecha_por_factura: dict = {}

        # Estrategia A: facturas actualmente en el área
        current_result = await self.db.execute(
            select(Factura.id, Factura.assigned_at)
            .where(Factura.area_id == area_id)
        )
        for row in current_result.all():
            fid = row.id
            if fid not in fecha_por_factura:
                fecha_por_factura[fid] = row.assigned_at

        # Estrategia B: facturas que el área originó y ya avanzaron en el flujo
        origen_result = await self.db.execute(
            select(Factura.id, Factura.assigned_at)
            .where(Factura.area_origen_id == area_id)
            .where(Factura.estado_id.in_(ESTADOS_AVANZADOS))
        )
        for row in origen_result.all():
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

    async def historial_factura(self, factura_id: UUID) -> dict:
        """
        Construye el historial completo de eventos de una factura.

        Incluye:
        - Recepción (created_at)
        - Asignaciones a área/responsable (factura_asignaciones)
        - Envío y aprobación por correo (Gerencia)
        - Aprobación dual (Operaciones / Calidad)
        - Hitos de flujo (envío a Contabilidad, envío a Tesorería, cierre)
        - Devolución (motivo_devolucion + devuelta_por_nombre)
        """
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from db.models import Factura, FacturaAsignacion, Area, FacturaMovimiento

        factura_q = await self.db.execute(
            select(Factura)
            .options(
                selectinload(Factura.area),
                selectinload(Factura.area_origen),
                selectinload(Factura.estado),
                selectinload(Factura.assigned_user),
                selectinload(Factura.asignaciones).selectinload(FacturaAsignacion.area),
                selectinload(Factura.asignaciones).selectinload(FacturaAsignacion.responsable),
            )
            .where(Factura.id == factura_id)
        )
        factura = factura_q.scalar_one_or_none()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada")

        FACTURACION_AREA_NAMES = {"FACTURACION", "FACTURACIÓN"}

        eventos: list[dict] = []

        if factura.created_at:
            eventos.append({
                "fecha": factura.created_at,
                "tipo": "recibida",
                "titulo": "Factura recibida en Radicación",
                "descripcion": f"Proveedor: {factura.proveedor}",
                "area_nombre": "Radicación",
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        asignaciones_ordenadas = sorted(
            factura.asignaciones or [],
            key=lambda a: a.created_at,
        )

        # Movimientos REALES (factura_movimientos): cada fila es un hecho con su
        # fecha exacta y su autor. Todo lo que ya esté aquí manda sobre los eventos
        # sintéticos de más abajo, que solo existen para las facturas anteriores a
        # la bitácora (y que aproximan la fecha a partir de otras columnas).
        movimientos = (await self.db.execute(
            select(FacturaMovimiento)
            .where(FacturaMovimiento.factura_id == factura_id)
            .order_by(FacturaMovimiento.created_at.asc())
        )).unique().scalars().all()

        TITULOS_MOV = {
            MOV_ENVIO_CONTABILIDAD: "Enviada a Contabilidad",
            MOV_ENVIO_TESORERIA: "Enviada a Tesorería",
            MOV_CIERRE: "Factura pagada / cerrada",
        }
        for mov in movimientos:
            destino = mov.area_hasta.nombre if mov.area_hasta else None
            origen = mov.area_desde.nombre if mov.area_desde else None

            if mov.tipo == MOV_ASIGNACION:
                titulo = f"Asignada a {destino}" if destino else "Asignada"
            elif mov.tipo == MOV_DEVOLUCION:
                titulo = f"Devuelta a {destino}" if destino else "Devolución registrada"
            elif mov.tipo == MOV_RECHAZO_EMAIL:
                titulo = "Rechazada en la aprobación por correo"
            else:
                titulo = TITULOS_MOV.get(mov.tipo, "Movimiento registrado")

            partes = []
            if origen and destino and origen != destino:
                partes.append(f"Desde {origen}.")
            if mov.motivo:
                partes.append(mov.motivo)
            # Sin autor no se afirma nada: puede ser un proceso automático o un
            # movimiento anterior a la bitácora, y el motivo ya lo aclara.
            if mov.user_nombre:
                partes.append(f"Registrado por {mov.user_nombre}.")

            eventos.append({
                "fecha": mov.created_at,
                "tipo": mov.tipo,
                "titulo": titulo,
                "descripcion": " ".join(partes),
                "area_nombre": destino,
                "area_id": mov.area_hasta_id,
                "responsable_nombre": mov.user_nombre,
                "responsable_email": None,
            })

        # Qué quedó ya cubierto por un hecho registrado: los bloques sintéticos de
        # más abajo se saltan para no duplicar el evento ni contradecir su fecha.
        areas_con_movimiento = {m.area_hasta_id for m in movimientos if m.area_hasta_id}
        tipos_con_movimiento = {m.tipo for m in movimientos}

        for asig in asignaciones_ordenadas:
            eventos.append({
                "fecha": asig.created_at,
                "tipo": "asignacion",
                "titulo": f"Asignada a {asig.area.nombre if asig.area else 'área'}",
                "descripcion": (
                    f"Responsable: {asig.responsable.nombre}"
                    if asig.responsable else None
                ),
                "area_nombre": asig.area.nombre if asig.area else None,
                "area_id": asig.area_id,
                "responsable_nombre": asig.responsable.nombre if asig.responsable else None,
                "responsable_email": asig.responsable.email if asig.responsable else None,
            })

        # Fallback: facturas ingestadas vía XML o cargadas históricamente que tienen
        # area_id distinto a Radicación pero ninguna fila en factura_asignaciones.
        # Surfaceamos el "asignada" sintético para que el director pueda ver dónde está.
        area_actual_nombre = (factura.area.nombre if factura.area else "") or ""
        es_area_facturacion = area_actual_nombre.upper() in FACTURACION_AREA_NAMES
        ya_registrada = any(
            a.area_id == factura.area_id for a in asignaciones_ordenadas
        )
        # `motivo_devolucion` solo se limpia al reenviar a Contabilidad (submit_responsable);
        # si la factura avanzó a Tesorería o se cerró, el motivo queda como dato viejo.
        # Solo tratamos la devolución como vigente cuando la factura no ha vuelto a avanzar:
        # de lo contrario fecharíamos un regreso que ya no es cierto.
        devolucion_vigente = bool(factura.motivo_devolucion) and not (
            factura.fecha_envio_contabilidad
            or factura.fecha_envio_tesoreria
            or factura.fecha_cierre
        )

        # `assigned_at` es un único campo de la factura, no uno por área: cuando la
        # última fila de factura_asignaciones apunta a OTRA área, esa marca pertenece
        # a esa asignación y no a la llegada al área actual. Fecharla aquí hacía que
        # el área actual apareciera con la hora de un movimiento ajeno.
        ultima_asignacion = asignaciones_ordenadas[-1] if asignaciones_ordenadas else None
        assigned_at_es_del_area_actual = (
            factura.assigned_at is not None
            and (ultima_asignacion is None or ultima_asignacion.area_id == factura.area_id)
        )

        # Si la factura volvió al área por una devolución, el evento de devolución ya
        # registra ese regreso con su fecha: no inventamos además una "asignación".
        evento_area_actual_emitido = False
        if (
            factura.area_id
            and not es_area_facturacion
            and not ya_registrada
            and not devolucion_vigente
            and factura.area_id not in areas_con_movimiento
        ):
            resp_nombre = factura.assigned_user.nombre if factura.assigned_user else None
            resp_email = factura.assigned_user.email if factura.assigned_user else None
            if assigned_at_es_del_area_actual:
                fecha_llegada = factura.assigned_at
            elif factura.area_origen_id == factura.area_id:
                # La factura nació en esta área: llegó al momento de crearse.
                fecha_llegada = factura.created_at
            else:
                fecha_llegada = factura.fecha_envio_contabilidad or factura.updated_at
            eventos.append({
                "fecha": fecha_llegada,
                "tipo": "asignacion",
                "titulo": f"Asignada a {factura.area.nombre}" if factura.area else "Asignada",
                "descripcion": (
                    f"Responsable: {resp_nombre}"
                    if resp_nombre
                    else "A cargo del área; sin responsable nominal asignado."
                ),
                "area_nombre": factura.area.nombre if factura.area else None,
                "area_id": factura.area_id,
                "responsable_nombre": resp_nombre,
                "responsable_email": resp_email,
            })
            evento_area_actual_emitido = True

        # Si la factura pasó por un área de origen (regional) antes de Contabilidad/Tesorería
        # y NO existe fila en factura_asignaciones para esa área (caso típico de ingesta XML),
        # generamos un evento sintético para que se vea por dónde pasó la factura.
        # También aplica cuando el área de origen y la actual coinciden y arriba no se
        # emitió evento (factura devuelta a su área): así se ve cuándo llegó de verdad.
        origen_es_facturacion = (
            (factura.area_origen.nombre or "").upper() in FACTURACION_AREA_NAMES
            if factura.area_origen else False
        )
        if (
            factura.area_origen_id
            and factura.area_origen
            and not (
                factura.area_origen_id == factura.area_id
                # Origen == actual solo se dibuja si arriba no se emitió ya el evento
                # y el área no es Facturación (esa la cubre el evento "recibida").
                and (evento_area_actual_emitido or origen_es_facturacion)
            )
            and not any(a.area_id == factura.area_origen_id for a in asignaciones_ordenadas)
            and factura.area_origen_id not in areas_con_movimiento
        ):
            responsables_origen = await self._buscar_responsables_area(factura.area_origen_id)
            if responsables_origen:
                # Mostrar todos los responsables registrados del área (uno o varios)
                nombres_lista = ", ".join(r["nombre"] for r in responsables_origen)
                desc = (
                    f"Responsable del área: {nombres_lista}"
                    if len(responsables_origen) == 1
                    else f"Responsables del área ({len(responsables_origen)}): {nombres_lista}"
                )
                primer_resp = responsables_origen[0]
            else:
                desc = "Responsable del área (no registrado)."
                primer_resp = {"nombre": None, "email": None}

            eventos.append({
                "fecha": factura.created_at,
                "tipo": "asignacion",
                "titulo": f"Asignada a {factura.area_origen.nombre}",
                "descripcion": desc,
                "area_nombre": factura.area_origen.nombre,
                "area_id": factura.area_origen_id,
                "responsable_nombre": primer_resp.get("nombre"),
                "responsable_email": primer_resp.get("email"),
            })

        if factura.fecha_envio_gerencia:
            eventos.append({
                "fecha": factura.fecha_envio_gerencia,
                "tipo": "envio_gerencia",
                "titulo": "Solicitud de aprobación a Gerencia",
                "descripcion": "Correo enviado al gerente para aprobación.",
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        if factura.fecha_aprobacion_email:
            eventos.append({
                "fecha": factura.fecha_aprobacion_email,
                "tipo": "aprobacion_email",
                "titulo": "Aprobada por Gerencia (correo)",
                "descripcion": (
                    f"Aprobado por {factura.aprobado_por_nombre}"
                    if factura.aprobado_por_nombre else "Aprobación por correo recibida"
                ),
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": factura.aprobado_por_nombre,
                "responsable_email": factura.aprobado_por_email,
            })

        if factura.fecha_envio_aprobacion_ops:
            eventos.append({
                "fecha": factura.fecha_envio_aprobacion_ops,
                "tipo": "envio_aprobacion_ops",
                "titulo": "Solicitud aprobación Gerencia Operaciones",
                "descripcion": None,
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        if factura.fecha_aprobacion_ops:
            eventos.append({
                "fecha": factura.fecha_aprobacion_ops,
                "tipo": "aprobacion_ops",
                "titulo": "Aprobada por Gerencia Operaciones",
                "descripcion": (
                    f"Aprobado por {factura.aprobado_ops_nombre}"
                    if factura.aprobado_ops_nombre else None
                ),
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": factura.aprobado_ops_nombre,
                "responsable_email": factura.aprobado_ops_email,
            })

        if factura.fecha_envio_aprobacion_calidad:
            eventos.append({
                "fecha": factura.fecha_envio_aprobacion_calidad,
                "tipo": "envio_aprobacion_calidad",
                "titulo": "Solicitud aprobación Calidad Café",
                "descripcion": None,
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        if factura.fecha_aprobacion_calidad:
            eventos.append({
                "fecha": factura.fecha_aprobacion_calidad,
                "tipo": "aprobacion_calidad",
                "titulo": "Aprobada por Calidad Café",
                "descripcion": (
                    f"Aprobado por {factura.aprobado_calidad_nombre}"
                    if factura.aprobado_calidad_nombre else None
                ),
                "area_nombre": None,
                "area_id": None,
                "responsable_nombre": factura.aprobado_calidad_nombre,
                "responsable_email": factura.aprobado_calidad_email,
            })

        if factura.fecha_envio_contabilidad and MOV_ENVIO_CONTABILIDAD not in tipos_con_movimiento:
            eventos.append({
                "fecha": factura.fecha_envio_contabilidad,
                "tipo": "envio_contabilidad",
                "titulo": "Enviada a Contabilidad",
                "descripcion": "El responsable validó los datos y envió la factura a Contabilidad.",
                "area_nombre": "Contabilidad",
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        if factura.fecha_envio_tesoreria and MOV_ENVIO_TESORERIA not in tipos_con_movimiento:
            eventos.append({
                "fecha": factura.fecha_envio_tesoreria,
                "tipo": "envio_tesoreria",
                "titulo": "Enviada a Tesorería",
                "descripcion": "Contabilidad auditó la factura y la envió a Tesorería para pago.",
                "area_nombre": "Tesorería",
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        if factura.fecha_cierre and MOV_CIERRE not in tipos_con_movimiento:
            eventos.append({
                "fecha": factura.fecha_cierre,
                "tipo": "cierre",
                "titulo": "Factura pagada / cerrada",
                "descripcion": "Tesorería cerró el proceso de la factura.",
                "area_nombre": "Tesorería",
                "area_id": None,
                "responsable_nombre": None,
                "responsable_email": None,
            })

        # Rechazo desde el correo de aprobación. Normalmente ya vino como movimiento;
        # este bloque cubre el caso de que la bitácora no haya podido escribirse.
        if factura.fecha_rechazo_email and MOV_RECHAZO_EMAIL not in tipos_con_movimiento:
            etiqueta_rechazo = {
                "OPS": "Gerencia Operaciones",
                "CALIDAD": "Calidad Café",
            }.get(factura.tipo_rechazo_email, "Gerencia")
            eventos.append({
                "fecha": factura.fecha_rechazo_email,
                "tipo": MOV_RECHAZO_EMAIL,
                "titulo": "Rechazada en la aprobación por correo",
                "descripcion": (
                    f"Rechazada por {factura.rechazado_por_nombre} ({etiqueta_rechazo}): "
                    f"{factura.motivo_rechazo_email}"
                ),
                "area_nombre": factura.area.nombre if factura.area else None,
                "area_id": factura.area_id,
                "responsable_nombre": factura.rechazado_por_nombre,
                "responsable_email": factura.rechazado_por_email,
            })

        # La devolución ya no se aproxima cuando quedó registrada como movimiento:
        # esa fila trae la fecha exacta y quién la devolvió.
        if factura.motivo_devolucion and MOV_DEVOLUCION not in tipos_con_movimiento:
            if devolucion_vigente:
                # No existe columna fecha_devolucion en facturas, así que usamos
                # updated_at como mejor aproximación: mientras la factura siga devuelta,
                # la devolución es la última acción que la tocó. Si alguien la edita
                # después la fecha se corre; el arreglo definitivo es una columna propia.
                quien_recibe = factura.assigned_user.nombre if factura.assigned_user else None
                descripcion = factura.motivo_devolucion
                if quien_recibe:
                    descripcion = f"{descripcion} (queda a cargo de {quien_recibe})"
                eventos.append({
                    "fecha": factura.updated_at,
                    "tipo": "devolucion",
                    "titulo": (
                        f"Devuelta a {factura.area.nombre}"
                        if factura.area else "Devolución registrada"
                    ),
                    "descripcion": descripcion,
                    "area_nombre": factura.area.nombre if factura.area else None,
                    "area_id": factura.area_id,
                    "responsable_nombre": factura.devuelta_por_nombre,
                    "responsable_email": None,
                })
            else:
                # Devolución anterior: la factura ya volvió a avanzar. No sabemos cuándo
                # ocurrió ni a qué área, así que la dejamos sin fecha en vez de inventarla.
                eventos.append({
                    "fecha": None,
                    "tipo": "devolucion",
                    "titulo": "Devolución registrada (anterior)",
                    "descripcion": factura.motivo_devolucion,
                    "area_nombre": None,
                    "area_id": None,
                    "responsable_nombre": factura.devuelta_por_nombre,
                    "responsable_email": None,
                })

        def _sort_key(ev: dict):
            fecha = ev.get("fecha")
            if fecha is None:
                # Eventos sin fecha (ej. devolución) van al final
                return (1, 0.0)
            try:
                return (0, fecha.timestamp())
            except (OSError, OverflowError, ValueError):
                return (1, 0.0)

        eventos.sort(key=_sort_key)

        return {
            "factura_id": factura.id,
            "numero_factura": factura.numero_factura,
            "estado_actual": factura.estado.label if factura.estado else "",
            "area_actual": factura.area.nombre if factura.area else None,
            "area_actual_id": factura.area_id,
            "eventos": eventos,
        }

    async def _buscar_responsables_area(self, area_id: UUID) -> list[dict]:
        """
        Devuelve los responsables registrados en un área (rol 'responsable',
        activos). Se usa para enriquecer eventos sintéticos del historial cuando
        no existe fila en factura_asignaciones (caso ingesta XML).
        """
        from sqlalchemy import select, func
        from db.models import User, Rol

        q = (
            select(User)
            .join(Rol, Rol.id == User.role_id)
            .where(
                User.area_id == area_id,
                User.is_active.is_(True),
                func.lower(Rol.code) == "responsable",
            )
            .order_by(User.nombre.asc())
        )
        result = await self.db.execute(q)
        users = result.scalars().all()

        if not users:
            # Fallback: cualquier usuario activo del área
            q_any = (
                select(User)
                .where(User.area_id == area_id, User.is_active.is_(True))
                .order_by(User.nombre.asc())
            )
            users = (await self.db.execute(q_any)).scalars().all()

        return [{"nombre": u.nombre, "email": u.email} for u in users]

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

        # La aprobación dual es el último paso: los datos de inventarios deben estar guardados.
        await self._validar_datos_antes_de_aprobacion(
            factura, excluir={"aprobacion_ops", "aprobacion_calidad", "aprobacion_gerencia"}
        )

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
            # Solicitud nueva: el rechazo anterior deja de estar vigente.
            self._limpiar_rechazo_email(factura)

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
            # Reenvío: el rechazo anterior deja de estar vigente.
            self._limpiar_rechazo_email(factura)

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
        token_obj.resultado = "aprobado"

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

