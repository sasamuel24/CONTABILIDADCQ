"""Repositorio para tokens de aprobación de paquetes de gastos."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from db.models import TokenAprobacionPaquete


class TokenAprobacionRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, token: TokenAprobacionPaquete) -> TokenAprobacionPaquete:
        self.db.add(token)
        await self.db.flush()
        await self.db.refresh(token)
        return token

    async def get_by_token(self, token_str: str) -> Optional[TokenAprobacionPaquete]:
        result = await self.db.execute(
            select(TokenAprobacionPaquete).where(
                TokenAprobacionPaquete.token == token_str
            )
        )
        return result.scalar_one_or_none()
