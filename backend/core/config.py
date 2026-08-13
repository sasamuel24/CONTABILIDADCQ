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
    app_name: str = "DOCUFLOW API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Base de datos (lee DATABASE_URL desde .env)
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/contabilidadcq"
    
    # API Key para endpoints de ingesta (n8n)
    api_key: str = "change-this-in-production"

    # Auto-ruteo a Contabilidad: facturas creadas por N8N con numero_oc + CC + CO
    # saltan al responsable y van directo a Contabilidad. Apagado por defecto
    # para poder desplegar el código y encenderlo cuando se valide en producción.
    auto_ruteo_oc: bool = False
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com",
        "https://main.d174bkkc7dp7ba.amplifyapp.com",
        "https://main.d174bkkc7dp7ba.amplifyapp.com/",
        "https://docuflowcafequindio.com",
        "https://www.docuflowcafequindio.com",
    ]
    
    # Logging
    log_level: str = "INFO"
    
    # AWS S3 Configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-2"
    s3_bucket: str = "bucket-facturas-contabilidad-cq2026"

    # Azure AD / Microsoft Graph — Email
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    email_from: str = ""
    email_responsable: str = ""   # Responsable de Mantenimiento — recibe aviso cuando técnico envía
    email_approver: str = ""      # Gerente — recibe el link de aprobación cuando responsable lo decide
    frontend_url: str = "http://localhost:3000"

    # Anthropic — IA extracción datos facturas
    anthropic_api_key: str = ""

    # ─── Siesa Connekta — causación FSP ─────────────────────────────────
    # Fase 1: config inerte (no hay cliente todavía). Credenciales SIEMPRE
    # por .env/secret manager, jamás en código ni en logs; los tokens de QA
    # circularon por chats y DEBEN rotarse antes de producción.
    siesa_habilitado: bool = False
    # QA: https://serviciosqa.siesacloud.com — prod: servicios.siesacloud.com
    # (URL de producción pendiente de confirmar antes de activar)
    siesa_base_url: str = "https://serviciosqa.siesacloud.com"
    siesa_conni_key: str = ""
    siesa_conni_token: str = ""
    siesa_id_compania: int = 2211
    siesa_id_sistema: int = 2
    siesa_id_documento: int = 249608
    siesa_nombre_documento: str = "FACTURA DE SERVICIOS DIRECTA"
    # Nombre de la consulta de Connekta (ejecutarconsulta) que devuelve el
    # último FSP por tercero + fecha + valor — la MISMA que usa el flujo n8n.
    # Sin ella no se puede recuperar el consecutivo real tras el éxito.
    siesa_consulta_fsp: str = ""
    # ⚠️ BUG ABIERTO del conector (regla #10 del builder): el tercero del
    # Movto rechaza tanto el proveedor real como el vacío; el éxito en QA se
    # logró con un tercero DISTINTO. NO es patrón de producción — cuando el
    # consultor Siesa corrija el conector, dejar ambos en "".
    siesa_workaround_tercero_movto: str = ""
    siesa_workaround_sucursal_movto: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Instancia global de configuración
settings = Settings()
