# Informe de Cambios — 25 de Marzo 2026

## Sistema: CONTABILIDADCQ
---

## Resumen Ejecutivo

Se implementaron tres funcionalidades principales:
1. **Documentos para Tesorería** — adjuntar PDF contable general al paquete y CM PDF por gasto individual
2. **Vista de Auditoría en Tesorería** — vista detallada de paquetes con modo auditoría antes de pagar
3. **Previsualización de PDFs** — visualizar doc contable y CM PDF sin salir de la aplicación

---

## 1. Documento Contable General (nivel paquete)

### Descripción
Facturación necesitaba adjuntar un **documento contable general** (PDF) al paquete antes de enviarlo a Tesorería. Este documento aplica a todas las facturas electrónicas del paquete.

### Cambios Backend

**`backend/db/models.py`**
- `PaqueteGasto`: agregados campos `doc_contable_s3_key` (Text) y `doc_contable_filename` (String 255)

**`backend/modules/gastos/schemas.py`**
- `PaqueteOut`: agregados campos `doc_contable_filename` y `doc_contable_s3_key`

**`backend/modules/gastos/service.py`**
- `subir_doc_contable()` — sube PDF contable al S3 (solo rol `fact`/`admin`, estado `aprobado`)
- `get_doc_contable_download_url()` — genera URL prefirmada de descarga
- `eliminar_doc_contable()` — elimina el archivo de S3 y limpia los campos

**`backend/modules/gastos/router.py`**
- `POST /api/v1/gastos/paquetes/{id}/doc-contable`
- `GET  /api/v1/gastos/paquetes/{id}/doc-contable/download`
- `DELETE /api/v1/gastos/paquetes/{id}/doc-contable`

---

## 2. CM PDF por Gasto Individual

### Descripción
Para facturas que **no son electrónicas**, Facturación debe adjuntar un **PDF de CM** (documento contable manual) a cada fila de gasto del paquete.

### Cambios Backend

**`backend/db/models.py`**
- `GastoLegalizacion`: agregados campos `cm_pdf_s3_key` (Text) y `cm_pdf_filename` (String 255)

**`backend/modules/gastos/schemas.py`**
- `GastoOut`: agregados campos `cm_pdf_filename` y `cm_pdf_s3_key`

**`backend/modules/gastos/service.py`**
- `subir_cm_pdf_gasto()` — sube CM PDF al S3 por gasto (solo rol `fact`/`admin`, estado `aprobado`)
- `get_cm_pdf_gasto_download_url()` — genera URL prefirmada
- `eliminar_cm_pdf_gasto()` — elimina el archivo del S3

**`backend/modules/gastos/router.py`**
- `POST   /api/v1/gastos/paquetes/{id}/gastos/{gasto_id}/cm-pdf`
- `GET    /api/v1/gastos/paquetes/{id}/gastos/{gasto_id}/cm-pdf/download`
- `DELETE /api/v1/gastos/paquetes/{id}/gastos/{gasto_id}/cm-pdf`

---

## 3. Migración de Base de Datos

**Archivo:** `backend/alembic/versions/f1a2b3c4d5e6_add_doc_contable_and_cm_pdf.py`

```sql
ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS doc_contable_s3_key TEXT;
ALTER TABLE paquetes_gastos ADD COLUMN IF NOT EXISTS doc_contable_filename VARCHAR(255);
ALTER TABLE gastos_legalizacion ADD COLUMN IF NOT EXISTS cm_pdf_s3_key TEXT;
ALTER TABLE gastos_legalizacion ADD COLUMN IF NOT EXISTS cm_pdf_filename VARCHAR(255);
```

**Aplicada en producción (EC2):**
```
Running upgrade e0f1a2b3c4d5 -> f1a2b3c4d5e6
Running upgrade cfa7400cdc6e, f1a2b3c4d5e6 -> 5ae7a5edf0c8 (merge heads)
```

---

## 4. Cambios Frontend — Vista Facturación

**`frontend/src/lib/api.ts`**
- Tipos `PaqueteOut` y `GastoOut` actualizados con los nuevos campos
- 6 nuevas funciones API:
  - `subirDocContable()`, `getDocContableDownloadUrl()`, `eliminarDocContable()`
  - `subirCmPdfGasto()`, `getCmPdfGastoDownloadUrl()`, `eliminarCmPdfGasto()`

**`frontend/src/components/ResponsablePaquetesView.tsx`**

*Sección "Documento Contable General"* (en header card, visible desde estado `aprobado`):
- Botón subir PDF (solo Facturación, estado `aprobado`)
- Botón ojo 👁 — previsualización en iframe fullscreen
- Botón descarga con nombre del archivo
- Botón eliminar (solo Facturación, estado `aprobado`)

*Columna "CM PDF"* (en tabla de gastos):
- Botón subir PDF morado por fila (solo Facturación, estado `aprobado`)
- Botón ojo 👁 — previsualización
- Botón descarga con nombre del archivo
- Botón eliminar por fila

*Modal de previsualización:*
- Iframe 92vh de ancho completo
- Botón "Descargar" en el header del modal
- Botón cerrar (X)

---

## 5. Vista de Auditoría — Tesorería

**`frontend/src/components/TesoreriaPaquetesView.tsx`** — reescritura completa

### Lista de paquetes (vista anterior mejorada)
- Filas **clicables** — al hacer clic en cualquier fila se abre la auditoría
- Botón "Pagar" abre la vista de auditoría (en vez de pagar directamente)
- Hover azul en filas para indicar que son clicables

### Vista de auditoría (`DetalleAuditoriaTes`)
Header card con:
- Semana, folio, badge de estado
- Badge morado **"Modo Auditoría"**
- Técnico, monto total / monto a pagar, fecha envío, total documentos
- **Aprobación de Gerencia** — botón ojo 👁 + descarga
- **Documento Contable General** — botón ojo 👁 + descarga (o "Sin documento contable")
- **Botón "Registrar Pago"** prominente (solo si estado = `en_tesoreria`)
- Badge verde "Pagado el [fecha]" si ya fue pagado

Tabla completa de gastos con columnas:
- Fecha, Pagado a, Concepto, No. Recibo
- Centro Costo, Centro Operación, Cuenta Contable
- Valor
- **Soportes** — botón ojo 👁 + descarga por soporte
- **CM PDF** — botón ojo 👁 + descarga (morado)
- **Estado** — badge verde "OK" o rojo "Devuelto"
- Filas en rojo para gastos devueltos
- Total a pagar en footer

Historial de observaciones — todos los comentarios del paquete

Modal de previsualización con botón **"Descargar"** en el header.

---

## 6. Rutas S3 de los nuevos archivos

| Tipo | Ruta S3 |
|------|---------|
| Documento Contable | `dev/facturas/gastos/{paquete_id}/doc_contable/{filename}` |
| CM PDF por gasto | `dev/facturas/gastos/{paquete_id}/{gasto_id}/cm_pdf/{filename}` |

---

## 7. Reglas de negocio

| Acción | Rol requerido | Estado paquete |
|--------|--------------|----------------|
| Subir doc contable | `fact` / `admin` | `aprobado` |
| Eliminar doc contable | `fact` / `admin` | `aprobado` |
| Subir CM PDF | `fact` / `admin` | `aprobado` |
| Eliminar CM PDF | `fact` / `admin` | `aprobado` |
| Ver / descargar | Cualquier rol autorizado | Cualquier estado |
| Registrar pago | `tesoreria` / `admin` | `en_tesoreria` |

---

## 8. Comandos de despliegue ejecutados en EC2

```bash
# Activar entorno virtual
source venv/bin/activate

# Aplicar migración (hubo conflicto de heads, se resolvió con merge)
alembic merge heads -m "merge heads"
alembic upgrade head

# Reiniciar servicio backend
sudo systemctl restart contabilidadcq
```

---

*Informe generado el 25 de marzo de 2026*
