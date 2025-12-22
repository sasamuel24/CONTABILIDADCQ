"""
Tests básicos para el endpoint de healthcheck.
"""
import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health_check():
    """Verifica que el endpoint de health check responde correctamente."""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "healthy"
    assert "app" in data
    assert "version" in data


def test_health_check_structure():
    """Verifica la estructura de la respuesta del health check."""
    response = client.get("/health")
    data = response.json()
    
    assert isinstance(data, dict)
    assert len(data) == 3
    assert all(key in data for key in ["status", "app", "version"])
