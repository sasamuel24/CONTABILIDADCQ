# API Endpoints - CONTABILIDADCQ Backend

## 📋 Resumen de Implementación

Todos los endpoints han sido implementados siguiendo el patrón **Router → Service → Repository** con conexión a los modelos ORM de PostgreSQL.

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

## 📁 Files Module (`/api/v1`)

### GET `/api/v1/facturas/{factura_id}/files/pdf`
**Descripción:** Descarga el PDF de una factura

**Response (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="factura.pdf"`

**Errores:** 404 Not Found

---

### GET `/api/v1/facturas/{factura_id}/files`
**Descripción:** Lista todos los archivos de una factura

**Response (200):**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "factura_id": "550e8400-e29b-41d4-a716-446655440000",
    "storage_provider": "local",
    "storage_path": "storage/facturas/2025/12/factura.pdf",
    "filename": "factura.pdf",
    "content_type": "application/pdf",
    "size_bytes": 245632,
    "uploaded_at": "2025-12-15T09:05:00"
  }
]
```

---

### GET `/api/v1/files/{file_id}`
**Descripción:** Descarga un archivo específico por ID

**Response (200):**
- Content-Type: Según tipo de archivo
- Content-Disposition: `attachment; filename="..."`

**Errores:** 404 Not Found

---

## 🔧 Configuración y Testing

### Variables de Entorno Necesarias

Agregar a `.env`:
```env
# JWT (agregar estas nuevas)
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Comandos para Iniciar

```bash
# Ejecutar servidor
uvicorn main:app --reload

# Docs interactivas
http://localhost:8000/docs
```

---

## ✅ Estado de Implementación

| Módulo | Router | Service | Repository | ORM | Estado |
|--------|--------|---------|------------|-----|--------|
| Auth | ✅ | ✅ | ✅ | ✅ | Completo |
| Dashboard | ✅ | ✅ | ✅ | ✅ | Completo |
| Areas | ✅ | ✅ | ✅ | ✅ | Completo |
| Estados | ✅ | ✅ | ✅ | ✅ | Completo |
| Facturas | ✅ | ✅ | ✅ | ✅ | Completo |
| Files | ✅ | ✅ | ✅ | ✅ | Completo |

---

## 📌 Notas Importantes

1. **Autenticación JWT:** Implementada con python-jose y passlib
2. **Storage de archivos:** Por defecto local en `storage/`, listo para extender a S3
3. **Paginación:** Implementada en listado de facturas
4. **Validación:** Todos los endpoints usan Pydantic schemas
5. **Logging:** Todas las operaciones logueadas
6. **Error handling:** HTTPException con códigos apropiados

---

**Última actualización:** 22 de diciembre de 2025
