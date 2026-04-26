from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import AprobadorGerencia


class AprobadorGerenciaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> List[AprobadorGerencia]:
        result = await self.db.execute(
            select(AprobadorGerencia).order_by(AprobadorGerencia.nombre)
        )
        return list(result.scalars().all())

    async def get_activos(self) -> List[AprobadorGerencia]:
        result = await self.db.execute(
            select(AprobadorGerencia)
            .where(AprobadorGerencia.is_active == True)
            .order_by(AprobadorGerencia.nombre)
        )
        return list(result.scalars().all())

    async def get_by_id(self, aprobador_id: UUID) -> Optional[AprobadorGerencia]:
        result = await self.db.execute(
            select(AprobadorGerencia).where(AprobadorGerencia.id == aprobador_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[AprobadorGerencia]:
        result = await self.db.execute(
            select(AprobadorGerencia).where(AprobadorGerencia.email == email)
        )
        return result.scalar_one_or_none()

    async def create(self, aprobador: AprobadorGerencia) -> AprobadorGerencia:
        self.db.add(aprobador)
        await self.db.flush()
        await self.db.refresh(aprobador)
        return aprobador

    async def delete(self, aprobador: AprobadorGerencia) -> None:
        await self.db.delete(aprobador)
        await self.db.flush()
