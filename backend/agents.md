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
4. **centros_costo** - Catálogo de centros de costo
5. **centros_operacion** - Catálogo de centros de operación (sub-clasificación de CCs)
6. **facturas** - Registro principal de facturas
7. **files** - Archivos adjuntos a facturas
8. **factura_asignaciones** - Historial de asignaciones de facturas

### Relaciones
- `users.area_id` → `areas.id` (ON DELETE SET NULL)
- `facturas.area_id` → `areas.id` (ON DELETE RESTRICT)
- `facturas.estado_id` → `estados.id` (ON DELETE RESTRICT)
- `facturas.assigned_to_user_id` → `users.id` (ON DELETE SET NULL)
- `facturas.centro_costo_id` → `centros_costo.id` (ON DELETE RESTRICT)
- `facturas.centro_operacion_id` → `centros_operacion.id` (ON DELETE RESTRICT)
- `centros_operacion.centro_costo_id` → `centros_costo.id` (ON DELETE RESTRICT)
- `files.factura_id` → `facturas.id` (ON DELETE CASCADE)
- `files.uploaded_by_user_id` → `users.id` (ON DELETE SET NULL)

---

## ⚠️ Consideraciones Importantes

### Constraints Únicos
- **areas:** `nombre` (unique)
- **users:** `email` (unique)
- **estados:** `code` (unique)
- **centros_costo:** `nombre` (unique)
- **centros_operacion:** `(centro_costo_id, nombre)` (composite unique)
- **facturas:** `(proveedor, numero_factura)` (composite unique)

### Índices Creados
- `centros_costo(nombre)` - Para búsqueda de centros de costo
- `centros_operacion(centro_costo_id)` - Para filtrar operaciones por CC
- `centros_operacion(nombre)` - Para búsqueda de centros de operación
- `facturas(estado_id)` - Para filtrar por estado
- `facturas(area_id)` - Para filtrar por área
- `facturas(assigned_to_user_id)` - Para buscar asignaciones
- `facturas(centro_costo_id)` - Para reportes por centro de costo
- `facturas(centro_operacion_id)` - Para reportes por centro de operación
- `facturas(estado_id, area_id)` - Índice compuesto para reportes
- `files(factura_id)` - Para búsqueda de archivos por factura
- `files(doc_type)` - Para filtrar archivos por tipo de documento

### Check Constraints
- `users.role` IN ('admin', 'area_manager', 'user')
- `facturas.total` > 0
- `files.storage_provider` IN ('local', 's3', 'drive')
- `files.doc_type` IN ('OC','OS','OCT','ECT','OCC','EDO','FCP','FPC','EGRESO','SOPORTE_PAGO','FACTURA_PDF')
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

centros_costo
├── id (uuid, PK)
├── nombre (text, unique)
├── activo (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)

centros_operacion
├── id (uuid, PK)
├── centro_costo_id (uuid, FK → centros_costo.id) [RESTRICT]
├── nombre (text)
├── activo (boolean)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── UNIQUE(centro_costo_id, nombre)

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
├── centro_costo_id (uuid, FK → centros_costo.id) [RESTRICT, nullable]
├── centro_operacion_id (uuid, FK → centros_operacion.id) [RESTRICT, nullable]
├── created_at (timestamptz)
└── updated_at (timestamptz)

files
├── id (uuid, PK)
├── factura_id (uuid, FK → facturas.id) [CASCADE]
├── doc_type (text, nullable) [CHECK: OC|OS|OCT|ECT|OCC|EDO|FCP|FPC|EGRESO|SOPORTE_PAGO|FACTURA_PDF]
├── storage_provider (text) [CHECK: local|s3|drive]
├── storage_path (text)
├── filename (text)
├── content_type (text)
├── size_bytes (bigint) [CHECK > 0]
├── uploaded_by_user_id (uuid, FK → users.id) [SET NULL]
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---

## 📍 Módulo de Centros de Costo y Operación

### Propósito
Los Centros de Costo (CC) y Centros de Operación (CO) permiten clasificar facturas para control presupuestario y asignación de recursos.

### Modelo de Datos

**Centro de Costo:**
- Representa un área de negocio o departamento que genera gastos
- Puede tener múltiples centros de operación asociados
- Campo `activo` permite soft-delete sin romper integridad referencial

**Centro de Operación:**
- Representa una sub-clasificación dentro de un Centro de Costo
- Siempre pertenece a un único Centro de Costo
- Unique constraint evita duplicados dentro del mismo CC

### Relaciones en Facturas

- Una factura puede tener asociado opcionalmente un Centro de Costo
- Una factura puede tener asociado opcionalmente un Centro de Operación
- Ambos campos son nullable para permitir facturas sin esta clasificación
- FK con `ON DELETE RESTRICT` previene eliminar CCs/COs con facturas activas

### Reglas de Negocio

1. **Creación de Centros:**
   - Los nombres de Centros de Costo deben ser únicos a nivel global
   - Los nombres de Centros de Operación deben ser únicos dentro de cada Centro de Costo
   - Por defecto se crean con `activo = true`

2. **Asignación a Facturas:**
   - Los campos son opcionales (nullable)
   - Si se asigna un Centro de Operación, debe pertenecer al Centro de Costo asignado (validación a nivel de aplicación)
   - Solo se pueden asignar CCs/COs activos

3. **Desactivación:**
   - Usar campo `activo = false` en lugar de eliminar
   - No se pueden eliminar CCs/COs que tengan facturas asociadas (RESTRICT)
   - CCs/COs inactivos no deben mostrarse en dropdowns del frontend

4. **Índices:**
   - Índice en `nombre` de ambas tablas para búsquedas rápidas
   - Índice en `centro_costo_id` de centros_operacion para joins
   - Índices en FKs de facturas para reportes y filtrado

### Casos de Uso

**Vista Responsable:**
- Dropdown para seleccionar Centro de Costo (solo activos)
- Dropdown para seleccionar Centro de Operación (filtrado por CC seleccionado, solo activos)
- Ambos campos opcionales

**Reportes:**
- Filtrar facturas por Centro de Costo
- Agrupar totales por Centro de Operación
- Análisis de gastos por área presupuestaria

---

## 📁 Módulo de Archivos (Files)

### Reglas de Negocio - Upload de Archivos

#### Endpoint: `POST /api/v1/facturas/{factura_id}/files/upload`

**Propósito:**
Subir archivos PDF asociados a facturas con clasificación por tipo de documento.

**Validaciones Obligatorias:**

1. **Validación de Factura:**
   - La factura (`factura_id`) debe existir previamente en la base de datos
   - Responde 404 Not Found si no existe

2. **Validación de Tipo de Documento (`doc_type`):**
   - Debe ser uno de los siguientes valores permitidos:
     - `OC` - Orden de Compra
     - `OS` - Orden de Servicio
     - `OCT` - Orden de Compra Temporal
     - `ECT` - Estado de Cuenta Temporal
     - `OCC` - Orden de Compra Complementaria
     - `EDO` - Estado de Cuenta
     - `FCP` - Factura Cliente Proveedor
     - `FPC` - Factura Proveedor Cliente
     - `EGRESO` - Egreso
     - `SOPORTE_PAGO` - Soporte de Pago
     - `FACTURA_PDF` - Factura PDF
   - Responde 400 Bad Request si es inválido
   - Esta validación se aplica tanto en código como en constraint de BD

3. **Validación de Tipo de Archivo:**
   - Solo se permiten archivos PDF
   - Verifica `content_type == "application/pdf"`
   - Verifica extensión `.pdf` del nombre de archivo
   - Responde 400 Bad Request si no cumple

4. **Validación de Duplicados:**
   - No se permite más de un archivo con la misma combinación de `factura_id` + `doc_type`
   - Responde 409 Conflict si ya existe
   - Mensaje: "Ya existe un archivo PDF para este factura_id y doc_type"

**Proceso de Almacenamiento:**

1. **Estructura de Carpetas:**
   - Ruta base: `storage/facturas/{factura_id}/{doc_type}/`
   - Se crean automáticamente si no existen

2. **Nombre de Archivo:**
   - Formato: `{timestamp}_{filename_sanitizado}`
   - Timestamp: `YYYYMMDDHHMMSS` (14 dígitos)
   - Sanitización: remueve caracteres especiales, mantiene alfanuméricos, guiones y puntos
   - Ejemplo: `20251226143052_orden_compra.pdf`

3. **Registro en Base de Datos:**
   - Tabla: `files`
   - Campos obligatorios:
     - `factura_id`: UUID de la factura
     - `doc_type`: tipo de documento validado
     - `storage_provider`: "local"
     - `storage_path`: ruta completa al archivo
     - `filename`: nombre con timestamp
     - `content_type`: "application/pdf"
     - `size_bytes`: tamaño real del archivo
     - `created_at`: timestamp UTC
   - Campos opcionales:
     - `uploaded_by_user_id`: UUID del usuario si hay autenticación activa

**Respuestas del Endpoint:**

1. **201 Created** (Éxito):
```json
{
  "file_id": "uuid",
  "factura_id": "uuid",
  "doc_type": "OC",
  "filename": "20251226143052_archivo.pdf",
  "content_type": "application/pdf",
  "size_bytes": 245019,
  "storage_provider": "local",
  "storage_path": "storage/facturas/{uuid}/OC/20251226143052_archivo.pdf",
  "created_at": "2025-12-26T14:30:52Z",
  "uploaded_by_user_id": "uuid"  // Solo si hay autenticación
}
```

2. **400 Bad Request** (Validación fallida):
```json
{
  "code": "bad_request",
  "message": "doc_type debe ser uno de los permitidos"
}
```

3. **404 Not Found** (Factura no existe):
```json
{
  "detail": "Factura con ID {uuid} no encontrada"
}
```

4. **409 Conflict** (Archivo duplicado):
```json
{
  "code": "file_already_exists",
  "message": "Ya existe un archivo PDF para este factura_id y doc_type"
}
```

5. **500 Internal Server Error** (Error del servidor):
```json
{
  "code": "internal_error",
  "message": "Error al guardar el archivo"
}
```

**Manejo de Errores:**
- Si falla el guardado en BD después de guardar el archivo físico, se intenta eliminar el archivo
- Todos los errores se loguean con nivel ERROR
- Validaciones exitosas se loguean con nivel INFO

---

### Endpoint: `GET /api/v1/facturas/{factura_id}/files`

**Propósito:**
Listar todos los archivos asociados a una factura, con opción de filtrar por tipo de documento.

**Query Parameters:**
- `doc_type` (opcional): Filtra resultados por tipo de documento
  - Valores: cualquiera de los 11 tipos permitidos
  - Si se omite, retorna todos los archivos de la factura

**Ejemplos de Uso:**
```
GET /api/v1/facturas/{uuid}/files                    # Todos los archivos
GET /api/v1/facturas/{uuid}/files?doc_type=OC        # Solo órdenes de compra
GET /api/v1/facturas/{uuid}/files?doc_type=FACTURA_PDF  # Solo facturas PDF
```

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "factura_id": "uuid",
    "doc_type": "OC",
    "storage_provider": "local",
    "storage_path": "storage/facturas/{uuid}/OC/20251226143052_archivo.pdf",
    "filename": "20251226143052_archivo.pdf",
    "content_type": "application/pdf",
    "size_bytes": 245632,
    "uploaded_at": "2025-12-26T14:30:52Z"
  }
]
```

**Ordenamiento:**
- Los archivos se ordenan por `created_at` descendente (más recientes primero)

---

### Endpoint: `GET /api/v1/files/{file_id}`

**Propósito:**
Descargar un archivo específico por su ID.

**Respuesta:**
- Content-Type: según el tipo de archivo (ej: application/pdf)
- Content-Disposition: attachment con nombre de archivo original
- Body: contenido binario del archivo

**Errores:**
- 404 si el archivo no existe en BD
- 404 si el archivo físico no se encuentra en storage

---

### Reglas de Integridad Referencial

1. **Eliminación de Factura:**
   - `ON DELETE CASCADE` en `files.factura_id`
   - Al eliminar una factura, se eliminan automáticamente todos sus archivos de la BD
   - **Nota:** Los archivos físicos NO se eliminan automáticamente del storage

2. **Eliminación de Usuario:**
   - `ON DELETE SET NULL` en `files.uploaded_by_user_id`
   - Si se elimina el usuario, el registro del archivo permanece pero `uploaded_by_user_id` se marca como NULL

3. **Constraint Único Implícito:**
   - Aunque no hay constraint único en BD, la lógica de negocio previene duplicados
   - Un `factura_id` + `doc_type` solo puede existir una vez
   - Se valida en código antes de insertar

---

## 📊 Módulo de Centros de Costo y Centros de Operación

### Descripción General

Sistema de clasificación presupuestaria de dos niveles que permite categorizar facturas por:
1. **Centro de Costo (CC):** Departamento o unidad de negocio principal
2. **Centro de Operación (CO):** Sub-clasificación dentro de un centro de costo

**Relación:** Un Centro de Costo tiene múltiples Centros de Operación (relación 1:N)

### Modelos de Datos

#### Centro de Costo
```python
centros_costo
├── id (uuid, PK)
├── nombre (text, unique, indexed)
├── activo (boolean, default=True)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

#### Centro de Operación
```python
centros_operacion
├── id (uuid, PK)
├── centro_costo_id (uuid, FK → centros_costo.id) [RESTRICT, indexed]
├── nombre (text, indexed)
├── activo (boolean, default=True)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── UNIQUE CONSTRAINT (centro_costo_id, nombre)
```

### Reglas de Negocio

1. **Integridad Referencial:**
   - `ON DELETE RESTRICT` en `centros_operacion.centro_costo_id`
   - No se puede eliminar un CC si tiene COs asociados
   - No se puede eliminar CC o CO si tienen facturas asignadas

2. **Soft Delete:**
   - Uso de campo `activo` (boolean) para desactivación lógica
   - Los registros nunca se eliminan físicamente de la BD
   - Los endpoints por defecto solo retornan registros activos

3. **Validación de Pertenencia:**
   - Al asignar un CO a una factura, **debe pertenecer** al CC seleccionado
   - Validación implementada en `FacturaService._validate_centro_operacion`
   - Error 400 si el CO no pertenece al CC especificado

4. **Constraint Único Compuesto:**
   - No pueden existir dos COs con el mismo nombre dentro del mismo CC
   - COs con el mismo nombre pueden existir en diferentes CCs

5. **Campos Opcionales en Facturas:**
   - `centro_costo_id` y `centro_operacion_id` son nullable
   - Se puede asignar CC sin CO, pero no CO sin CC
   - Facturas existentes sin CC/CO siguen siendo válidas

### Endpoints - Centros de Costo

#### GET `/api/v1/centros-costo`
**Descripción:** Lista todos los centros de costo

**Query Parameters:**
- `activos_only` (bool, default=true): Filtrar solo activos

**Request:**
```
GET /api/v1/centros-costo?activos_only=true
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "nombre": "Administración",
    "activo": true,
    "created_at": "2025-12-26T00:00:00Z",
    "updated_at": "2025-12-26T00:00:00Z"
  }
]
```

#### GET `/api/v1/centros-costo/{centro_id}`
**Descripción:** Obtiene un centro de costo específico

**Response 200:**
```json
{
  "id": "uuid",
  "nombre": "Ventas",
  "activo": true,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T00:00:00Z"
}
```

**Errores:**
- 404: Centro de costo no encontrado

#### POST `/api/v1/centros-costo`
**Descripción:** Crea un nuevo centro de costo

**Request Body:**
```json
{
  "nombre": "Investigación y Desarrollo",
  "activo": true
}
```

**Response 201:**
```json
{
  "id": "uuid-generado",
  "nombre": "Investigación y Desarrollo",
  "activo": true,
  "created_at": "2025-12-26T14:30:00Z",
  "updated_at": "2025-12-26T14:30:00Z"
}
```

**Errores:**
- 400: Nombre duplicado
- 422: Validación de Pydantic (nombre requerido)

#### PATCH `/api/v1/centros-costo/{centro_id}`
**Descripción:** Actualiza un centro de costo

**Request Body (todos opcionales):**
```json
{
  "nombre": "Nuevo Nombre",
  "activo": false
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "nombre": "Nuevo Nombre",
  "activo": false,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T14:35:00Z"
}
```

**Errores:**
- 404: Centro de costo no encontrado
- 400: Nombre duplicado

#### DELETE `/api/v1/centros-costo/{centro_id}`
**Descripción:** Desactiva un centro de costo (soft delete)

**Response 200:**
```json
{
  "id": "uuid",
  "nombre": "Centro Desactivado",
  "activo": false,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T14:40:00Z"
}
```

**Errores:**
- 404: Centro de costo no encontrado
- 400: No se puede desactivar (tiene facturas activas)

### Endpoints - Centros de Operación

#### GET `/api/v1/centros-operacion`
**Descripción:** Lista todos los centros de operación con filtros opcionales

**Query Parameters:**
- `activos_only` (bool, default=true): Filtrar solo activos
- `centro_costo_id` (uuid, opcional): Filtrar por centro de costo

**Ejemplos:**
```
GET /api/v1/centros-operacion                                  # Todos activos
GET /api/v1/centros-operacion?activos_only=false              # Todos (activos e inactivos)
GET /api/v1/centros-operacion?centro_costo_id={uuid}          # Solo de un CC específico
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "centro_costo_id": "uuid-cc",
    "centro_costo_nombre": "Administración",
    "nombre": "Recursos Humanos",
    "activo": true,
    "created_at": "2025-12-26T00:00:00Z",
    "updated_at": "2025-12-26T00:00:00Z"
  }
]
```

**Nota:** La respuesta incluye `centro_costo_nombre` para facilitar visualización sin joins adicionales.

#### GET `/api/v1/centros-operacion/{centro_id}`
**Descripción:** Obtiene un centro de operación específico

**Response 200:**
```json
{
  "id": "uuid",
  "centro_costo_id": "uuid-cc",
  "centro_costo_nombre": "Ventas",
  "nombre": "Ventas Nacionales",
  "activo": true,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T00:00:00Z"
}
```

**Errores:**
- 404: Centro de operación no encontrado

#### POST `/api/v1/centros-operacion`
**Descripción:** Crea un nuevo centro de operación

**Validación Importante:** El `centro_costo_id` debe existir y estar activo.

**Request Body:**
```json
{
  "centro_costo_id": "uuid-cc-existente",
  "nombre": "Zona Occidente",
  "activo": true
}
```

**Response 201:**
```json
{
  "id": "uuid-generado",
  "centro_costo_id": "uuid-cc-existente",
  "centro_costo_nombre": "Operaciones",
  "nombre": "Zona Occidente",
  "activo": true,
  "created_at": "2025-12-26T14:45:00Z",
  "updated_at": "2025-12-26T14:45:00Z"
}
```

**Errores:**
- 404: Centro de costo no encontrado
- 400: Nombre duplicado dentro del mismo CC
- 422: Validación de Pydantic

#### PATCH `/api/v1/centros-operacion/{centro_id}`
**Descripción:** Actualiza un centro de operación

**Request Body (todos opcionales):**
```json
{
  "nombre": "Zona Occidente Actualizada",
  "activo": true
}
```

**Nota:** No se permite cambiar `centro_costo_id` por diseño. Para reasignar, eliminar y crear nuevo.

**Response 200:**
```json
{
  "id": "uuid",
  "centro_costo_id": "uuid-cc",
  "centro_costo_nombre": "Operaciones",
  "nombre": "Zona Occidente Actualizada",
  "activo": true,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T14:50:00Z"
}
```

**Errores:**
- 404: Centro de operación no encontrado
- 400: Nombre duplicado dentro del mismo CC

#### DELETE `/api/v1/centros-operacion/{centro_id}`
**Descripción:** Desactiva un centro de operación (soft delete)

**Response 200:**
```json
{
  "id": "uuid",
  "centro_costo_id": "uuid-cc",
  "centro_costo_nombre": "Operaciones",
  "nombre": "Centro Desactivado",
  "activo": false,
  "created_at": "2025-12-26T00:00:00Z",
  "updated_at": "2025-12-26T14:55:00Z"
}
```

**Errores:**
- 404: Centro de operación no encontrado
- 400: No se puede desactivar (tiene facturas activas)

### Integración con Facturas

#### Actualización de Esquemas

**FacturaBase, FacturaCreate, FacturaUpdate:**
```python
class FacturaCreate(BaseModel):
    numero_factura: str
    proveedor: str
    monto_total: float
    # ... otros campos
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
```

**FacturaResponse, FacturaListItem:**
```python
class FacturaResponse(BaseModel):
    id: UUID
    numero_factura: str
    # ... otros campos
    centro_costo_id: Optional[UUID] = None
    centro_operacion_id: Optional[UUID] = None
    centro_costo: Optional[str] = None          # Nombre del CC
    centro_operacion: Optional[str] = None      # Nombre del CO
```

#### Validación en Facturas

**Método:** `FacturaService._validate_centro_operacion`

**Lógica:**
1. Si ambos `centro_costo_id` y `centro_operacion_id` son None → OK
2. Si solo `centro_costo_id` está presente → OK
3. Si solo `centro_operacion_id` está presente → Error 400 (CO requiere CC)
4. Si ambos están presentes:
   - Verifica que CO existe en BD
   - Verifica que `CO.centro_costo_id == factura.centro_costo_id`
   - Si no coinciden → Error 400 con mensaje descriptivo

**Ejemplo de Error:**
```json
{
  "detail": "El centro de operación seleccionado no pertenece al centro de costo especificado"
}
```

#### PATCH `/api/v1/facturas/{factura_id}`
**Actualización:** Ahora soporta actualización de CC/CO con validación

**Request Body (campos opcionales):**
```json
{
  "centro_costo_id": "uuid-cc",
  "centro_operacion_id": "uuid-co",
  "monto_total": 5000.00
}
```

**Comportamiento:**
- Se aplica la misma validación de pertenencia que en POST
- Se pueden actualizar CC/CO independientemente de otros campos
- Se pueden establecer en NULL para "desasignar"

### Datos de Seed

**Script:** `backend/seed_centros.py`

**Centros de Costo Iniciales (5):**
1. Administración
2. Ventas
3. Operaciones
4. Tecnología
5. Marketing

**Centros de Operación Iniciales (15):**
- **Administración:** Recursos Humanos, Finanzas, Legal
- **Ventas:** Ventas Nacionales, Ventas Internacionales, Atención al Cliente
- **Operaciones:** Producción, Logística, Control de Calidad
- **Tecnología:** Desarrollo, Infraestructura, Soporte Técnico
- **Marketing:** Marketing Digital, Publicidad, Eventos

**Ejecución del Seed:**
```bash
cd backend
python seed_centros.py
```

**Características:**
- Verifica duplicados antes de insertar
- Transaccional (rollback en caso de error)
- Logging detallado con emojis
- Idempotente (puede ejecutarse múltiples veces)

### Testing

**Script de Pruebas:** `backend/test_centros_api.py`

**Suite de Pruebas (11 tests):**
1. Listar CCs activos
2. Listar todos los CCs (activos e inactivos)
3. Obtener CC específico por ID
4. Crear nuevo CC
5. Actualizar CC (PUT - no implementado por diseño)
6. Listar todos los COs
7. Listar COs filtrados por CC
8. Crear nuevo CO
9. Crear CO con CC inválido (debe fallar con 404)
10. Crear factura con CC y CO válidos
11. Crear factura con CO que no pertenece al CC (debe fallar con 400)

**Ejecución:**
```bash
cd backend
python test_centros_api.py
```

**Requisitos:**
- Servidor corriendo en `http://localhost:8000`
- API Key configurada (default: `dev-api-key-2024`)
- Base de datos con seed ejecutado

### Casos de Uso Comunes

#### 1. Listar CCs para dropdown
```
GET /api/v1/centros-costo?activos_only=true
```
Retorna lista de CCs activos para selector en frontend.

#### 2. Obtener COs al seleccionar CC
```
GET /api/v1/centros-operacion?centro_costo_id={uuid}&activos_only=true
```
Carga COs dinámicamente cuando usuario selecciona un CC.

#### 3. Crear factura con clasificación presupuestaria
```json
POST /api/v1/facturas
{
  "numero_factura": "F-2025-001",
  "proveedor": "Proveedor SA",
  "monto_total": 10000.00,
  "centro_costo_id": "uuid-cc",
  "centro_operacion_id": "uuid-co",
  ...
}
```

#### 4. Reasignar CC/CO de una factura
```json
PATCH /api/v1/facturas/{uuid}
{
  "centro_costo_id": "nuevo-uuid-cc",
  "centro_operacion_id": "nuevo-uuid-co"
}
```

#### 5. Remover clasificación presupuestaria
```json
PATCH /api/v1/facturas/{uuid}
{
  "centro_costo_id": null,
  "centro_operacion_id": null
}
```

### Consideraciones de Performance

1. **Índices Optimizados:**
   - `centros_costo(nombre)` para búsquedas
   - `centros_operacion(centro_costo_id)` para joins y filtros
   - `facturas(centro_costo_id, centro_operacion_id)` para reportes

2. **Eager Loading:**
   - `selectin` en relación `centro_costo` → evita N+1 queries
   - Nombres de CC/CO se cargan en una sola query

3. **Caching (recomendado para producción):**
   - Los catálogos CC/CO cambian poco
   - Considerar Redis para cachear listados de activos



---

### Consideraciones de Almacenamiento

**Storage Local:**
- Ubicación base: `storage/facturas/`
- Estructura jerárquica: `{factura_id}/{doc_type}/`
- Ventajas: Simple, sin dependencias externas
- Desventajas: No escalable para múltiples servidores

**Extensibilidad Futura:**
- Campo `storage_provider` preparado para: 'local', 's3', 'drive'
- Campo `storage_path` contiene la referencia completa
- Lógica de lectura/escritura delegada al servicio

**Migración a Cloud Storage:**
1. Implementar método en servicio para nuevo provider
2. Actualizar constraint de `storage_provider` en BD
3. Migrar archivos existentes (script separado)
4. Actualizar registros de `storage_provider` y `storage_path`

---

### Logging y Auditoría

**Operaciones Logueadas:**
- Inicio de upload con factura_id y doc_type
- Validación de factura existente
- Detección de duplicados
- Archivo guardado exitosamente (con ruta)
- Registro creado en BD (con file_id)
- Errores de validación (con detalles)
- Errores de almacenamiento (con stack trace)

**Campos de Auditoría en BD:**
- `created_at`: timestamp automático de creación
- `uploaded_by_user_id`: quién subió el archivo (si hay auth)

---

### Testing del Módulo Files

**Script de Prueba:** `test_upload.py`

**Uso:**
```bash
python test_upload.py <factura_id> <doc_type> <pdf_path>
```

**Escenarios a Probar:**
1. Upload exitoso con todos los campos válidos
2. Error 404 con factura inexistente
3. Error 400 con doc_type inválido
4. Error 400 con archivo no-PDF
5. Error 409 intentando subir duplicado
6. Listado sin filtro (todos los archivos)
7. Listado con filtro por doc_type
8. Descarga de archivo por ID

---

## 📚 API Endpoints - Referencia Completa

Esta sección documenta todos los endpoints disponibles en el API REST del sistema.

---

## 🔐 Auth Module (`/api/v1/auth`)

### POST `/api/v1/auth/login`
**Descripción:** Autenticar usuario y generar tokens JWT

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

**Errores:** 401 Unauthorized

---

### POST `/api/v1/auth/refresh`
**Descripción:** Renovar access token usando refresh token

**Request:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Errores:** 401 Unauthorized

---

### POST `/api/v1/auth/logout`
**Descripción:** Invalidar refresh token

**Request:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200):**
```json
{
  "detail": "Logout exitoso"
}
```

---

### GET `/api/v1/auth/me`
**Descripción:** Obtener información del usuario autenticado

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "role": "admin",
  "area": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "nombre": "Mantenimiento"
  }
}
```

---

## 📊 Dashboard Module (`/api/v1/dashboard`)

### GET `/api/v1/dashboard/facturas/metrics`
**Descripción:** Obtiene métricas de facturas por estado

**Response (200):**
```json
{
  "recibidas": 15,
  "asignadas": 8,
  "cerradas": 42,
  "pendientes": 3
}
```

---

### GET `/api/v1/dashboard/areas/recientes-asignadas`
**Descripción:** Facturas recientemente asignadas por área

**Response (200):**
```json
[
  {
    "area": "Mantenimiento",
    "quien_la_tiene": "Juan Pérez",
    "fecha_asignacion": "2025-12-22T10:30:00",
    "estado": "Asignada"
  }
]
```

---

## 🏢 Areas Module (`/api/v1/areas`)

### GET `/api/v1/areas`
**Descripción:** Lista todas las áreas

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Mantenimiento"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "nombre": "Arquitectura"
  }
]
```

---

## 📝 Estados Module (`/api/v1/estados`)

### GET `/api/v1/estados`
**Descripción:** Lista todos los estados disponibles

**Response (200):**
```json
[
  {
    "id": 1,
    "code": "recibida",
    "label": "Recibida",
    "order": 1,
    "is_final": false,
    "is_active": true
  },
  {
    "id": 2,
    "code": "asignada",
    "label": "Asignada",
    "order": 2,
    "is_final": false,
    "is_active": true
  }
]
```

---

## 📄 Facturas Module (`/api/v1/facturas`)

### GET `/api/v1/facturas`
**Descripción:** Lista todas las facturas con paginación

**Query Params:**
- `skip` (int, default=0)
- `limit` (int, default=100)

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "proveedor": "Proveedora SA",
      "numero_factura": "FAC-2025-001",
      "fecha_emision": "2025-12-01",
      "area": "Mantenimiento",
      "total": 1500.50,
      "estado": "Asignada"
    }
  ],
  "total": 125,
  "page": 1,
  "per_page": 100
}
```

---

### GET `/api/v1/facturas/{factura_id}`
**Descripción:** Obtiene detalle de una factura por ID

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "proveedor": "Proveedora SA",
  "numero_factura": "FAC-2025-001",
  "fecha_emision": "2025-12-01",
  "area_id": "660e8400-e29b-41d4-a716-446655440001",
  "area": "Mantenimiento",
  "total": 1500.50,
  "estado_id": 2,
  "estado": "Asignada",
  "assigned_to_user_id": "770e8400-e29b-41d4-a716-446655440002",
  "assigned_at": "2025-12-20T14:30:00",
  "created_at": "2025-12-15T09:00:00",
  "updated_at": "2025-12-20T14:30:00"
}
```

**Errores:** 404 Not Found

---

### GET `/api/v1/facturas/by-number/{numero_factura}`
**Descripción:** Obtiene factura por número

**Response (200):** Igual que GET por ID

**Errores:** 404 Not Found

---

### POST `/api/v1/facturas`
**Descripción:** Crea una nueva factura

**Request:**
```json
{
  "proveedor": "Proveedora SA",
  "numero_factura": "FAC-2025-001",
  "fecha_emision": "2025-12-01",
  "area_id": "660e8400-e29b-41d4-a716-446655440001",
  "total": 1500.50,
  "estado_id": 1
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "proveedor": "Proveedora SA",
  "numero_factura": "FAC-2025-001",
  ...
}
```

---

### PATCH `/api/v1/facturas/{factura_id}/estado`
**Descripción:** Actualiza el estado de una factura

**Request:**
```json
{
  "estado_id": 3
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "estado": "En Curso",
  "updated_at": "2025-12-22T15:45:00"
}
```

**Errores:** 404 Not Found, 400 Bad Request

---

## 📁 Files Module - Endpoints API (`/api/v1`)

### POST `/api/v1/facturas/{factura_id}/files/upload`
**Descripción:** Subir un archivo PDF a una factura con tipo de documento

**Content-Type:** `multipart/form-data`

**Path Parameters:**
- `factura_id`: UUID de la factura

**Form Data:**
- `file`: UploadFile (archivo PDF)
- `doc_type`: string (tipo de documento)

**Tipos de documento permitidos:**
- `OC`: Orden de Compra
- `OS`: Orden de Servicio
- `OCT`: Orden de Compra Temporal
- `ECT`: Estado de Cuenta Temporal
- `OCC`: Orden de Compra Complementaria
- `EDO`: Estado de Cuenta
- `FCP`: Factura Cliente Proveedor
- `FPC`: Factura Proveedor Cliente
- `EGRESO`: Egreso
- `SOPORTE_PAGO`: Soporte de Pago
- `FACTURA_PDF`: Factura PDF

**Response (201 Created):**
```json
{
  "file_id": "bfb2c2fd-012c-4fc3-910d-4b13fdc35595",
  "factura_id": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "doc_type": "OC",
  "filename": "20251226123456_oc_123.pdf",
  "content_type": "application/pdf",
  "size_bytes": 245019,
  "storage_provider": "local",
  "storage_path": "storage/facturas/1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6/OC/20251226123456_oc_123.pdf",
  "created_at": "2025-12-26T12:34:56Z",
  "uploaded_by_user_id": "a1b2c3d4-5f6e-7g8h-9i0j-k1l2m3n4o5p6"
}
```

**Response (400 Bad Request):**
```json
{
  "code": "bad_request",
  "message": "doc_type debe ser uno de los permitidos"
}
```

**Response (409 Conflict):**
```json
{
  "code": "file_already_exists",
  "message": "Ya existe un archivo PDF para este factura_id y doc_type"
}
```

**Response (500 Internal Server Error):**
```json
{
  "code": "internal_error",
  "message": "Error al guardar el archivo"
}
```

---

### GET `/api/v1/facturas/{factura_id}/files`
**Descripción:** Lista todos los archivos de una factura

**Query Parameters (opcionales):**
- `doc_type`: Filtrar por tipo de documento

**Ejemplos:**
```
GET /api/v1/facturas/{uuid}/files                    # Todos los archivos
GET /api/v1/facturas/{uuid}/files?doc_type=OC        # Solo órdenes de compra
GET /api/v1/facturas/{uuid}/files?doc_type=FACTURA_PDF  # Solo facturas PDF
```

**Response (200):**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "factura_id": "550e8400-e29b-41d4-a716-446655440000",
    "doc_type": "OC",
    "storage_provider": "local",
    "storage_path": "storage/facturas/550e8400-e29b-41d4-a716-446655440000/OC/20251226123456_factura.pdf",
    "filename": "20251226123456_factura.pdf",
    "content_type": "application/pdf",
    "size_bytes": 245632,
    "uploaded_at": "2025-12-15T09:05:00"
  }
]
```

---

### GET `/api/v1/facturas/{factura_id}/files/pdf`
**Descripción:** Descarga el PDF de una factura

**Response (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="factura.pdf"`

**Errores:** 404 Not Found

---

### GET `/api/v1/files/{file_id}`
**Descripción:** Descarga un archivo específico por ID

**Response (200):**
- Content-Type: Según tipo de archivo
- Content-Disposition: `attachment; filename="..."`

**Errores:** 404 Not Found

---

## 🔧 Configuración del Proyecto

### Variables de Entorno Necesarias

Archivo `.env` en la raíz del backend:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/contabilidadcq

# JWT Authentication
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# API Configuration
API_V1_PREFIX=/api/v1
PROJECT_NAME=CONTABILIDADCQ Backend
```

### Comandos para Desarrollo

```bash
# Instalar dependencias
pip install -r requirements.txt

# Aplicar migraciones
alembic upgrade head

# Ejecutar servidor en desarrollo
uvicorn main:app --reload

# Ejecutar tests
pytest

# Ver documentación interactiva
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

---

## ✅ Estado de Implementación de Módulos

| Módulo | Router | Service | Repository | ORM | Migraciones | Estado |
|--------|--------|---------|------------|-----|-------------|--------|
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Areas | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Estados | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Facturas | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Files | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Asignaciones | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Centros Costo | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Centros Operación | ✅ | ✅ | ✅ | ✅ | ✅ | Completo |
| Inventarios Factura | ✅ | ✅ | N/A | ✅ | ✅ | Completo |

---

## 📦 Módulo de Inventarios

### Resumen de Implementación

Se ha implementado exitosamente el endpoint `PATCH /facturas/{factura_id}/inventarios` con todas las validaciones y lógica de negocio requeridas para gestionar inventarios de facturas.

### Endpoint Principal

**`PATCH /facturas/{factura_id}/inventarios`**

Gestiona los campos de inventarios de una factura:
- `requiere_entrada_inventarios` (boolean)
- `destino_inventarios` (ENUM: TIENDA, ALMACEN)
- `presenta_novedad` (boolean) - **NUEVO: Indica si hay novedad en inventarios**
- Códigos de inventario asociados en tabla `factura_inventario_codigos`
  - Códigos base: OCT, ECT, FPC (TIENDA) / OCC, EDO, FPC (ALMACEN)
  - Código adicional: **NP (Novedad de Producto)** - solo cuando presenta_novedad=true

### Archivos Implementados

#### 1. **modules/facturas/schemas.py**
- ✅ `InventarioCodigoIn`: Schema de entrada para códigos
  - Validación de código (OCT, ECT, FPC, OCC, EDO, **NP**)
  - Validación de valor (alfanumérico con guiones, no vacío)
- ✅ `InventariosPatchIn`: Schema de entrada principal
  - Campo `presenta_novedad: Optional[bool]` (obligatorio si requiere_entrada_inventarios=true)
- ✅ `InventarioCodigoOut`: Schema de salida para códigos
- ✅ `InventariosOut`: Schema de salida completo

#### 2. **modules/facturas/service.py**
- ✅ Método `update_inventarios(factura_id, inventarios_data)`
- ✅ Validación de existencia de factura (404)
- ✅ Caso 1: `requiere_entrada_inventarios=false` → Limpia todo (incluye presenta_novedad=false)
  - ⚠️ Rechaza presenta_novedad=true (400)
  - ⚠️ Rechaza código NP (400)
- ✅ Caso 2: `requiere_entrada_inventarios=true` → Validaciones completas
  - ✅ presenta_novedad obligatorio (400 si None)
  - ✅ Si presenta_novedad=true → NP requerido
  - ✅ Si presenta_novedad=false → NP rechazado (extra_codes)
- ✅ UPSERT lógico: Actualiza, crea y elimina códigos

#### 3. **modules/facturas/router.py**
- ✅ Endpoint `PATCH /facturas/{factura_id}/inventarios`
- ✅ Documentación OpenAPI completa

### Request Schema

```json
{
  "requiere_entrada_inventarios": true|false,
  "destino_inventarios": "TIENDA"|"ALMACEN"|null,
  "presenta_novedad": true|false|null,
  "codigos": [
    {
      "codigo": "OCT"|"ECT"|"FPC"|"OCC"|"EDO"|"NP",
      "valor": "string alfanumérico con guiones"
    }
  ]
}
```

### Response Schema

```json
{
  "factura_id": "uuid",
  "requiere_entrada_inventarios": true|false,
  "destino_inventarios": "TIENDA"|"ALMACEN"|null,
  "codigos": [
    {
      "codigo": "OCT",
      "valor": "ABC-123",
      "created_at": "2025-12-28T10:00:00Z"
    }
  ]
}
```

### Lógica de Negocio

#### Caso 1: `requiere_entrada_inventarios = false`

**Comportamiento:**
- `destino_inventarios` → NULL
- `presenta_novedad` → false
- Elimina TODOS los registros de `factura_inventario_codigos`
- Responde con `codigos=[]`

**Validaciones especiales:**
- ⚠️ Si payload trae `presenta_novedad=true` → 400 (no permitido)
- ⚠️ Si payload incluye código NP → 400 (no permitido)

**Request:**
```json
{
  "requiere_entrada_inventarios": false,
  "destino_inventarios": null,
  "presenta_novedad": null,
  "codigos": null
}
```
presenta_novedad` es obligatorio** → 400 si es None
3. **`codigos` es obligatorio y no vacío** → 400 si falta o está vacío
4. **Códigos requeridos según destino y novedad:**

| Destino  | presenta_novedad | Códigos Obligatorios       |
|----------|------------------|----------------------------|
| TIENDA   | false            | OCT, ECT, FPC              |
| TIENDA   | true             | OCT, ECT, FPC, **NP**      |
| ALMACEN  | false            | OCC, EDO, FPC              |
| ALMACEN  | true             | OCC, EDO, FPC, **NP**      |

5. **Validación de NP según presenta_novedad:**
   - Si `presenta_novedad=false` y viene NP → 400 con `extra_codes: ["NP"]`
   - Si `presenta_novedad=true` y falta NP → 400 con `missing_codes: ["NP"]`
6. **No se permiten códigos faltantes** → 400 con `missing_codes`
7. **No se permiten códigos extras** → 400 con `extra_codes`
8----------|----------------------|
| TIENDA   | OCT, ECT, FPC        |
| ALMACEN  | OCC, EDO, FPC        |

4. **No se permiten códigos faltantes** → 400 con `missing_codes`
5. **No se permiten códigos extras** → 400 con `extra_codes`
6. **Valores válidos:**
   - No vacíos (después de trim)
   - Solo alfanuméricos, espacios y guiones: `/^[a-zA-, **NP**
2. Campo `valor`:
   - No vacío (después de trim)
   - Solo alfanuméricos, espacios y guiones
   - Símbolos especiales rechazados con 422
3. Campo `presenta_novedad`:
   - Tipo: bool | None
   - Obligatorio cuando requiere_entrada_inventarios=true (validado en service)
#### Validaciones a Nivel Schema (Pydantic)
1. Campo `codigo` solo acepta: OCT, ECT, FPC, OCC, EDO
2. Campo `valor`:
   - No vacío (después de trim)
   - Solo alfanuméricos, espacios y guiones
   - Símbolos especiales rechazados con 422

   - ✅ Limpia todo automáticamente (destino_inventarios=NULL, presenta_novedad=false)
   - ⚠️ Rechaza presenta_novedad=true (400)
   - ⚠️ Rechaza código NP en payload (400)
3. Si `requiere_entrada_inventarios=true`:
   - ✅ `destino_inventarios` obligatorio (400)
   - ✅ `presenta_novedad` obligatorio - no puede ser None (400)
   - ✅ `codigos` obligatorio y no vacío (400)
   - ✅ Set base según destino (TIENDA vs ALMACEN)
   - ✅ Si presenta_novedad=true → agregar NP a set requerido
   - ✅ Si presenta_novedad=false → NP no puede venir (extra_codes
   - ✅ `destino_inventarios` obligatorio (400)
   - ✅ `codigos` obligatorio y no vacío (400)
   - ✅ Códigos según destino (TIENDA vs ALMACEN)
   - ✅ Sin códigos faltantes (400 con `missing_codes`)
   - ✅ Sin códigos extras (400 con `extra_codes`)
   - ✅ Valores no vacíos (400 con `invalid_values`)

### Estructura de Errores

#### Error 404: Factura no encontrada
```json
{
  "detail": "Factura con ID {uuid} no encontrada"
}
```

#### Error 400: Validación de negocio
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "missing_codes": ["ECT"],
    "extra_codes": ["OCC"],
    "invalid_values": [
      {"codigo": "OCT", "reason": "empty"}
    ],
    "error": "Descripción del error"
  }
}
```

#### Error 422: Validación Pydantic
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "codigos", 0, "valor"],
      "msg": "Value error, El valor solo puede contener letras, números, espacios y guiones"
    }
  ]
}
```

### Persistencia: UPSERT Lógico

El endpoint implementa un UPSERT completo para los códigos:

1. **UPDATE**: Si `(factura_id, codigo)` existe → actualiza `valor`
2. **INSERT**: Si no existe → crea nuevo registro
3. **DELETE**: Si existe en DB pero NO en payload → elimina (limpieza)

Esto garantiza que la tabla `factura_inventario_codigos` siempre refleje exactamente lo que está en el último payload.

### Ejemplos de Uso

#### ✅ Success: TIENDA con códigos correctos
presenta_novedad": false,
  "
**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "T-123-ABC"},
    {"codigo": "ECT", "valor": "T-456-DEF"},
    {"codigo": "FPC", "valor": "T-789-GHI"}
  ]
}
```

**Response: 200**
```json
{
  "factura_id": "550e8400-e29b-41d4-a716-446655440000",
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "ECT", "valor": "T-456-DEF", "created_at": "2025-12-28T10:00:00Z"},
    {"codigo": "FPC", "valor": "T-789-GHI", "created_at": "2025-12-28T10:00:01Z"},
    {"codigo": "OCT", "valor": "T-123-ABC", "created_at": "2025-12-28T09:59:59Z"}
  ]
}
```

#### ✅ Success: ALMACEN con códigos correctos

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "presenta_novedad": false,
  "destino_inventarios": "ALMACEN",
  "codigos": [
    {"codigo": "OCC", "valor": "A-111-XXX"},
    {"codigo": "EDO", "valor": "A-222-YYY"},
    {"codigo": "FPC", "valor": "A-333-ZZZ"}
  ]
}
```

**Response: 200**
```json
{
  "factura_id": "550e8400-e29b-41d4-a716-446655440000",
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "ALMACEN",
  "codigos": [
    {"codigo": "EDO", "valor": "A-222-YYY", "created_at": "2025-12-28T10:00:00Z"},
    {"codigo": "FPC", "valor": "A-333-ZZZ", "created_at": "2025-12-28T10:00:01Z"},
    {"codigo": "OCC", "valor": "A-111-XXX", "created_at": "2025-12-28T09:59:59Z"}
  ]
}
```

#### ✅ Success: TIENDA con novedad (incluye NP)

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "presenta_novedad": true,
  "codigos": [
    {"codigo": "OCT", "valor": "T-123-ABC"},
    {"codigo": "ECT", "valor": "T-456-DEF"},
    {"codigo": "FPC", "valor": "T-789-GHI"},
    {"codigo": "NP", "valor": "Novedad-Producto-001"}
  ]
}
```

**Response: 200**
```json
{
  "factura_id": "550e8400-e29b-41d4-a716-446655440000",
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "ECT", "valor": "T-456-DEF", "created_at": "2025-12-28T10:00:00Z"},
    {"codigo": "FPC", "valor": "T-789-GHI", "created_at": "2025-12-28T10:00:01Z"},
    {"codigo": "NP", "valor": "Novedad-Producto-001", "created_at": "2025-12-28T10:00:02Z"},
    {"codigo": "OCT", "valor": "T-123-ABC", "created_at": "2025-12-28T09:59:59Z"}
  ]
}
```

#### ❌ Error: presenta_novedad=false pero incluye NP

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "presenta_novedad": false,
  "codigos": [
    {"codigo": "OCT", "valor": "T-123"},
    {"codigo": "ECT", "valor": "T-456"},
    {"codigo": "FPC", "valor": "T-789"},
    {"codigo": "NP", "valor": "Novedad"}
  ]
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "extra_codes": ["NP"],
    "error": "NP no puede incluirse cuando presenta_novedad=false"
  }
}
```

#### ❌ Error: presenta_novedad=true pero falta NP

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "ALMACEN",
  "presenta_novedad": true,
  "codigos": [
    {"codigo": "OCC", "valor": "A-111"},
    {"codigo": "EDO", "valor": "A-222"},
    {"codigo": "FPC", "valor": "A-333"}
  ]
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "missing_codes": ["NP"],
    "error": "Faltan códigos requeridos: ['NP']"
  }
}
```

#### ❌ Error: requiere_entrada_inventarios=false pero presenta_novedad=true

**Request:**
```json
{
  "requiere_entrada_inventarios": false,
  "destino_inventarios": null,
  "presenta_novedad": true,
  "codigos": null
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "error": "presenta_novedad no puede ser true cuando requiere_entrada_inventarios=false"
  }
}
```

#### ❌ Error: Falta destino_inventarios

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": null,
  "codigos": [{"codigo": "OCT", "valor": "123"}]
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "error": "destino_inventarios es obligatorio cuando requiere_entrada_inventarios=true"
  }
}
```

#### ❌ Error: Códigos faltantes

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "123"},
    {"codigo": "FPC", "valor": "789"}
  ]
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "missing_codes": ["ECT"],
    "error": "Faltan códigos requeridos para TIENDA: {'ECT'}"
  }
}
```

#### ❌ Error: Códigos extras

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "123"},
    {"codigo": "ECT", "valor": "456"},
    {"codigo": "FPC", "valor": "789"},
    {"codigo": "OCC", "valor": "999"}
  ]
}
```

**Response: 400**
```json
{
  "detail": {
    "message": "Inventarios inválido",
    "extra_codes": ["OCC"],
    "error": "Códigos no permitidos para TIENDA: {'OCC'}"
  }
}
```

#### ❌ Error: Valor con caracteres inválidos

**Request:**
```json
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "ABC@#$%"},
    {"codigo": "ECT", "valor": "456"},
    {"codigo": "FPC", "valor": "789"}
  ]
}
```

**Response: 422**
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "codigos", 0, "valor"],
      "msg": "Value error, El valor solo puede contener letras, números, espacios y guiones"
    }
  ]
}
```

### Base de Datos

#### Tabla: `facturas` (campos nuevos)
- `requiere_entrada_inventarios`: BOOLEAN NOT NULL DEFAULT false
- `destino_inventarios`: destino_inventarios_enum NULL
- `presenta_novedad`: BOOLEAN NOT NULL DEFAULT false
- CHECK constraint: `requiere_entrada_inventarios = false OR destino_inventarios IS NOT NULL`

```sql
ALTER TABLE facturas ADD COLUMN requiere_entrada_inventarios BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facturas ADD COLUMN destino_inventarios destino_inventarios_enum NULL;
ALTER TABLE facturas ADD COLUMN presenta_novedad BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facturas ADD CONSTRAINT check_destino_inventarios_required 
  CHECK (requiere_entrada_inventarios = false OR destino_inventarios IS NOT NULL);
```

#### Tabla: `factura_inventario_codigos`
- `id`: UUID PRIMARY KEY
- `factura_id`: UUID REFERENCES facturas(id) ON DELETE CASCADE
- `codigo`: codigo_inventario_enum NOT NULL (valores: OCT, ECT, FPC, OCC, EDO, **NP**)
- `valor`: TEXT NOT NULL
- `created_at`: TIMESTAMP WITH TIME ZONE
- UNIQUE CONSTRAINT: (factura_id, codigo)

```sql
CREATE TABLE factura_inventario_codigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  codigo codigo_inventario_enum NOT NULL,
  valor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_factura_inventario_codigo UNIQUE (factura_id, codigo)
);
```

#### ENUM Types
```sql
CREATE TYPE destino_inventarios_enum AS ENUM ('TIENDA', 'ALMACEN');
CREATE TYPE codigo_inventario_enum AS ENUM ('OCT', 'ECT', 'FPC', 'OCC', 'EDO', 'NP');
```

#### Migración: 9b88d470067b_add_presenta_novedad_and_np_codigo
- ✅ Agregó columna `presenta_novedad` a tabla facturas
- ✅ Agregó valor 'NP' al ENUM codigo_inventario_enum
- ⚠️ Downgrade: Elimina columna pero mantiene 'NP' en ENUM (limitación PostgreSQL)

#### ENUM Types
```sql
CREATE TYPE destino_inventarios_enum AS ENUM ('TIENDA', 'ALMACEN');
CREATE TYPE codigo_inventario_enum AS ENUM ('OCT', 'ECT', 'FPC', 'OCC', 'EDO');
```

### Testing

#### Archivos de Testing Incluidos

1. **test_inventarios.py**: Script Python con 10 tests completos
   - Test de desactivación
   - Tests de validación (errores esperados)
   - Tests de éxito (TIENDA y ALMACEN)
   - Test de UPSERT

2. **test_inventarios.sh**: Script bash con ejemplos de cURL (Linux/Mac)

3. **test_inventarios.bat**: Script batch con ejemplos de cURL (Windows)

#### Ejecutar Tests

**Python:**
```bash
cd backend
# 1. Obtener un UUID de factura real
curl http://localhost:8000/facturas/ | jq '.items[0].id'

# 2. Editar test_inventarios.py y reemplazar FACTURA_ID_TEST

# 3. Ejecutar tests
python test_inventarios.py
```

**cURL (Windows):**
```bash
# Editar test_inventarios.bat y reemplazar FACTURA_ID
test_inventarios.bat
```

**cURL (Linux/Mac):**
```bash
# Editar test_inventarios.sh y reemplazar FACTURA_ID
chmod +x test_inventarios.sh
./test_inventarios.sh
```

#### Probar en Swagger UI
```
http://localhost:8000/docs#/Facturas/update_factura_inventarios
```

### Códigos de Estado HTTP

| Código | Descripción                                |
|--------|--------------------------------------------|
| 200    | Actualización exitosa                     |
| 400    | Error de validación (missing/extra codes) |
| 404    | Factura no encontrada                     |
| 422    | Error de validación Pydantic (valores)    |
| 500    | Error interno del servidor                |

### Características Implementadas

- ✅ **Validación estricta**: Todos los casos de error cubiertos
- ✅ **Mensajes claros**: Errores detallados con códigos faltantes/extras
- ✅ **UPSERT completo**: Actualiza, crea y limpia automáticamente
- ✅ **Transaccional**: Commit/rollback en caso de error
- ✅ **Tipos seguros**: Pydantic v2 con validaciones
- ✅ **SQL seguro**: SQLAlchemy ORM, sin SQL injection
- ✅ **Documentado**: OpenAPI/Swagger automático
- ✅ **Testeado**: Scripts de testing incluidos
- ✅ **Idempotente**: Llamadas múltiples = mismo resultado

### Conceptos Aplicados

- **DDD-lite**: Separación router → service → repository
- **Validación en capas**: Schema (Pydantic) + Service (Negocio)
- **UPSERT pattern**: Sincronización completa de registros relacionados
- **Transaccionalidad**: Garantía de consistencia
- **Error handling**: Mensajes estructurados y útiles
- **Type safety**: Pydantic + SQLAlchemy Mapped types

### Troubleshooting

#### Error: "Factura con ID ... no encontrada"
- **Causa**: El UUID no existe en la tabla `facturas`
- **Solución**: Verifica el ID con `GET /facturas/`

#### Error: "destino_inventarios es obligatorio"
- **Causa**: `requiere_entrada_inventarios=true` pero `destino_inventarios=null`
- **Solución**: Incluye `"destino_inventarios": "TIENDA"` o `"ALMACEN"`

#### Error: "Faltan códigos requeridos"
- **Causa**: No se enviaron todos los códigos para el destino
- **Solución**: Verifica la tabla de códigos requeridos según destino

#### Error: "Códigos no permitidos"
- **Causa**: Se enviaron códigos que no corresponden al destino
- **Solución**: Para TIENDA solo enviar OCT/ECT/FPC, para ALMACEN solo OCC/EDO/FPC

#### Error: Validation error en `valor`
- **Causa**: El valor contiene caracteres no permitidos
- **Solución**: Solo usar letras, números, espacios y guiones

---

## 📌 Notas Técnicas Importantes

### Autenticación y Seguridad
- **JWT Tokens:** Implementado con python-jose y passlib
- **Password Hashing:** bcrypt a través de passlib
- **Token Refresh:** Sistema de refresh tokens con invalidación
- **Roles:** admin, area_manager, user (preparado para autorización futura)

### Almacenamiento de Archivos
- **Local Storage:** Implementado en `storage/facturas/`
- **Estructura:** `{factura_id}/{doc_type}/{timestamp}_{filename}`
- **Extensibilidad:** Preparado para S3 y Google Drive
- **Validaciones:** Content-type, extensión, tamaño, duplicados

### Base de Datos
- **PostgreSQL:** Versión 13+
- **Async ORM:** SQLAlchemy 2.0 con asyncpg
- **Migraciones:** Alembic con versionado automático
- **Constraints:** Validaciones a nivel de BD y aplicación

### Paginación y Performance
- **Facturas:** Paginación con skip/limit
- **Índices:** Optimizados para queries frecuentes
- **Eager Loading:** Uso de selectin para relaciones

### Logging y Monitoreo
- **Nivel INFO:** Operaciones exitosas
- **Nivel WARNING:** Validaciones fallidas
- **Nivel ERROR:** Errores del sistema
- **Contexto:** Incluye IDs, usuarios, timestamps

### Error Handling
- **HTTPException:** Códigos HTTP apropiados
- **Pydantic Validation:** Automática en requests
- **Database Errors:** Captura y traducción a HTTP
- **Response Models:** Formato JSON consistente

---

## 🔧 Ejemplos de Testing con Postman

### Setup General
- **Base URL**: `http://localhost:8000`
- **Headers**: `Content-Type: application/json`

### Collection: Inventarios

#### Test 1: Desactivar inventarios
```
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": false,
  "destino_inventarios": null,
  "codigos": null
}

Expected: 200
Response.codigos = []
```

#### Test 2: Activar TIENDA completa
```
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "T-001"},
    {"codigo": "ECT", "valor": "T-002"},
    {"codigo": "FPC", "valor": "T-003"}
  ]
}

Expected: 200
Response.codigos.length = 3
```

#### Test 3: Activar ALMACEN completa
```
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "ALMACEN",
  "codigos": [
    {"codigo": "OCC", "valor": "A-001"},
    {"codigo": "EDO", "valor": "A-002"},
    {"codigo": "FPC", "valor": "A-003"}
  ]
}

Expected: 200
Response.codigos.length = 3
```

#### Test 4: Error - Código faltante
```
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "T-001"},
    {"codigo": "ECT", "valor": "T-002"}
  ]
}

Expected: 400
Response.detail.missing_codes = ["FPC"]
```

#### Test 5: Error - Código extra
```
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "T-001"},
    {"codigo": "ECT", "valor": "T-002"},
    {"codigo": "FPC", "valor": "T-003"},
    {"codigo": "OCC", "valor": "T-004"}
  ]
}

Expected: 400
Response.detail.extra_codes = ["OCC"]
```

#### Test 6: UPSERT - Actualizar valores
```
# Primera llamada (crear)
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "OLD-001"},
    {"codigo": "ECT", "valor": "OLD-002"},
    {"codigo": "FPC", "valor": "OLD-003"}
  ]
}

# Segunda llamada (actualizar)
PATCH /facturas/{{factura_id}}/inventarios
Body:
{
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "codigos": [
    {"codigo": "OCT", "valor": "NEW-001"},
    {"codigo": "ECT", "valor": "NEW-002"},
    {"codigo": "FPC", "valor": "NEW-003"}
  ]
}

Expected: 200
Response.codigos[0].valor = "NEW-XXX" (valores actualizados)
```

---

## 🎯 Módulo: Anticipo de Facturas

### Descripción General
Sistema para gestionar anticipos en facturas, con validación estricta de consistencia entre campos y control de porcentajes.

### Campos Relacionados

#### `tiene_anticipo`
- **Tipo**: `BOOLEAN NOT NULL`
- **Default**: `false`
- **Descripción**: Indica si la factura tiene un anticipo asociado

#### `porcentaje_anticipo`
- **Tipo**: `NUMERIC(5,2) NULL`
- **Descripción**: Porcentaje del monto que corresponde al anticipo
- **Rango válido**: 0.00 - 100.00 (cuando no es NULL)

#### `intervalo_entrega_contabilidad`
- **Tipo**: `ENUM NOT NULL`
- **Valores permitidos**: `1_SEMANA`, `2_SEMANAS`, `3_SEMANAS`, `1_MES`
- **Default**: `1_SEMANA`
- **Descripción**: Frecuencia de entrega de documentación a contabilidad

### CHECK Constraints (Base de Datos)

#### Constraint 1: `check_anticipo_porcentaje_required`
**Regla**: `tiene_anticipo = (porcentaje_anticipo IS NOT NULL)`

**Tabla de Verdad**:
| tiene_anticipo | porcentaje_anticipo | Resultado |
|----------------|---------------------|-----------|
| `false`        | `NULL`              | ✅ VÁLIDO |
| `false`        | `30.00`             | ❌ INVÁLIDO |
| `true`         | `NULL`              | ❌ INVÁLIDO |
| `true`         | `50.00`             | ✅ VÁLIDO |

**Lógica**:
- Si `tiene_anticipo = false` → `porcentaje_anticipo` DEBE ser NULL
- Si `tiene_anticipo = true` → `porcentaje_anticipo` NO puede ser NULL

#### Constraint 2: `check_porcentaje_anticipo_range`
**Regla**: `porcentaje_anticipo IS NULL OR (porcentaje_anticipo >= 0 AND porcentaje_anticipo <= 100)`

**Casos de Prueba**:
| Valor | Resultado |
|-------|-----------|
| `NULL` | ✅ VÁLIDO |
| `0.00` | ✅ VÁLIDO |
| `50.00` | ✅ VÁLIDO |
| `100.00` | ✅ VÁLIDO |
| `-10.00` | ❌ INVÁLIDO |
| `150.00` | ❌ INVÁLIDO |

### Endpoint: PATCH /facturas/{factura_id}/anticipo

#### Descripción
Actualiza los campos de anticipo de una factura existente. Valida la consistencia entre `tiene_anticipo` y `porcentaje_anticipo` a múltiples niveles.

#### Request Schema: `AnticipoUpdateIn`
```json
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS"
}
```

**Campos**:
- `tiene_anticipo` (bool, required): Indica si hay anticipo
- `porcentaje_anticipo` (float, optional): Porcentaje del anticipo (0-100)
- `intervalo_entrega_contabilidad` (enum, required): Intervalo de entrega

**Validaciones Pydantic**:
- `porcentaje_anticipo`: Debe estar entre 0 y 100 (cuando no es None)
- `model_validator`: Valida que `tiene_anticipo` sea consistente con `porcentaje_anticipo`:
  - Si `tiene_anticipo=false`, entonces `porcentaje_anticipo` debe ser None
  - Si `tiene_anticipo=true`, entonces `porcentaje_anticipo` NO puede ser None
- `extra="forbid"`: Rechaza campos adicionales

#### Response Schema: `AnticipoOut`
```json
{
  "id": "uuid",
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS"
}
```

#### Capas de Validación

##### 1. Schema Layer (Pydantic)
- **Código de Error**: `422 Unprocessable Entity`
- **Validaciones**:
  - Rango de `porcentaje_anticipo` (0-100)
  - Consistencia `tiene_anticipo` ↔ `porcentaje_anticipo`
  - Valores ENUM válidos para `intervalo_entrega_contabilidad`
  - Rechazo de campos extra
- **Ejemplo de Error**:
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Si tiene_anticipo es true, porcentaje_anticipo no puede ser null",
      "input": {...}
    }
  ]
}
```

##### 2. Service Layer (Lógica de Negocio)
- **Código de Error**: `400 Bad Request`
- **Validaciones**:
  - Doble-check del constraint `check_anticipo_porcentaje_required`
  - Doble-check del constraint `check_porcentaje_anticipo_range`
- **Formato de Error**:
```json
{
  "detail": {
    "message": "Anticipo inválido",
    "errors": [
      "Si tiene_anticipo es true, porcentaje_anticipo debe tener un valor",
      "Si tiene_anticipo es false, porcentaje_anticipo debe ser null"
    ]
  }
}
```

##### 3. Database Layer (PostgreSQL)
- **Código de Error**: `500 Internal Server Error` (si llega aquí, es un bug)
- **Constraints**: Los CHECK constraints de PostgreSQL como última línea de defensa

#### Casos de Uso

##### Caso 1: Factura sin anticipo
```http
PATCH /facturas/{factura_id}/anticipo
Content-Type: application/json

{
  "tiene_anticipo": false,
  "porcentaje_anticipo": null,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
```

**Response: 200 OK**
```json
{
  "id": "factura-uuid",
  "tiene_anticipo": false,
  "porcentaje_anticipo": null,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
```

##### Caso 2: Factura con anticipo del 50%
```http
PATCH /facturas/{factura_id}/anticipo
Content-Type: application/json

{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS"
}
```

**Response: 200 OK**
```json
{
  "id": "factura-uuid",
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS"
}
```

##### Caso 3: Actualización de anticipo existente
```http
# Primera llamada: Crear anticipo
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 30.0,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
# Response: 200 OK

# Segunda llamada: Actualizar porcentaje e intervalo
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 75.0,
  "intervalo_entrega_contabilidad": "1_MES"
}
# Response: 200 OK (valores actualizados)
```

##### Caso 4: Eliminar anticipo existente
```http
# Primera llamada: Tiene anticipo
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS"
}
# Response: 200 OK

# Segunda llamada: Quitar anticipo
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": false,
  "porcentaje_anticipo": null,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
# Response: 200 OK (anticipo eliminado)
```

#### Errores Comunes

##### Error 1: tiene_anticipo=false pero con porcentaje
```http
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": false,
  "porcentaje_anticipo": 30.0,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
```

**Response: 422 Unprocessable Entity**
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Si tiene_anticipo es false, porcentaje_anticipo debe ser null",
      "input": {...}
    }
  ]
}
```

##### Error 2: tiene_anticipo=true sin porcentaje
```http
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": null,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
```

**Response: 422 Unprocessable Entity**
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Si tiene_anticipo es true, porcentaje_anticipo no puede ser null",
      "input": {...}
    }
  ]
}
```

##### Error 3: Porcentaje fuera de rango
```http
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 150.0,
  "intervalo_entrega_contabilidad": "1_SEMANA"
}
```

**Response: 422 Unprocessable Entity**
```json
{
  "detail": [
    {
      "type": "less_than_equal",
      "loc": ["body", "porcentaje_anticipo"],
      "msg": "Input should be less than or equal to 100",
      "input": 150.0
    }
  ]
}
```

##### Error 4: Intervalo inválido
```http
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "INVALIDO"
}
```

**Response: 422 Unprocessable Entity**
```json
{
  "detail": [
    {
      "type": "enum",
      "loc": ["body", "intervalo_entrega_contabilidad"],
      "msg": "Input should be '1_SEMANA', '2_SEMANAS', '3_SEMANAS' or '1_MES'",
      "input": "INVALIDO"
    }
  ]
}
```

##### Error 5: Factura no existe
```http
PATCH /facturas/00000000-0000-0000-0000-000000000000/anticipo
{...}
```

**Response: 404 Not Found**
```json
{
  "detail": "Factura not found"
}
```

##### Error 6: Campos extra no permitidos
```http
PATCH /facturas/{factura_id}/anticipo
{
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "1_SEMANA",
  "campo_extra": "no permitido"
}
```

**Response: 422 Unprocessable Entity**
```json
{
  "detail": [
    {
      "type": "extra_forbidden",
      "loc": ["body", "campo_extra"],
      "msg": "Extra inputs are not permitted",
      "input": "no permitido"
    }
  ]
}
```

### Casos de Test (Automatizados)

El archivo `test_anticipo_endpoint.py` incluye 14 tests completos:

#### Tests de Validación (Errores Esperados)
1. **Test 3**: `tiene_anticipo=false` con `porcentaje=30` → 422
2. **Test 4**: `tiene_anticipo=true` con `porcentaje=null` → 422
3. **Test 5**: `porcentaje=150` (mayor que 100) → 422
4. **Test 6**: `porcentaje=-10` (negativo) → 422
5. **Test 10**: `intervalo_entrega_contabilidad='INVALIDO'` → 422
6. **Test 11**: Factura no existe → 404
7. **Test 12**: Campos extra rechazados → 422

#### Tests Exitosos (200 OK)
8. **Test 1**: Sin anticipo (`false`, `null`) → 200
9. **Test 2**: Con anticipo 50% → 200
10. **Test 7**: Límite inferior (`porcentaje=0`) → 200
11. **Test 8**: Límite superior (`porcentaje=100`) → 200
12. **Test 9**: Todos los valores ENUM de intervalo → 200
13. **Test 13**: Porcentaje con decimales (33.33%) → 200
14. **Test 14**: Actualizar de con anticipo a sin anticipo → 200

**Ejecutar tests**:
```bash
cd backend
python test_anticipo_endpoint.py
```

### Archivos Relacionados

#### Migración
- **Archivo**: `alembic/versions/425549563ece_add_anticipo_and_intervalo_entrega_.py`
- **Contenido**:
  - Creación de ENUM `intervalo_entrega_enum`
  - Agregado de 3 columnas nuevas
  - Agregado de 2 CHECK constraints
  - Downgrade completo

#### Modelo SQLAlchemy
- **Archivo**: `db/models.py` (clase `Factura`)
- **Campos**:
```python
tiene_anticipo: Mapped[bool] = mapped_column(
    Boolean, nullable=False, server_default="false"
)
porcentaje_anticipo: Mapped[Optional[float]] = mapped_column(
    Numeric(5, 2), nullable=True
)
intervalo_entrega_contabilidad: Mapped[str] = mapped_column(
    Enum('1_SEMANA', '2_SEMANAS', '3_SEMANAS', '1_MES', 
         name='intervalo_entrega_enum'),
    nullable=False, server_default="'1_SEMANA'"
)
```

#### Schemas Pydantic
- **Archivo**: `modules/facturas/schemas.py`
- **Clases**:
  - `IntervaloEntregaEnum`: Enum de Python con 4 valores
  - `AnticipoUpdateIn`: Schema de entrada con validaciones
  - `AnticipoOut`: Schema de respuesta

#### Service Layer
- **Archivo**: `modules/facturas/service.py`
- **Método**: `update_anticipo()`
  - Valida existencia de factura
  - Doble-check de constraints
  - Actualiza campos
  - Retorna `AnticipoOut`

#### Router
- **Archivo**: `modules/facturas/router.py`
- **Endpoint**: `@router.patch("/{factura_id}/anticipo")`
  - Documentación OpenAPI completa
  - Ejemplos de requests válidos/inválidos
  - Documentación de todos los códigos de error

### Notas Técnicas

#### Validación Multi-Capa
El sistema implementa validación en tres capas para máxima robustez:

1. **Capa Pydantic (422)**: Validación inmediata en el request
   - Más amigable para el usuario
   - Mensajes claros y específicos
   - Previene requests inválidos

2. **Capa Service (400)**: Validación de lógica de negocio
   - Double-check de reglas críticas
   - Formato estructurado de errores
   - Logging detallado

3. **Capa Database (500)**: Constraints SQL como última defensa
   - Si se llega aquí, hay un bug en el código
   - Previene corrupción de datos
   - Integridad referencial garantizada

#### ENUM Type Handling
- **Creación segura**: DO block con EXCEPTION handling
- **Evita duplicados**: No falla si el ENUM ya existe
- **Server defaults**: Valor por defecto a nivel DB
- **Migración reversible**: Downgrade completo implementado

#### Porcentaje con Decimales
- **Tipo**: `NUMERIC(5,2)` permite hasta 999.99
- **Validación**: Range 0-100 a múltiples niveles
- **Precisión**: 2 decimales (ej: 33.33%)
- **Storage**: Almacenado como decimal exacto (no float)

#### Actualización vs Creación
- **Sin diferencia**: El mismo endpoint sirve para ambos
- **Idempotencia**: Múltiples llamadas con mismos datos → mismo resultado
- **Sin versioning**: Siempre actualiza los valores actuales
- **Sin historial**: No se mantiene registro de cambios previos

---

## 🔄 Sistema de Transición de Estados

### Flujo de Aprobación de Facturas

El sistema implementa un flujo de múltiples etapas para aprobar y procesar facturas:

```
RESPONSABLE → CONTABILIDAD → TESORERIA → FINALIZADA
```

### Endpoint: Submit Responsable

**Ruta:** `POST /api/v1/facturas/{factura_id}/submit-responsable`

**Propósito:** Validar factura completa y enviar a Contabilidad

**Validaciones Exhaustivas:**
1. **Centro de Costo y Operación:** Ambos deben estar asignados
2. **Anticipo:** 
   - Si `tiene_anticipo=true` → `porcentaje_anticipo` y `intervalo_entrega_contabilidad` requeridos
   - Si `tiene_anticipo=false` → ambos campos deben ser null
3. **Inventarios (si requiere_entrada_inventarios=true):**
   - Debe tener `destino_inventarios` (TIENDA/ALMACEN)
   - Debe tener `presenta_novedad` definido
   - Códigos requeridos según matriz:
     ```
     TIENDA sin novedad: OCT, ECT, FPC
     TIENDA con novedad: OCT, ECT, FPC, NP
     ALMACEN sin novedad: OCC, EDO, FPC
     ALMACEN con novedad: OCC, EDO, FPC, NP
     ```
4. **Archivos (opcional):** Si se requieren archivos específicos

**Acción:**
- Cambia `area_id` → CONTABILIDAD (725f5e5a-49d3-4e44-800f-f5ff21e187ac)
- Busca estado con code/label ILIKE "%contabilidad%"
- `assigned_to_user_id` → NULL
- `assigned_at` → timestamp actual

**Respuesta 200:**
```json
{
  "factura_id": "uuid",
  "area_id": "uuid-contabilidad",
  "area_actual": "Contabilidad",
  "estado_id": 3,
  "estado_actual": "En Contabilidad",
  "proveedor": "...",
  "numero_factura": "...",
  "centro_costo_id": "uuid",
  "centro_operacion_id": "uuid",
  "requiere_entrada_inventarios": true,
  "destino_inventarios": "TIENDA",
  "presenta_novedad": false,
  "inventario_codigos": [
    {"codigo": "OCT", "valor": "T-123"},
    {"codigo": "ECT", "valor": "T-456"},
    {"codigo": "FPC", "valor": "T-789"}
  ],
  "tiene_anticipo": true,
  "porcentaje_anticipo": 50.0,
  "intervalo_entrega_contabilidad": "2_SEMANAS",
  "files": [...]
}
```

**Respuesta 400 (Validación fallida):**
```json
{
  "detail": {
    "message": "Validación de inventarios fallida",
    "missing_codes": ["OCT", "ECT"],
    "extra_codes": ["NP"]
  }
}
```

**Código relacionado:**
- Service: `modules/facturas/service.py` → `submit_responsable()` (277 líneas)
- Router: `modules/facturas/router.py` → `POST /{factura_id}/submit-responsable`
- Schema: `SubmitResponsableOut`, `SubmitErrorDetail`

---

### Endpoint: Submit Tesorería

**Ruta:** `POST /api/v1/facturas/{factura_id}/submit-tesoreria`

**Propósito:** Auditar factura en Contabilidad y enviar a Tesorería

**Validaciones:**
1. Factura debe existir → 404
2. Debe estar en área CONTABILIDAD (725f5e5a-49d3-4e44-800f-f5ff21e187ac) → 409 si no
3. No debe estar ya en TESORERIA → 409 si ya está

**Acción:**
- Cambia `area_id` → TESORERIA (b067adcd-13ff-420f-9389-42bfaa78cf9f)
- Cambia `estado_id` → 7
- `assigned_to_user_id` → NULL
- `assigned_at` → timestamp actual

**Respuesta 200:** Mismo formato que `SubmitResponsableOut`

**Respuesta 409:**
```json
{
  "detail": "La factura no está en Contabilidad"
}
```
o
```json
{
  "detail": "La factura ya fue enviada a Tesorería"
}
```

**Código relacionado:**
- Service: `modules/facturas/service.py` → `submit_tesoreria()` (143 líneas)
- Router: `modules/facturas/router.py` → `POST /{factura_id}/submit-tesoreria`

---

### Endpoint: Close Tesorería

**Ruta:** `POST /api/v1/facturas/{factura_id}/close-tesoreria`

**Propósito:** Finalizar factura en Tesorería validando documentos de pago

**Validaciones:**
1. Factura debe existir → 404
2. Debe estar en área TESORERIA (b067adcd-13ff-420f-9389-42bfaa78cf9f) → 409 si no
3. **Archivos requeridos:** Deben existir los siguientes doc_types:
   - **PEC** (Pago Electrónico Certificado)
   - **EC** (Estado de Cuenta)
   - **PCE** (Pago Con Egreso)

**Acción:**
- Cambia `estado_id` → 5 (estado finalizado)
- Mantiene `area_id` en TESORERIA

**Respuesta 200:** Mismo formato que `SubmitResponsableOut` incluyendo todos los archivos

**Respuesta 400 (Archivos faltantes):**
```json
{
  "detail": {
    "message": "No se puede cerrar la factura en Tesorería",
    "missing_files": ["PEC", "EC"]
  }
}
```

**Respuesta 409:**
```json
{
  "detail": "La factura no está en Tesorería"
}
```

**Código relacionado:**
- Service: `modules/facturas/service.py` → `close_tesoreria()` (156 líneas)
- Router: `modules/facturas/router.py` → `POST /{factura_id}/close-tesoreria`

---

## 📎 Sistema de Archivos (Files)

### Doc Types Permitidos

El sistema soporta los siguientes tipos de documentos:

#### Documentos de Inventario
- **OC**: Orden de Compra
- **OS**: Orden de Servicio
- **OCT**: Orden de Compra Tienda
- **ECT**: Entrada a Compra Tienda
- **OCC**: Orden de Compra Compras
- **EDO**: Entrada de Orden
- **FCP**: Factura Compra Proveedor
- **FPC**: Factura Para Contabilidad

#### Documentos de Pago
- **EGRESO**: Comprobante de Egreso
- **SOPORTE_PAGO**: Soporte de Pago
- **PEC**: Pago Electrónico Certificado (requerido en Tesorería)
- **EC**: Estado de Cuenta (requerido en Tesorería)
- **PCE**: Pago Con Egreso (requerido en Tesorería)

#### Documentos Generales
- **FACTURA_PDF**: PDF de la factura principal
- **APROBACION_GERENCIA**: Aprobación de Gerencia

### Reglas de Content Type

#### Documentos que aceptan solo PDF
Todos los doc_types excepto `APROBACION_GERENCIA`:
- **Content-Type permitido:** `application/pdf`
- **Extensión permitida:** `.pdf`

#### Documentos que aceptan PDF e Imágenes
Solo `APROBACION_GERENCIA`:
- **Content-Types permitidos:**
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- **Extensiones permitidas:** `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`

### Validaciones de Upload

**Endpoint:** `POST /api/v1/facturas/{factura_id}/files/upload`

**Validaciones:**
1. `doc_type` debe estar en `ALLOWED_DOC_TYPES`
2. `content_type` debe coincidir con doc_type
3. Extensión del archivo debe ser válida
4. No debe existir duplicado (mismo `factura_id` + `doc_type`) → 409

**Código relacionado:**
- Service: `modules/files/service.py` → `upload_file()`
- Constantes: `ALLOWED_DOC_TYPES`, `ALLOWED_CONTENT_TYPES`, `ALLOWED_EXTENSIONS`

### Migraciones de Doc Types

#### Migración 782ec018a4d8
Agregó `APROBACION_GERENCIA` al CHECK constraint

#### Migración f0bc2aa0072c
Agregó `PEC`, `EC`, `PCE` al CHECK constraint

**CHECK Constraint actual:**
```sql
CHECK (doc_type IN (
  'OC','OS','OCT','ECT','OCC','EDO','FCP','FPC',
  'EGRESO','SOPORTE_PAGO','FACTURA_PDF',
  'APROBACION_GERENCIA','PEC','EC','PCE'
))
```

---

## 🏷️ Sistema de Estados

### Endpoint: Crear Estado

**Ruta:** `POST /api/v1/estados`

**Propósito:** Crear un nuevo estado para el catálogo de estados de facturas

**Request Body:**
```json
{
  "code": "APROBADO_GERENCIA",
  "label": "Aprobado por Gerencia",
  "order": 5,
  "is_final": false,
  "is_active": true
}
```

**Validaciones:**
1. `code` debe ser único → 409 si ya existe
2. `code`: 1-50 caracteres
3. `label`: 1-100 caracteres
4. `order`: >= 1
5. `is_final`: boolean (default: false)
6. `is_active`: boolean (default: true)

**Respuesta 201:**
```json
{
  "id": 8,
  "code": "APROBADO_GERENCIA",
  "label": "Aprobado por Gerencia",
  "order": 5,
  "is_final": false,
  "is_active": true
}
```

**Respuesta 409:**
```json
{
  "detail": "Ya existe un estado con el código 'APROBADO_GERENCIA'"
}
```

**Código relacionado:**
- Service: `modules/estados/service.py` → `create_estado()`
- Repository: `modules/estados/repository.py` → `create()`, `get_by_code()`
- Router: `modules/estados/router.py` → `POST /`
- Schema: `EstadoCreate`, `EstadoResponse`

**Modelo Estado:**
```python
class Estado(Base):
    id: Mapped[int]              # SmallInteger, PK, autoincrement
    code: Mapped[str]             # Text, unique, indexed
    label: Mapped[str]            # Text
    order: Mapped[int]            # SmallInteger
    is_final: Mapped[bool]        # Boolean, default=False
    is_active: Mapped[bool]       # Boolean, default=True
```

---

## 🔄 Flujo Completo de Procesamiento de Facturas

### Diagrama de Flujo

```
┌─────────────────┐
│  RESPONSABLE    │
│  (área origen)  │
└────────┬────────┘
         │
         │ 1. Validar datos completos:
         │    - CC/CO asignados
         │    - Anticipo configurado
         │    - Inventarios completos (si aplica)
         │
         ▼
┌─────────────────────────────────────┐
│ POST /submit-responsable            │
│ ✓ Validación exhaustiva             │
│ ✓ area_id → CONTABILIDAD           │
│ ✓ estado_id → "En Contabilidad"    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  CONTABILIDAD   │
│  (auditoría)    │
└────────┬────────┘
         │
         │ 2. Revisar y auditar factura
         │
         ▼
┌─────────────────────────────────────┐
│ POST /submit-tesoreria              │
│ ✓ Validar área actual               │
│ ✓ area_id → TESORERIA              │
│ ✓ estado_id → 7                     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   TESORERIA     │
│  (pago)         │
└────────┬────────┘
         │
         │ 3. Procesar pago y subir documentos:
         │    - POST /files/upload (doc_type: PEC)
         │    - POST /files/upload (doc_type: EC)
         │    - POST /files/upload (doc_type: PCE)
         │
         ▼
┌─────────────────────────────────────┐
│ POST /close-tesoreria               │
│ ✓ Validar archivos PEC, EC, PCE    │
│ ✓ estado_id → 5 (FINALIZADA)       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   FINALIZADA    │
│ (estado final)  │
└─────────────────┘
```

### Resumen de Endpoints

| Endpoint | Área Origen | Área Destino | Validaciones Clave |
|----------|-------------|--------------|-------------------|
| `submit-responsable` | Cualquiera | CONTABILIDAD | CC/CO, Anticipo, Inventarios |
| `submit-tesoreria` | CONTABILIDAD | TESORERIA | Área actual |
| `close-tesoreria` | TESORERIA | TESORERIA | Archivos PEC/EC/PCE |

### Estados del Sistema

> ⚠️ Catálogo REAL de la tabla `estados` (verificado contra BD). Los `code`/`label`
> NO siguen el patrón mayúsculas que se documentaba antes. Usar SIEMPRE el `id`.

| ID | Code | Label | Significado |
|----|------|-------|-------------|
| 1 | recibida | Recibida por radicación | Estado inicial (Radicación) |
| 2 | asignada | Asignada a responsable | En el área responsable |
| 3 | 2 | Pendiente en contabilidad | En Contabilidad (canónico tras enviar) |
| 4 | pendiente | Pendiente | ⚠️ Estado "intruso", NO usar para Contabilidad |
| 5 | pagada | Pagada | Pagada/finalizada en Tesorería |
| 7 | Tesoreria | Pendiente en Tesoreria | En Tesorería |

**Estados asignables** (`validate_factura_assignable_state`, asignaciones/repository): solo **1, 2, 3**.
Una factura en área Contabilidad DEBE quedar en **estado_id=3** para poder enviarse a Tesorería.

#### ⚠️ Gotcha: selección de estado en `submit_responsable`

`submit_responsable` (y por extensión el **auto-envío a Contabilidad**) debe fijar
**`estado_id = 3`** de forma DETERMINISTA. NO resolver el estado con
`label ILIKE '%pendiente%'`: ese filtro coincide con los ids **3, 4 y 7**, y un
`.first()` sin `ORDER BY` puede devolver el id=4 ('Pendiente'), dejando la factura
en un estado NO asignable a Tesorería → *"Error al Aprobar: solo puede ser asignada
si está en estado Recibida/Asignada/En contabilidad"*. Fix: `select(Estado).where(Estado.id == 3)`
(igual que el camino Financiera y el manual `asignarFactura`). Remediación de datos:
`fix_estado_pendiente_contabilidad.py`.

#### ⚠️ Gotcha: auto-envío y Gastos Fijos (GADMIN)

El barrido `auto_enviar_listas_a_contabilidad` (endpoint `POST /facturas/auto-enviar-contabilidad`,
solo rol `responsable`) NO debe aplicarse al área **Gastos Fijos Café Quindío (GADMIN,
`c1589d0c-736b-4af4-89f2-81900d2dac16`)**: su flujo va DIRECTO a Tesorería
(`submit_gadmin_tesoreria`), no a Contabilidad. Si no se excluye, las facturas que
Contabilidad envía a Gastos Fijos rebotan solas de vuelta a Contabilidad al abrir la
bandeja. El router excluye GADMIN explícitamente.

### Áreas del Sistema

| ID | Nombre | UUID |
|----|--------|------|
| 1 | Contabilidad | 725f5e5a-49d3-4e44-800f-f5ff21e187ac |
| 2 | Tesorería | b067adcd-13ff-420f-9389-42bfaa78cf9f |

> `areas.es_tienda` (bool) marca qué áreas son tiendas (~64). Usado por el rol
> `responsable_tiendas`. Ver sección siguiente.

#### Historial del responsable (`historial_area`)

`GET /facturas/historial-area` → `service.historial_area(user_id)`. Una factura
aparece en el historial del área X **solo si**:
- **A)** está ACTUALMENTE en X (`area_id == X`), o
- **B)** X la originó y ya AVANZÓ en el flujo contable (`area_origen_id == X` y
  `estado_id IN (3, 5, 7)` = Contabilidad / Pagada / Tesorería).

⚠️ NO usar `factura_asignaciones` (asignaciones históricas) como fuente: mantenía en
el historial CUALQUIER asignación pasada, por lo que una factura **reasignada** a otro
responsable (p. ej. Trade → Marketing) seguía visible en el área anterior. Con A+B, al
reasignarse a otro responsable la factura sale del historial del área previa (su estado
sigue en 1/2, no avanzado), pero las que el área procesó y envió a Contabilidad/Tesorería
se conservan. (Fix commit `a67c41f`.)

### Perfil "Responsable de Tiendas" (bandeja multi-tienda)

Rol `responsable_tiendas`: un único usuario que gestiona OCT/ECT/FPC y envía a
Contabilidad las facturas de **TODAS** las tiendas (no se ata a una sola área).

- Identificación de tiendas: columna **`areas.es_tienda`** (flag explícito, robusto;
  incluye outliers que no llevan "Tienda" en el nombre y excluye el paraguas `b2c`).
  Sembrada en la migración `k5f6a7b8c9d0`.
- Listado: `GET /facturas/?solo_tiendas=true` → filtra `Factura.area_id IN (áreas con
  es_tienda=true)`. Propagado por `service.list_facturas` y `repository.get_all`.
- La factura conserva su tienda (`area_id`/`area_origen_id`): `submit_responsable`
  opera sobre la tienda real, así que la trazabilidad por tienda queda intacta.
- El auto-envío a Contabilidad NO aplica (está gateado al rol `responsable`); este
  usuario envía manualmente desde el detalle ("Enviar a Contabilidad").
- Alta del usuario: `create_responsable_tiendas.py` (area_id NULL, must_change_password=true).
  Personalizable con env `RT_EMAIL`, `RT_PASSWORD`. Idempotente.
- Frontend: reutiliza `ResponsablePage`/`InboxView`/`ResponsableFacturaDetail`; la
  columna "Area Receptora" muestra la tienda de cada factura, con filtro tipo Excel
  (embudo) `AreaFilterPopover`. OJO: el detalle se elige por rol en `InboxView`, hay
  que incluir `responsable_tiendas` junto a `responsable` o cae en el modal genérico.

**Despliegue en producción (EC2/Aurora):** script `deploy-responsable-tiendas-ec2.sh`
(idempotente). Ejecutar desde `/home/ubuntu/CONTABILIDADCQ/backend`:
```bash
git pull origin main
RT_EMAIL=tiendas@cafequindio.com RT_PASSWORD='ClaveFuerte#2026' bash deploy-responsable-tiendas-ec2.sh
```
Hace: `alembic upgrade head` (es_tienda + rol) → `create_responsable_tiendas.py` →
`systemctl restart contabilidadcq`. Valida que `DATABASE_URL` sea Aurora (no localhost).
Aparte hay que recompilar y desplegar el frontend (`npm run build`). Aurora solo es
accesible desde el EC2 (VPC), no desde máquinas locales.

---

## 🎨 Frontend - Integración con React

### Configuración del Frontend

#### Variables de Entorno
Archivo: `frontend/.env.local`
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Cliente API (`src/lib/api.ts`)

Cliente centralizado para todas las comunicaciones con el backend.

#### Interfaces TypeScript

```typescript
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  nombre: string;
}

export interface DashboardMetrics {
  recibidas: number;
  asignadas: number;
  cerradas: number;
  pendientes: number;
}

export interface Area {
  id: string;
  nombre: string;
}

export interface FacturaAsignada {
  numero_factura: string;
  proveedor: string;
  area: string;
  quien_la_tiene: string;
  fecha_asignacion: string;
  estado: string;
}
```

#### Funciones del Cliente API

**Autenticación:**
- `login(email: string, password: string): Promise<LoginResponse>`
  - Endpoint: `POST /auth/login`
  - Guarda tokens en localStorage
  
- `getCurrentUser(): Promise<User>`
  - Endpoint: `GET /auth/me`
  - Incluye Authorization header automáticamente
  
- `logout(): void`
  - Limpia tokens de localStorage
  
- `hasValidSession(): boolean`
  - Verifica existencia de access_token

**Dashboard:**
- `getDashboardMetrics(): Promise<DashboardMetrics>`
  - Endpoint: `GET /dashboard/facturas/metrics`
  - Retorna métricas de facturas por estado
  
- `getAreas(): Promise<Area[]>`
  - Endpoint: `GET /areas/`
  - Lista todas las áreas disponibles
  
- `getFacturasAsignadas(): Promise<FacturaAsignada[]>`
  - Endpoint: `GET /dashboard/areas/recientes-asignadas`
  - Retorna facturas recientemente asignadas con detalles

#### Helper Interno

```typescript
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
  skipAuthRedirect = false
): Promise<T>
```

- Agrega automáticamente `Authorization: Bearer <token>`
- Maneja errores 401 (sesión expirada) con logout automático
- Parsea respuestas JSON
- Lanza `ApiError` con detalles del backend

### Flujo de Autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Ingresa email/password
    F->>B: POST /auth/login
    B->>DB: Verifica credenciales
    DB-->>B: Usuario válido
    B-->>F: access_token + refresh_token
    F->>F: Guarda en localStorage
    F->>B: GET /auth/me
    B-->>F: Datos del usuario
    F-->>U: Redirige a Dashboard
```

### Componentes del Frontend

#### App.tsx
- Gestión global de estado de autenticación
- Verificación de sesión al montar (`useEffect`)
- Renderizado condicional: LoginPage vs Dashboard
- Loading state durante verificación inicial

**Estados principales:**
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [userName, setUserName] = useState<string>("");
const [isLoading, setIsLoading] = useState(true);
```

#### LoginPage.tsx
- Formulario de autenticación
- Validación de campos
- Loading state durante login
- Manejo de errores con mensajes informativos
- Integración con `api.login()`

**Manejo de errores:**
```typescript
try {
  await login(email, password);
  await refreshUserData();
} catch (err) {
  setError("Email o contraseña incorrectos. Por favor, verifica tus credenciales.");
}
```

#### Dashboard.tsx
- Visualización de métricas de facturas
- Filtrado por área
- Búsqueda de facturas
- Paginación
- Estados de loading y error

**Integración con API:**
```typescript
useEffect(() => {
  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [metricsData, areasData, facturasData] = await Promise.all([
        getDashboardMetrics(),
        getAreas(),
        getFacturasAsignadas(),
      ]);
      setMetrics(metricsData);
      // ... procesar áreas y facturas
    } catch (err) {
      setError("Error al cargar los datos del dashboard");
    } finally {
      setIsLoading(false);
    }
  };
  loadDashboardData();
}, [activeSection]);
```

**Características implementadas:**
- ✅ Métricas en tiempo real (recibidas, asignadas, cerradas, pendientes)
- ✅ Lista de áreas desde base de datos
- ✅ Tabla de facturas asignadas con datos reales
- ✅ Filtrado por área y búsqueda
- ✅ Skeleton loading durante carga
- ✅ Manejo de errores con mensajes claros
- ✅ Estados con colores (Asignada, En Curso, Cerrada, etc.)

#### InboxView.tsx (Bandeja de Facturas)
- Vista principal de bandeja de entrada de facturas
- Lista paginada de todas las facturas
- Búsqueda por proveedor y número de factura
- Filtrado por estado
- Drawer lateral con detalle de factura
- Actualización de área de la factura

**Integración con API:**
```typescript
useEffect(() => {
  const loadInboxData = async () => {
    const [facturasData, areasData] = await Promise.all([
      getFacturas(0, 1000),
      getAreas(),
    ]);
    setFacturas(facturasData.items);
    setAreas(areasData);
  };
  loadInboxData();
}, []);
```

**Funcionalidades:**
- ✅ Lista completa de facturas desde backend
- ✅ Métricas por estado (Total, Recibidas, Cerradas)
- ✅ Búsqueda en tiempo real
- ✅ Filtrado por estado dinámico
- ✅ Paginación (10 items por página)
- ✅ Drawer con detalle completo de factura
- ✅ Actualización de área con confirmación
- ✅ Loading states durante carga
- ✅ Manejo de errores con mensajes
- ✅ Vista previa de documento PDF (placeholder)

### Mapeo de Campos Backend → Frontend

| Backend (snake_case) | Frontend | Descripción |
|---------------------|----------|-------------|
| `numero_factura` | `numero_factura` | Número de factura |
| `quien_la_tiene` | `quien_la_tiene` | Usuario asignado |
| `fecha_asignacion` | `fecha_asignacion` | Fecha de asignación |
| `estado` | `estado` | Estado de la factura |

**Nota:** El frontend mantiene snake_case para campos de backend para simplificar el mapeo.

### Configuración de Estados

```typescript
const estadoConfig: Record<string, { color: string; bgColor: string }> = {
  'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'Asignada': { color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'En Curso': { color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'Cerrada': { color: 'text-green-700', bgColor: 'bg-green-100' },
  // Fallback para estados no definidos
  // Se usa: bg-gray-100 text-gray-700
};
```

### Manejo de Errores

**Errores de Autenticación (401):**
```typescript
if (response.status === 401 && !skipAuthRedirect) {
  clearTokens();
  window.location.href = '/';
  throw new Error('Sesión expirada');
}
```

**Errores del Backend:**
```typescript
interface ApiError {
  detail: string | { message: string; [key: string]: any };
}
```

El cliente parsea automáticamente errores 422 (Validación), 400 (Bad Request), 500 (Internal Server Error).

### Próximas Mejoras Frontend

- [ ] Implementar refresh token automático antes de expiración
- [ ] Agregar debounce en búsqueda de facturas
- [ ] Caché de datos del dashboard con invalidación inteligente
- [ ] Loading states más granulares (por sección)
- [ ] Notificaciones toast para operaciones exitosas/fallidas
- [ ] Página de detalle de factura con edición
- [ ] Upload de archivos desde frontend
- [ ] Filtros avanzados (por fecha, proveedor, estado)

### Archivos del Frontend

```
frontend/
├── .env.local              # Variables de entorno (no commitear)
├── src/
│   ├── App.tsx            # Punto de entrada, gestión de sesión
│   ├── lib/
│   │   └── api.ts         # Cliente API completo
│   └── components/
│       ├── LoginPage.tsx  # Autenticación
│       └── Dashboard.tsx  # Vista principal con datos reales
├── package.json
└── vite.config.ts
```

---

**Última actualización:** 29 de diciembre de 2025