"""Repositorio de acceso a datos para anticipos."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Integer
from typing import Optional, Tuple, List
from uuid import UUID

from db.models import Anticipo, TokenAprobacionAnticipo


class AnticipioRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, anticipo: Anticipo) -> None:
        self.db.add(anticipo)
        await self.db.flush()

    async def save(self, anticipo: Anticipo) -> None:
        self.db.add(anticipo)
        await self.db.flush()

    async def get_by_id(self, anticipo_id: UUID) -> Optional[Anticipo]:
        result = await self.db.execute(
            select(Anticipo).where(Anticipo.id == anticipo_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self, skip: int, limit: int, estado: Optional[str] = None
    ) -> Tuple[List[Anticipo], int]:
        q = select(Anticipo).order_by(Anticipo.created_at.desc())
        if estado:
            q = q.where(Anticipo.estado == estado)
        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()
        result = await self.db.execute(q.offset(skip).limit(limit))
        return list(result.scalars().all()), total

    async def list_tesoreria(
        self, skip: int, limit: int, estado: Optional[str] = None
    ) -> Tuple[List[Anticipo], int]:
        """Lista anticipos visibles para Tesorería (aprobado, desembolsado, cerrado)."""
        estados_visibles = ['aprobado', 'desembolsado', 'cerrado']
        q = select(Anticipo).order_by(Anticipo.created_at.desc())
        if estado and estado in estados_visibles:
            q = q.where(Anticipo.estado == estado)
        else:
            q = q.where(Anticipo.estado.in_(estados_visibles))
        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()
        result = await self.db.execute(q.offset(skip).limit(limit))
        return list(result.scalars().all()), total

    async def max_folio_number_by_year(self, year: int) -> int:
        prefix = f"ANT-{year}-"
        result = await self.db.execute(
            select(func.max(
                cast(func.substr(Anticipo.folio, len(prefix) + 1), Integer)
            )).where(Anticipo.folio.like(f"{prefix}%"))
        )
        raw = result.scalar_one_or_none()
        if raw is None:
            return 0
        try:
            return int(raw)
        except Exception:
            return 0

    async def list_by_user(
        self, user_id: UUID, estado: Optional[str] = None
    ) -> List[Anticipo]:
        """Retorna los anticipos creados por un usuario específico."""
        q = (
            select(Anticipo)
            .where(Anticipo.created_by_user_id == user_id)
            .order_by(Anticipo.created_at.desc())
        )
        if estado:
            q = q.where(Anticipo.estado == estado)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    # --- Tokens ---

    async def create_token(self, token: TokenAprobacionAnticipo) -> None:
        self.db.add(token)
        await self.db.flush()

    async def get_token(self, token_str: str) -> Optional[TokenAprobacionAnticipo]:
        result = await self.db.execute(
            select(TokenAprobacionAnticipo).where(TokenAprobacionAnticipo.token == token_str)
        )
        return result.scalar_one_or_none()
