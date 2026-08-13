"""
Acceso a datos del módulo de causación Siesa FSP.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Factura, SiesaCausacion, SiesaProveedorConfig, SiesaProveedorRetencion


class SiesaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Facturas ─────────────────────────────────────────────────────────
    async def get_factura(self, factura_id: UUID) -> Optional[Factura]:
        result = await self.db.execute(select(Factura).where(Factura.id == factura_id))
        return result.scalar_one_or_none()

    # ── Mapeo por proveedor ──────────────────────────────────────────────
    async def get_config_por_nit(self, nit: str) -> Optional[SiesaProveedorConfig]:
        result = await self.db.execute(
            select(SiesaProveedorConfig).where(SiesaProveedorConfig.nit == nit)
        )
        return result.scalar_one_or_none()

    async def upsert_config(self, nit: str, campos: dict, retenciones: list[dict]) -> SiesaProveedorConfig:
        """
        Crea o actualiza el mapeo del proveedor. Las retenciones se
        reemplazan completas (delete-orphan): son la parametrización vigente
        del agente retenedor, no un histórico.
        """
        config = await self.get_config_por_nit(nit)
        if config is None:
            config = SiesaProveedorConfig(nit=nit)
            self.db.add(config)

        for campo, valor in campos.items():
            setattr(config, campo, valor)

        config.retenciones.clear()
        for ret in retenciones:
            config.retenciones.append(SiesaProveedorRetencion(**ret))

        await self.db.commit()
        await self.db.refresh(config)
        return config

    # ── Causaciones ──────────────────────────────────────────────────────
    async def get_causacion(self, causacion_id: UUID) -> Optional[SiesaCausacion]:
        result = await self.db.execute(
            select(SiesaCausacion).where(SiesaCausacion.id == causacion_id)
        )
        return result.scalar_one_or_none()

    async def get_causaciones_de_factura(self, factura_id: UUID) -> list[SiesaCausacion]:
        result = await self.db.execute(
            select(SiesaCausacion)
            .where(SiesaCausacion.factura_id == factura_id)
            .order_by(SiesaCausacion.created_at.desc())
        )
        return list(result.scalars().all())

    async def crear_causacion(self, causacion: SiesaCausacion) -> SiesaCausacion:
        self.db.add(causacion)
        await self.db.commit()
        await self.db.refresh(causacion)
        return causacion

    async def guardar(self) -> None:
        await self.db.commit()
