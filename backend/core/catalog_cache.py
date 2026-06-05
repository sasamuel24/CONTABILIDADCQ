"""
Cache en memoria para tablas de catálogo que cambian raramente.
Evita que lazy="selectin" las escanee en cada request.
TTL: 5 minutos. Se invalida manualmente al crear/editar registros.
"""
import asyncio
import time
from typing import Any, Optional

_cache: dict[str, tuple[Any, float]] = {}
_TTL = 300  # segundos


def get_cached(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[1]) < _TTL:
        return entry[0]
    return None


def set_cached(key: str, value: Any) -> None:
    _cache[key] = (value, time.monotonic())


def invalidate(key: str) -> None:
    _cache.pop(key, None)


def invalidate_all() -> None:
    _cache.clear()
