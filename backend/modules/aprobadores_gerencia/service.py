from uuid import UUID
from typing import List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AprobadorGerencia
from modules.aprobadores_gerencia.repository import AprobadorGerenciaRepository
from modules.aprobadores_gerencia.schemas import (
    AprobadorGerenciaCreate,
    AprobadorGerenciaUpdate,
    AprobadorGerenciaOut,
)


class AprobadorGerenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AprobadorGerenciaRepository(db)

    def _to_out(self, obj: AprobadorGerencia) -> AprobadorGerenciaOut:
        return AprobadorGerenciaOut.model_validate(obj)

    async def listar_todos(self) -> List[AprobadorGerenciaOut]:
        items = await self.repo.get_all()
        return [self._to_out(i) for i in items]

    async def listar_activos(self) -> List[AprobadorGerenciaOut]:
        items = await self.repo.get_activos()
        return [self._to_out(i) for i in items]

    async def crear(self, data: AprobadorGerenciaCreate) -> AprobadorGerenciaOut:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Ya existe un aprobador con el email {data.email}."
            )
        obj = AprobadorGerencia(
            nombre=data.nombre,
            cargo=data.cargo,
            email=data.email,
            is_active=True,
        )
        obj = await self.repo.create(obj)
        await self.db.commit()
        return self._to_out(obj)

    async def actualizar(self, aprobador_id: UUID, data: AprobadorGerenciaUpdate) -> AprobadorGerenciaOut:
        obj = await self.repo.get_by_id(aprobador_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Aprobador no encontrado.")
        if data.nombre is not None:
            obj.nombre = data.nombre
        if data.cargo is not None:
            obj.cargo = data.cargo
        if data.email is not None:
            conflict = await self.repo.get_by_email(data.email)
            if conflict and conflict.id != aprobador_id:
                raise HTTPException(
                    status_code=409,
                    detail=f"El email {data.email} ya está en uso por otro aprobador."
                )
            obj.email = data.email
        await self.db.commit()
        await self.db.refresh(obj)
        return self._to_out(obj)

    async def toggle_activo(self, aprobador_id: UUID) -> AprobadorGerenciaOut:
        obj = await self.repo.get_by_id(aprobador_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Aprobador no encontrado.")
        obj.is_active = not obj.is_active
        await self.db.commit()
        await self.db.refresh(obj)
        return self._to_out(obj)

    async def eliminar(self, aprobador_id: UUID) -> None:
        obj = await self.repo.get_by_id(aprobador_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Aprobador no encontrado.")
        await self.repo.delete(obj)
        await self.db.commit()
