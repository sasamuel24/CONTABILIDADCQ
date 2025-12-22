# AGENTS.md - Reglas del Proyecto Backend CONTABILIDADCQ

## 📋 Información General del Proyecto

### Dominio
Sistema de gestión de facturas recibidas desde buzón único, con funcionalidades de:
- Asignación por área (mantenimiento, arquitectura, administración, operaciones)
- Cambio de estados (pendiente, asignada, en_revision, cerrada, rechazada)
- Consulta de detalle de facturas
- Futura integración para extracción de datos desde PDF

### Stack Tecnológico
- **Framework Web:** FastAPI 
- **Servidor ASGI:** Uvicorn
- **Base de Datos:** PostgreSQL
- **ORM:** SQLAlchemy 2.0 (async con asyncpg)
- **Validación:** Pydantic v2 (pydantic-settings)
- **Migraciones:** Alembic
- **Testing:** pytest + httpx
- **Logging:** Python logging estándar

---

## 🏗️ Arquitectura y Estructura

### Patrón de Diseño
**DDD-lite (Domain-Driven Design simplificado)** con separación por módulos funcionales.

### Estructura de Carpetas
```
backend/
├── main.py                 # Punto de entrada FastAPI
├── .env                    # Variables de entorno (NO commitear)
├── core/                   # Configuración centralizada
│   ├── config.py          # Settings con pydantic-settings
│   └── logging.py         # Configuración de logging
├── db/                     # Capa de base de datos
│   ├── base.py            # Base declarativa SQLAlchemy
│   └── session.py         # Sesiones async y dependency
├── modules/                # Módulos de dominio
│   ├── facturas/          # Módulo de facturas
│   │   ├── router.py      # Endpoints FastAPI
│   │   ├── schemas.py     # Modelos Pydantic
│   │   ├── service.py     # Lógica de negocio
│   │   └── repository.py  # Acceso a datos
│   └── catalogos/         # Catálogos del sistema
│       ├── areas.py       # Catálogo de áreas
│       └── estados.py     # Catálogo de estados
└── tests/                  # Tests con pytest
    └── test_health.py     # Tests de healthcheck
```

---

## 📐 Convenciones de Código

### 1. Separación de Responsabilidades (Layers)

#### **Router Layer** (`router.py`)
- Define endpoints HTTP
- Maneja request/response
- Usa dependency injection
- NO contiene lógica de negocio
```python
@router.get("/", response_model=List[FacturaResponse])
async def list_facturas(
    service: FacturaService = Depends(get_factura_service)
):
    return await service.list_facturas()
```

#### **Service Layer** (`service.py`)
- Contiene lógica de negocio
- Orquesta operaciones del repository
- Maneja validaciones de dominio
- Transforma datos entre capas
```python
class FacturaService:
    def __init__(self, repository: FacturaRepository):
        self.repository = repository
    
    async def create_factura(self, data: FacturaCreate):
        # Validaciones de negocio aquí
        return await self.repository.create(data.model_dump())
```

#### **Repository Layer** (`repository.py`)
- Acceso directo a base de datos
- Operaciones CRUD
- Queries con SQLAlchemy
- NO lógica de negocio
```python
class FacturaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all(self, skip: int = 0, limit: int = 100):
        result = await self.db.execute(
            select(FacturaModel).offset(skip).limit(limit)
        )
        return result.scalars().all()
```

#### **Schema Layer** (`schemas.py`)
- Modelos Pydantic para validación
- Request/Response models separados
- Validaciones con Field()
```python
class FacturaCreate(BaseModel):
    numero_factura: str = Field(..., description="Número de factura")
    monto: float = Field(..., gt=0)
```

### 2. Imports
- **Imports absolutos desde root de backend/**
- NO usar `from backend.module import ...`
- Ejemplo: `from core.config import settings`
- Ejemplo: `from modules.facturas.service import FacturaService`

### 3. Async/Await
- **SIEMPRE usar async/await** para operaciones de BD
- Sesiones: `AsyncSession` de SQLAlchemy
- Endpoints: funciones `async def`
- Queries: `await db.execute()`

### 4. Dependency Injection
```python
# Dependency para obtener sesión de BD
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Dependency para obtener servicio
def get_factura_service(db: AsyncSession = Depends(get_db)):
    repository = FacturaRepository(db)
    return FacturaService(repository)
```

---

## ⚙️ Configuración

### Variables de Entorno (.env)
```bash
# Base de datos
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/contabilidadcq

# Aplicación
APP_NAME=CONTABILIDADCQ API
DEBUG=False
LOG_LEVEL=INFO

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

### Settings (core/config.py)
- Usa `pydantic-settings` con `BaseSettings`
- Configuración centralizada en clase `Settings`
- `case_sensitive=False` para flexibilidad
- Instancia global: `settings = Settings()`

### Logging (core/logging.py)
- Logger centralizado: `from core.logging import logger`
- Nivel configurable desde `.env`
- Formato: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- Uso: `logger.info()`, `logger.error()`, etc.

---

## 🗄️ Base de Datos

### SQLAlchemy 2.0 Async
- **Engine:** `create_async_engine()` con `postgresql+asyncpg://`
- **Sessions:** `async_sessionmaker()` con `AsyncSession`
- **Models:** Heredan de `DeclarativeBase`
- **Queries:** Estilo 2.0 con `select()`, `insert()`, etc.

### Modelos ORM (db/base.py)
```python
class Base(DeclarativeBase):
    """Clase base para todos los modelos ORM."""
    pass

class TimestampMixin:
    """Campos created_at y updated_at."""
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=datetime.utcnow)
```

### Tablas del Sistema

#### 1. **areas** - Catálogo de Áreas
```python
id: uuid (PK)
nombre: text (unique, not null, indexed)
```

#### 2. **users** - Usuarios del Sistema
```python
id: uuid (PK)
nombre: text (not null)
email: text (unique, not null, indexed)
area_id: uuid (FK → areas.id, SET NULL)
password_hash: text (not null)
role: text (not null, CHECK: 'admin'|'area_manager'|'user')
is_active: boolean (default true)
created_at, updated_at: timestamptz
```

#### 3. **estados** - Catálogo de Estados
```python
id: smallint (PK, autoincrement)
code: text (unique, not null, indexed)
label: text (not null)
order: smallint (not null)
is_final: boolean (default false)
is_active: boolean (default true)
```

#### 4. **facturas** - Registro de Facturas
```python
id: uuid (PK)
proveedor: text (not null)
numero_factura: text (not null)
fecha_emision: date (nullable)
area_id: uuid (FK → areas.id, RESTRICT, indexed)
total: numeric(12,2) (not null, CHECK > 0)
estado_id: smallint (FK → estados.id, RESTRICT, indexed)
assigned_to_user_id: uuid (FK → users.id, SET NULL, indexed)
assigned_at: timestamptz (nullable)
created_at, updated_at: timestamptz

UNIQUE CONSTRAINT: (proveedor, numero_factura)
COMPOSITE INDEX: (estado_id, area_id)
```

#### 5. **files** - Archivos Adjuntos
```python
id: uuid (PK)
factura_id: uuid (FK → facturas.id, CASCADE, indexed)
storage_provider: text (not null, CHECK: 'local'|'s3'|'drive')
storage_path: text (not null)
filename: text (not null)
content_type: text (not null)
size_bytes: bigint (not null, CHECK > 0)
created_at, updated_at: timestamptz
```

### ⚠️ Consideraciones Importantes de BD

#### Integridad Referencial (ON DELETE behaviors)
- `users.area_id` → **SET NULL** (si se borra área, user queda sin área)
- `facturas.area_id` → **RESTRICT** (no permitir borrar área con facturas)
- `facturas.estado_id` → **RESTRICT** (no permitir borrar estado en uso)
- `facturas.assigned_to_user_id` → **SET NULL** (si se borra user, factura queda sin asignar)
- `files.factura_id` → **CASCADE** (borrar factura borra sus archivos)

#### Constraints de Negocio
- **Unicidad de facturas:** No puede existir misma factura del mismo proveedor
- **Total positivo:** Las facturas deben tener monto > 0
- **Roles válidos:** Solo 'admin', 'area_manager', 'user'
- **Storage providers válidos:** Solo 'local', 's3', 'drive'
- **Tamaño de archivo positivo:** Files debe tener size_bytes > 0

#### Índices de Performance
```sql
-- Búsquedas frecuentes
facturas(estado_id)              -- Filtrar por estado
facturas(area_id)                -- Filtrar por área
facturas(assigned_to_user_id)    -- Buscar asignaciones
facturas(estado_id, area_id)     -- Reportes compuestos
files(factura_id)                -- Archivos de factura

-- Búsquedas únicas
areas(nombre)                    -- Búsqueda de área por nombre
users(email)                     -- Login por email
estados(code)                    -- Búsqueda de estado por código
```

#### Datos Iniciales (Seed)
```bash
# Ejecutar después de migraciones
python -m db.seed
```

**Áreas creadas:**
- Mantenimiento
- Arquitectura
- Administración
- Operaciones

**Estados creados:**
- recibida (order: 1)
- asignada (order: 2)
- en_curso (order: 3)
- pendiente (order: 4)
- cerrada (order: 5, is_final: true)

### Migraciones con Alembic
```bash
# Ver estado actual
python -m alembic current

# Crear migración automática
python -m alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
python -m alembic upgrade head

# Revertir última migración
python -m alembic downgrade -1

# Seed de datos iniciales
python -m db.seed
```

---
## 🚀 Ejecución y Deployment

### Desarrollo Local
```bash
# Crear entorno virtual
python -m venv .venv

# Activar (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] psycopg2-binary alembic pydantic-settings pytest httpx

# Ejecutar servidor con hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints Importantes
- **Health API:** `GET /health` - Verifica API + conexión a BD
- **Docs:** `GET /docs` - Swagger UI automático
- **Redoc:** `GET /redoc` - Documentación alternativa
- **OpenAPI:** `GET /openapi.json` - Esquema OpenAPI

### CORS
- Configurado en `main.py` con `CORSMiddleware`
- Orígenes permitidos desde `settings.cors_origins`
- Headers y métodos: `["*"]` por defecto

---

## 🎯 Reglas de Desarrollo

### ✅ HACER
1. **Separar responsabilidades:** Router → Service → Repository
2. **Usar async/await** para todas las operaciones de BD
3. **Validar con Pydantic** en schemas
4. **Logging:** Registrar operaciones importantes
5. **Manejo de errores:** Try/except y HTTPException apropiadas
6. **Type hints:** Usar anotaciones de tipo en todas las funciones
7. **Docstrings:** Documentar funciones y clases
8. **Variables de entorno:** Secrets en `.env`, NUNCA en código

### ❌ NO HACER
1. **NO** mezclar lógica de negocio en routers
2. **NO** hacer queries directas en services (usar repository)
3. **NO** commitear `.env` o secretos
4. **NO** usar imports con prefijo `backend.`
5. **NO** usar sync cuando debe ser async
6. **NO** ignorar validaciones de Pydantic
7. **NO** usar `print()` (usar `logger`)
8. **NO** hardcodear configuraciones

---

## 📦 Módulos del Dominio

### Facturas (`modules/facturas/`)
**Propósito:** Gestión completa del ciclo de vida de facturas

**Endpoints (prefijo `/api/v1/facturas`):**
- `GET /` - Listar facturas (paginación)
- `GET /{id}` - Obtener detalle de factura
- `POST /` - Crear nueva factura
- `PATCH /{id}` - Actualizar factura (estado, área)

**Estados posibles:**
- `pendiente` - Factura recibida, sin asignar
- `asignada` - Asignada a un área
- `en_revision` - En proceso de revisión
- `cerrada` - Procesada completamente
- `rechazada` - Rechazada por algún motivo

### Catálogos (`modules/catalogos/`)
**Propósito:** Datos maestros del sistema

**Áreas (prefijo `/api/v1/areas`):**
- Mantenimiento
- Arquitectura
- Administración
- Operaciones

**Estados (prefijo `/api/v1/estados`):**
- Listado de estados disponibles con descripciones

---

**Última actualización:** 22 de diciembre de 2025
**Versión del proyecto:** 1.0.0

----

# Guía de Migraciones de Base de Datos - CONTABILIDADCQ

## 📋 Estructura de Base de Datos

### Tablas
1. **areas** - Catálogo de áreas organizacionales
2. **users** - Usuarios del sistema con roles
3. **estados** - Catálogo de estados de facturas
4. **facturas** - Registro principal de facturas
5. **files** - Archivos adjuntos a facturas

### Relaciones
- `users.area_id` → `areas.id` (ON DELETE SET NULL)
- `facturas.area_id` → `areas.id` (ON DELETE RESTRICT)
- `facturas.estado_id` → `estados.id` (ON DELETE RESTRICT)
- `facturas.assigned_to_user_id` → `users.id` (ON DELETE SET NULL)
- `files.factura_id` → `facturas.id` (ON DELETE CASCADE)

---

## ⚠️ Consideraciones Importantes

### Constraints Únicos
- **areas:** `nombre` (unique)
- **users:** `email` (unique)
- **estados:** `code` (unique)
- **facturas:** `(proveedor, numero_factura)` (composite unique)

### Índices Creados
- `facturas(estado_id)` - Para filtrar por estado
- `facturas(area_id)` - Para filtrar por área
- `facturas(assigned_to_user_id)` - Para buscar asignaciones
- `facturas(estado_id, area_id)` - Índice compuesto para reportes
- `files(factura_id)` - Para búsqueda de archivos por factura

### Check Constraints
- `users.role` IN ('admin', 'area_manager', 'user')
- `facturas.total` > 0
- `files.storage_provider` IN ('local', 's3', 'drive')
- `files.size_bytes` > 0

---

## 📊 Esquema Visual

```
areas
├── id (uuid, PK)
└── nombre (text, unique)

users
├── id (uuid, PK)
├── nombre (text)
├── email (text, unique)
├── area_id (uuid, FK → areas.id) [SET NULL]
├── password_hash (text)
├── role (text) [CHECK: admin|area_manager|user]
├── is_active (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)

estados
├── id (smallint, PK)
├── code (text, unique)
├── label (text)
├── order (smallint)
├── is_final (boolean)
└── is_active (boolean)

facturas
├── id (uuid, PK)
├── proveedor (text) ─┐
├── numero_factura (text) ─┤ UNIQUE constraint
├── fecha_emision (date)
├── area_id (uuid, FK → areas.id) [RESTRICT]
├── total (numeric(12,2)) [CHECK > 0]
├── estado_id (smallint, FK → estados.id) [RESTRICT]
├── assigned_to_user_id (uuid, FK → users.id) [SET NULL]
├── assigned_at (timestamptz)
├── created_at (timestamptz)
└── updated_at (timestamptz)

files
├── id (uuid, PK)
├── factura_id (uuid, FK → facturas.id) [CASCADE]
├── storage_provider (text) [CHECK: local|s3|drive]
├── storage_path (text)
├── filename (text)
├── content_type (text)
├── size_bytes (bigint) [CHECK > 0]
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---