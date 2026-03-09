# Arquitectura de Base de Datos — Módulo Técnico / Legalización de Gastos

> **Página analizada:** `src/pages/TecnicoMantenimientoPage.tsx`
> **Fecha:** 2026-03-03
> **Módulo:** Legalización semanal de gastos de campo (técnicos de mantenimiento)

---

## 1. Resumen del Módulo

La página `TecnicoMantenimientoPage` implementa un sistema de **legalización de gastos semanales** para técnicos de mantenimiento que trabajan en campo. Su función principal es permitir que un técnico agrupe sus comprobantes de gasto de la semana en un "paquete", lo envíe para revisión y siga su estado hasta el pago.

### Flujo de estados del paquete

```
[Borrador] ──(enviar)──> [En revisión]
                               │
                    ┌──────────┴──────────┐
                    │                     │
              (aprobar)             (devolver)
                    │                     │
               [Aprobado]           [Devuelto]
                    │                     │
              (pagar/cerrar)      (corregir y reenviar)
                    │                     │
               [Pagado]           [En revisión]
```

### Entidades identificadas en el frontend

| Entidad frontend | Descripción |
|---|---|
| `PaqueteSemanal` | Agrupación semanal de gastos de un técnico |
| `GastoFila` | Línea de detalle de un gasto individual |
| `Documento` | Archivo soporte adjunto a una línea de gasto |
| `EstadoPaquete` | Enum: Borrador, En revisión, Devuelto, Aprobado, Pagado |

---

## 2. Análisis de Reutilización de Tablas Existentes

Antes de crear nuevas tablas, se identificaron las siguientes tablas del sistema actual que **se pueden reutilizar directamente** mediante FK:

| Tabla existente | Campo en `GastoFila` | Uso |
|---|---|---|
| `centros_costo` | `centroCostos` | FK para asociar el gasto a un centro de costo ya registrado |
| `centros_operacion` | `centroOperacion` | FK para asociar el gasto a un centro de operación |
| `cuentas_auxiliares` | `cuentaContable` | FK para la cuenta contable del gasto |
| `users` | `user_id` | FK al técnico que crea el paquete |
| `areas` | `area_id` | FK al área del técnico |

> **Nota:** La tabla `files` existente **NO se reutiliza** porque su campo `factura_id` es `NOT NULL`, lo que la acopla obligatoriamente al módulo de facturas. Para los soportes de gastos se crea una tabla propia `archivos_gasto`.

---

## 4. Tablas Nuevas a Crear

### 4.1 `paquetes_gastos` — Paquete semanal de legalización

Entidad central del módulo. Agrupa los gastos de un técnico en una semana.

```sql
CREATE TABLE paquetes_gastos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Propietario
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    area_id             UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,

    -- Identificación de semana
    semana              VARCHAR(10) NOT NULL,        -- Ej: "2026-W09"
    fecha_inicio        DATE NOT NULL,               -- Lunes de la semana
    fecha_fin           DATE NOT NULL,               -- Domingo de la semana

    -- Estado del workflow
    estado              VARCHAR(20) NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN ('borrador','en_revision','devuelto','aprobado','pagado')),

    -- Datos calculados / cacheados
    monto_total         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_documentos    INTEGER NOT NULL DEFAULT 0,

    -- Fechas del workflow
    fecha_envio         TIMESTAMPTZ,                -- NULL mientras está en borrador
    fecha_aprobacion    TIMESTAMPTZ,
    fecha_pago          TIMESTAMPTZ,

    -- Revisado por (admin/contabilidad/tesoreria)
    revisado_por_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_paquetes_gastos_user_id  ON paquetes_gastos(user_id);
CREATE INDEX idx_paquetes_gastos_estado   ON paquetes_gastos(estado);
CREATE INDEX idx_paquetes_gastos_semana   ON paquetes_gastos(semana);

-- Un técnico solo puede tener un paquete por semana (evita duplicados)
CREATE UNIQUE INDEX uq_paquete_user_semana ON paquetes_gastos(user_id, semana);
```

**Campos clave:**

| Campo | Tipo | Descripción |
|---|---|---|
| `semana` | VARCHAR(10) | Formato ISO week: `"2026-W09"`. Corresponde al selector `<input type="week">` del frontend |
| `fecha_inicio / fecha_fin` | DATE | Rango legible de la semana, se calcula del valor `semana` |
| `estado` | VARCHAR CHECK | Controla el workflow. Mapeado al tipo `EstadoPaquete` del frontend |
| `monto_total` | NUMERIC | Se recalcula cada vez que cambian las líneas de gasto (trigger o servicio) |
| `revisado_por_user_id` | UUID FK | Quién aprobó/devolvió el paquete |

---

### 4.2 `gastos_legalizacion` — Líneas de detalle de gasto

Cada fila de la tabla de gastos en el frontend corresponde a un registro de esta tabla.

```sql
CREATE TABLE gastos_legalizacion (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación al paquete padre
    paquete_id              UUID NOT NULL REFERENCES paquetes_gastos(id) ON DELETE CASCADE,

    -- Datos del comprobante
    fecha                   DATE NOT NULL,
    no_identificacion       VARCHAR(30) NOT NULL,    -- NIT / CC del proveedor
    pagado_a                VARCHAR(200) NOT NULL,   -- Nombre del proveedor
    concepto                VARCHAR(300) NOT NULL,   -- Descripción del gasto
    no_recibo               VARCHAR(100),            -- Número de factura/recibo

    -- Clasificación contable (FK a tablas existentes)
    centro_costo_id         UUID REFERENCES centros_costo(id) ON DELETE SET NULL,
    centro_operacion_id     UUID REFERENCES centros_operacion(id) ON DELETE SET NULL,
    cuenta_auxiliar_id      UUID REFERENCES cuentas_auxiliares(id) ON DELETE SET NULL,

    -- Valor
    valor_pagado            NUMERIC(14, 2) NOT NULL CHECK (valor_pagado > 0),

    -- Orden visual de la fila en la tabla
    orden                   SMALLINT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_gastos_legalizacion_paquete ON gastos_legalizacion(paquete_id);
CREATE INDEX idx_gastos_legalizacion_cc      ON gastos_legalizacion(centro_costo_id);
CREATE INDEX idx_gastos_legalizacion_co      ON gastos_legalizacion(centro_operacion_id);
```

**Campos clave:**

| Campo | Tipo | Descripción |
|---|---|---|
| `no_identificacion` | VARCHAR | NIT o cédula del proveedor (campo `noIdentificacion` en el frontend) |
| `no_recibo` | VARCHAR | Número de la factura o recibo de caja |
| `centro_costo_id` | UUID FK | Reutiliza tabla `centros_costo` existente |
| `centro_operacion_id` | UUID FK | Reutiliza tabla `centros_operacion` existente |
| `cuenta_auxiliar_id` | UUID FK | Reutiliza tabla `cuentas_auxiliares` existente |
| `orden` | SMALLINT | Mantiene el orden de las filas tal como el técnico las ingresó |

---

### 4.3 `archivos_gasto` — Soportes adjuntos por línea de gasto

Cada fila de gasto puede tener **un soporte** (PDF o imagen). Esta tabla gestiona los archivos almacenados en S3.

```sql
CREATE TABLE archivos_gasto (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    paquete_id              UUID NOT NULL REFERENCES paquetes_gastos(id) ON DELETE CASCADE,
    gasto_id                UUID NOT NULL REFERENCES gastos_legalizacion(id) ON DELETE CASCADE,

    -- Metadata del archivo
    filename                TEXT NOT NULL,
    s3_key                  TEXT NOT NULL,           -- Path completo en S3
    categoria               VARCHAR(50) NOT NULL
                            CHECK (categoria IN (
                                'Combustible','Hospedaje','Alimentacion',
                                'Viaticos / Casetas','Materiales','Otro'
                            )),
    content_type            TEXT NOT NULL,           -- 'application/pdf' | 'image/jpeg' | 'image/png'
    size_bytes              BIGINT NOT NULL CHECK (size_bytes > 0),

    -- Quién subió el archivo
    uploaded_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un gasto tiene máximo un soporte
CREATE UNIQUE INDEX uq_archivo_por_gasto ON archivos_gasto(gasto_id);

-- Índices
CREATE INDEX idx_archivos_gasto_paquete ON archivos_gasto(paquete_id);
CREATE INDEX idx_archivos_gasto_gasto   ON archivos_gasto(gasto_id);
```

**Estructura en S3:**
```
bucket-facturas-contabilidad-cq2026/
└── dev/
    └── gastos/
        └── {paquete_id}/
            └── {gasto_id}/
                └── {filename}           ← soporte del gasto
```

**Campos clave:**

| Campo | Tipo | Descripción |
|---|---|---|
| `categoria` | VARCHAR CHECK | Tipo de gasto: Combustible, Hospedaje, etc. Permite generar el listado de `Documento[]` del frontend |
| `s3_key` | TEXT | Path completo en el bucket S3 |
| `content_type` | TEXT | Permite al frontend saber si mostrar ícono PDF o imagen |
| `uq_archivo_por_gasto` | UNIQUE | Garantiza máximo 1 soporte por fila de gasto (consistente con el UI) |

---

### 4.4 `comentarios_paquete` — Observaciones del revisor

Permite que el administrador adjunte un motivo al devolver un paquete. Se mantiene historial de todas las observaciones.

```sql
CREATE TABLE comentarios_paquete (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    paquete_id          UUID NOT NULL REFERENCES paquetes_gastos(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Contenido
    texto               TEXT NOT NULL,
    tipo                VARCHAR(20) NOT NULL DEFAULT 'observacion'
                        CHECK (tipo IN ('observacion','devolucion','aprobacion','pago')),

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comentarios_paquete_paquete ON comentarios_paquete(paquete_id);
```

**Tipos de comentario:**

| Tipo | Cuándo se crea |
|---|---|
| `devolucion` | El revisor devuelve el paquete (contiene el `comentarioAdmin` del frontend) |
| `aprobacion` | El revisor aprueba el paquete |
| `pago` | Tesorería confirma el pago |
| `observacion` | Comentario libre sin cambio de estado |

---

### 4.5 `historial_estados_paquete` — Auditoría de transiciones

Registro inmutable de cada cambio de estado para trazabilidad completa.

```sql
CREATE TABLE historial_estados_paquete (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    paquete_id          UUID NOT NULL REFERENCES paquetes_gastos(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Transición
    estado_anterior     VARCHAR(20),                 -- NULL cuando se crea el borrador
    estado_nuevo        VARCHAR(20) NOT NULL,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_estados_paquete ON historial_estados_paquete(paquete_id);
```

---

## 5. Diagrama de Relaciones (ERD)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TABLAS EXISTENTES                            │
│                                                                      │
│  users ◄──────────────────────────────────────────────────────┐      │
│  areas ◄──────────────────────────────────────────┐           │      │
│  centros_costo ◄───────────────────────┐          │           │      │
│  centros_operacion ◄────────────┐      │          │           │      │
│  cuentas_auxiliares ◄────────┐  │      │          │           │      │
└──────────────────────────────┼──┼──────┼──────────┼───────────┼──────┘
                               │  │      │          │           │
                               │  │      │          │           │
┌──────────────────────────────┼──┼──────┼──────────┼───────────┼──────┐
│                         TABLAS NUEVAS                                │
│                               │  │      │          │           │      │
│  paquetes_gastos ─────────────┼──┼──────┘ (area_id)│           │      │
│  (user_id)─────────────────── ┼──┼────────────────┘           │      │
│  (revisado_por_user_id)────── ┼──┼────────────────────────────┘      │
│       │                       │  │                                   │
│       │ 1:N                   │  │                                   │
│       ▼                       │  │                                   │
│  gastos_legalizacion          │  │                                   │
│  (centro_costo_id) ───────────┘  │                                   │
│  (centro_operacion_id) ──────────┘                                   │
│  (cuenta_auxiliar_id) ───────────────────────── cuentas_auxiliares   │
│       │                                                              │
│       │ 1:1                                                          │
│       ▼                                                              │
│  archivos_gasto                                                      │
│  (uploaded_by_user_id) ──────────────────────── users               │
│                                                                      │
│  comentarios_paquete ────────────────────────── paquetes_gastos      │
│  (user_id) ──────────────────────────────────── users               │
│                                                                      │
│  historial_estados_paquete ──────────────────── paquetes_gastos      │
│  (user_id) ──────────────────────────────────── users               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Módulo Backend a Crear

Siguiendo el patrón de módulos existente del proyecto, se deben crear los siguientes archivos:

```
backend/
└── modules/
    └── gastos/
        ├── __init__.py
        ├── router.py          # Endpoints REST
        ├── schemas.py         # Modelos Pydantic
        ├── service.py         # Lógica de negocio y validaciones
        └── repository.py     # Acceso a datos (queries)
```

### Endpoints REST propuestos

**Prefijo:** `/api/v1/gastos`

```
# Paquetes
GET    /api/v1/gastos/paquetes/               → Lista paquetes del técnico autenticado
POST   /api/v1/gastos/paquetes/               → Crear nuevo paquete (borrador)
GET    /api/v1/gastos/paquetes/{id}           → Detalle del paquete
PATCH  /api/v1/gastos/paquetes/{id}           → Actualizar semana/datos del paquete

# Workflow
POST   /api/v1/gastos/paquetes/{id}/enviar           → Borrador → En revisión
POST   /api/v1/gastos/paquetes/{id}/aprobar          → En revisión → Aprobado (admin)
POST   /api/v1/gastos/paquetes/{id}/devolver         → En revisión → Devuelto (admin)
POST   /api/v1/gastos/paquetes/{id}/pagar            → Aprobado → Pagado (tesoreria)

# Líneas de gasto
GET    /api/v1/gastos/paquetes/{id}/gastos/          → Listar gastos del paquete
POST   /api/v1/gastos/paquetes/{id}/gastos/          → Agregar línea de gasto
PATCH  /api/v1/gastos/paquetes/{id}/gastos/{gid}     → Editar línea de gasto
DELETE /api/v1/gastos/paquetes/{id}/gastos/{gid}     → Eliminar línea de gasto

# Archivos soporte
POST   /api/v1/gastos/paquetes/{id}/gastos/{gid}/archivo   → Subir soporte (S3)
DELETE /api/v1/gastos/paquetes/{id}/gastos/{gid}/archivo   → Eliminar soporte
GET    /api/v1/gastos/paquetes/{id}/gastos/{gid}/archivo/download → Pre-signed URL

# Comentarios
GET    /api/v1/gastos/paquetes/{id}/comentarios/     → Listar comentarios
```

### Validaciones de negocio (service.py)

**Al enviar para revisión (`/enviar`):**
- El paquete debe estar en estado `borrador` o `devuelto`
- Debe tener al menos 1 línea de gasto
- Todas las líneas deben tener `valor_pagado > 0`
- El campo `semana` debe ser válido y no futuro
- Se recomienda validar que todas las líneas tengan soporte adjunto (opcional o requerido, según política)

**Al devolver (`/devolver`):**
- El paquete debe estar en estado `en_revision`
- El motivo (texto) es obligatorio → se guarda como `comentarios_paquete` de tipo `devolucion`

**Al aprobar (`/aprobar`):**
- Solo usuarios con rol `admin`, `contabilidad` o definido para revisión
- El paquete debe estar en estado `en_revision`

**Al pagar (`/pagar`):**
- Solo usuarios con rol `tesoreria` o `admin`
- El paquete debe estar en estado `aprobado`

---

## 7. Migración de Alembic

El nombre de la migración sugerido:

```bash
alembic revision --autogenerate -m "add gastos legalizacion tecnico mantenimiento"
```

**Orden de creación de tablas en la migración** (para respetar FK dependencies):

```
1. paquetes_gastos          (depende de: users, areas)
2. gastos_legalizacion      (depende de: paquetes_gastos, centros_costo, centros_operacion, cuentas_auxiliares)
3. archivos_gasto           (depende de: paquetes_gastos, gastos_legalizacion, users)
4. comentarios_paquete      (depende de: paquetes_gastos, users)
5. historial_estados_paquete (depende de: paquetes_gastos, users)
```

---

## 8. Routing Frontend

Agregar en `App.tsx`:

```tsx
import { TecnicoMantenimientoPage } from './pages/TecnicoMantenimientoPage';

// Dentro del Router:
<Route path="/tecnico-mantenimiento" element={
  <ProtectedRoute allowedRoles={['tecnico', 'admin']}>
    <TecnicoMantenimientoPage />
  </ProtectedRoute>
} />
```

Agregar la redirección por rol en la raíz `/`:

```tsx
case 'tecnico':
  return <Navigate to="/tecnico-mantenimiento" />;
```

---

## 9. Impacto en Tablas Existentes

| Tabla | Tipo de impacto | Detalle |
|---|---|---|
| `roles` | **INSERT** (solo datos) | Agregar rol `tecnico` con code `'tecnico'` |
| `users` | Sin cambio de schema | Los técnicos se crean con `role_id` apuntando al nuevo rol `tecnico` |
| `centros_costo` | Sin cambio | Referenciada por FK desde `gastos_legalizacion` |
| `centros_operacion` | Sin cambio | Referenciada por FK desde `gastos_legalizacion` |
| `cuentas_auxiliares` | Sin cambio | Referenciada por FK desde `gastos_legalizacion` |
| `files` | Sin cambio | NO se reutiliza; se crea tabla independiente `archivos_gasto` |
| `areas` | Sin cambio | Referenciada por FK desde `paquetes_gastos` |

---

## 10. Resumen de Tablas Nuevas

| Tabla | Filas estimadas (por mes) | Propósito |
|---|---|---|
| `paquetes_gastos` | ~4 por técnico activo | Un paquete semanal por técnico |
| `gastos_legalizacion` | ~20-40 por paquete | Líneas de gasto individuales |
| `archivos_gasto` | ~20-40 por paquete | Soportes en S3 (PDF / Imagen) |
| `comentarios_paquete` | ~1-3 por paquete | Observaciones del revisor |
| `historial_estados_paquete` | ~3-5 por paquete | Auditoría de estados |

---

*Documento generado el 2026-03-03 — Versión 1.0*
*Basado en análisis de `TecnicoMantenimientoPage.tsx` y modelos existentes en `backend/db/models.py`*
