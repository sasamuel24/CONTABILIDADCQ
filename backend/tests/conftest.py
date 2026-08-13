"""
Configuración compartida de pytest.
"""
import pytest


@pytest.fixture
def anyio_backend():
    """Los tests async (@pytest.mark.anyio) corren solo sobre asyncio (no trio)."""
    return "asyncio"
