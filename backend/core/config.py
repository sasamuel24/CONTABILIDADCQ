"""
Configuración de la aplicación basada en variables de entorno.
Utiliza pydantic-settings para validación y gestión de configuración.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración centralizada de la aplicación."""
    
    # Aplicación
    app_name: str = "CONTABILIDADCQ API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Base de datos
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/contabilidadcq"
    
    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Logging
    log_level: str = "INFO"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Instancia global de configuración
settings = Settings()
