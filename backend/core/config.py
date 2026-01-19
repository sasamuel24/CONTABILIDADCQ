"""
Configuración de la aplicación basada en variables de entorno.
Utiliza pydantic-settings para validación y gestión de configuración.

Las variables se pueden configurar en el archivo .env en la raíz de backend/
Ejemplo: DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/contabilidadcq
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración centralizada de la aplicación."""
    
    # Aplicación
    app_name: str = "CONTABILIDADCQ API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Base de datos (lee DATABASE_URL desde .env)
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/contabilidadcq"
    
    # API Key para endpoints de ingesta (n8n)
    api_key: str = "change-this-in-production"
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com",
        "https://main.d174bkkc7dp7ba.amplifyapp.com"
    ]
    
    # Logging
    log_level: str = "INFO"
    
    # AWS S3 Configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-2"
    s3_bucket: str = "bucket-facturas-contabilidad-cq2026"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Instancia global de configuración
settings = Settings()
