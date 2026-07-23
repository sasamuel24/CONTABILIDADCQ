# Automatización OC → Contabilidad (n8n + Siesa)

**Fecha:** 16 de julio de 2026
**Estado:** ✅ Funcionando completo en entorno local — ⏳ pendiente de deploy a producción

---

## 1. Visión y objetivo

Acortar el flujo de facturación de compras usando la **Orden de Compra (OC)** que n8n captura del XML de la factura electrónica (validada en Siesa).

**Flujo original (4 pasos):**

```
Facturación electrónica → Radicación → Responsable → Contabilidad
```

El paso por el Responsable existe únicamente para completar a mano: orden de compra, centro de costo y centro de operación.

**Flujo nuevo (automático, cuando la OC trae los datos):**

```
Facturación electrónica → [API valida OC + CC + CO] → Contabilidad (directo)
```

Las facturas que NO traen OC o clasificación completa siguen el flujo normal — el sistema nunca deja pasar una factura incompleta.

---

## 2. Reglas de negocio acordadas

| Decisión | Acuerdo |
|---|---|
| Condición para saltar al responsable | `numero_oc` ≠ null (no se exige estado de la OC) |
| Clasificación contable exigida | CC + CO resueltos contra catálogos (en cabecera o por distribución) |
| Devolución desde Contabilidad | Cae a **Radicación** en estado "Recibida por radicación" |
| Facturas con inventarios | **Excluidas** del auto-ruteo (los códigos OCT/ECT/FPC no vienen en el XML) |
| Interruptor | Flag `AUTO_RUTEO_OC` en `.env` — default apagado; se enciende por entorno |

---

## 3. Qué se implementó (backend)

### 3.1 Campos nuevos que acepta el POST `/api/v1/facturas/` (ingesta n8n)

| Campo | Tipo | Comportamiento |
|---|---|---|
| `tipo_doc` | texto | Se guarda tal cual (ej. "OC") |
| `numero_oc` | texto/número | Se guarda; acepta número sin comillas (5103) |
| `estado_oc` | texto | Se guarda tal cual (ej. "APROBADA") |
| `c_costo` | texto | Se **resuelve** contra catálogo `centros_costo` → `centro_costo_id` |
| `c_operacion` | texto | Se resuelve contra `centros_operacion` → `centro_operacion_id` |
| `unidad_negocio` | texto | Se resuelve contra `unidades_negocio` → `unidad_negocio_id` |
| `distribucion` | arreglo | Crea filas en `facturas_distribucion_ccco` (ver 3.3) |

**Resolución de catálogos** (`_resolver_catalogo_id` en `modules/facturas/service.py`):
- Match exacto por **código o nombre**, sin distinguir mayúsculas.
- Tolera pérdida de ceros iniciales (n8n manda `801` y resuelve `0801`).
- Valores `""`, `"null"`, `"undefined"` → se tratan como "no viene".
- Sin match → la factura se guarda con el campo en null + warning en el log (nunca falla la creación).

### 3.2 Auto-ruteo a Contabilidad (`_auto_rutear_a_contabilidad`)

Al crear la factura, si `AUTO_RUTEO_OC=True` y cumple **numero_oc + (CC y CO de cabecera, o distribución completa) + sin inventarios**:

- `area` → Contabilidad, `estado` → 3 (Pendiente en contabilidad)
- `fecha_envio_contabilidad` → ahora
- `area_origen_id` → Radicación (para que la devolución caiga allá)
- `enrutada_automaticamente` → `true` (trazabilidad)

Ajuste asociado en `devolver_a_responsable`: si el área de origen es Radicación, la factura vuelve en estado "Recibida por radicación" (estado 1), no "Asignada a responsable".

### 3.3 Distribución de Centros de Costo / Operación

Dos caminos:

1. **Implícita (la que usa n8n hoy):** si la factura llega con OC + CC + CO de cabecera y sin tabla explícita, el backend crea **una línea al 100%** con CC/CO/UN de la cabecera.
2. **Explícita (disponible para el futuro):** n8n puede enviar `"distribucion": [{c_costo, c_operacion, unidad_negocio?, porcentaje | valor}]`. Acepta porcentajes directos o valores en pesos (los convierte a %), normaliza para sumar 100 exacto, y es **todo-o-nada**: si una línea no resuelve, no crea ninguna y la factura va al responsable.

### 3.4 Migraciones Alembic (pendientes de aplicar en producción)

| Revisión | Qué agrega |
|---|---|
| `s3t4u5v6w7x8` | Columnas `tipo_doc`, `numero_oc`, `estado_oc` en `facturas` |
| `t4u5v6w7x8y9` | Columna `enrutada_automaticamente` en `facturas` |

Cadena: `r2s3t4u5v6w7 (prod actual) → u5v6w7x8y9z0 (cruce gastos) → s3t4u5v6w7x8 → t4u5v6w7x8y9`

---

## 4. Qué se implementó (frontend)

En `ContabilidadFacturaDetail.tsx` — identidad visual **violeta con ícono ⚡** para todo lo validado desde Siesa (distinta del verde = validación humana y rojo = faltante):

- Badge "**Automática · Siesa**" en el encabezado del detalle.
- "OC / OS:" muestra "⚡ OC 5103 · validada en Siesa (APROBADA)" en vez de "No adjuntado" en rojo.
- "Aprobación Gerencia:" muestra "⚡ Cubierta por OC 5103 · Siesa" — la aprobación de la OC en Siesa reemplaza la aprobación por correo.
- Fila "Orden de Compra" en Información de la Factura.
- La tabla "Distribución de Centros de Costo / Operación" se llena automáticamente.

Nota técnica: los colores van como estilos inline porque `index.css` es un snapshot parcial de Tailwind (las clases violeta no existen en él).

---

## 5. Configuración n8n (nodo HTTP Request)

- **URL local (pruebas):** `https://<url-ngrok>.ngrok-free.app/api/v1/facturas/` (ver `docs/guias/GUIA_NGROK_LOCAL.md`)
- **URL producción (cuando se despliegue):** `https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1/facturas/` (el `/v1` extra es el stage de API Gateway)
- **Header:** `x-api-key` con la clave del `.env` del backend.
- Body: los campos de la sección 3.1 con expresiones `{{ $json.campo }}`.

**Comportamiento de deduplicación:** si ya existe una factura con el mismo `numero_factura` + `proveedor`, la API devuelve la existente **sin actualizarla**. Para re-probar una misma factura hay que borrarla antes de la BD.

---

## 6. Dónde estamos hoy (16-jul-2026)

### ✅ Hecho y probado en local
- Ingesta n8n → ngrok → API local → BD local, ciclo completo verificado.
- Factura real SODIMAC `66141204576` (OC 5103) entró y quedó directo en Contabilidad con distribución 100% y visual Siesa.
- Casos borde probados: sin OC → Radicación; OC sin CC → Radicación; códigos sin ceros iniciales → resuelven; catálogo inexistente → no rompe; valores vacíos de n8n → no rompen.

### ⏳ Pendiente
1. **Commits y deploy a EC2:** `git pull` + `alembic upgrade head` (3 migraciones: cruce + OC + auto-ruteo) + restart `contabilidadcq.service`, y repuntar n8n a la URL de producción.
2. **Encender el flag en producción:** agregar `AUTO_RUTEO_OC=True` al `.env` de la EC2 (decisión consciente, se puede desplegar apagado y observar logs primero).
3. **`c_costo` real desde Siesa:** el flujo n8n actual trae `c_costo: null` y se probó con un valor quemado (`0801`). Antes de producción hay que resolver de dónde sale el centro de costo real de cada OC — si no viene, esas facturas deben seguir yendo al responsable (el sistema ya maneja ese caso).
4. **Fase 2 (mejoras):** adjuntar el PDF de la factura/OC desde n8n (endpoint de files) para que "Factura Radicada" no quede vacía; replicar la visual Siesa en los detalles de Tesorería y Centro Documental; distribución multilinea real si Siesa la provee.

---

## 7. Archivos tocados

**Backend:** `core/config.py` (flag), `db/models.py`, `modules/facturas/schemas.py`, `modules/facturas/service.py`, `alembic/versions/s3t4u5v6w7x8_*.py`, `alembic/versions/t4u5v6w7x8y9_*.py`

**Frontend:** `src/lib/api.ts` (tipos), `src/components/ContabilidadFacturaDetail.tsx` (visual)

**Config local (no versionada):** `backend/.env` (`AUTO_RUTEO_OC=True`), `frontend/.env.local` (apunta a `localhost:8000`)
