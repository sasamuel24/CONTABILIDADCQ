# Deployment: Export plano exige valor sin IVA + Check "Cruce" (16-Jul-2026)

Desplegado en producción el 16-jul-2026 (EC2 en commit `4743734`, migración `u5v6w7x8y9z0` aplicada en Aurora).

## 📋 Resumen de Cambios

Dos funcionalidades del módulo de gastos (paquetes de legalización), ambas en la vista de detalle del paquete que usa Facturación (`ResponsablePaquetesView`):

1. **Export plano bloquea si falta el valor sin IVA** — la columna I del XLSX (`F351_VALOR_DB`) siempre lleva la base antes de impuestos.
2. **Check "Cruce" por gasto** — Facturación lo marca y Tesorería lo ve en su bandeja.

## 1. Export plano exige valor sin IVA validado

**Commit:** `dd8f44b`

### Contexto / causa raíz

El export (`GET /gastos/paquetes/{id}/exportar-plano`) ya usaba `valor_sin_impuestos` en la columna I desde el 9-jul, **pero con fallback silencioso** a `valor_pagado` (total con IVA) cuando el gasto no estaba validado. En producción solo 34 de 1.638 gastos tenían la base validada, así que en la práctica casi todos los planos salían con IVA incluido.

### Comportamiento nuevo

- Si **algún gasto activo** (no devuelto) del paquete tiene `valor_sin_impuestos = NULL`, el export responde **409** con un mensaje que lista hasta 5 gastos pendientes (nombre + valor) y la instrucción de usar "Calcular sin IVA (IA)" o digitarlos manualmente.
- El frontend ya mostraba `err.detail` en el toast, no requirió cambios.
- Con todos los gastos validados, la columna I = `valor_sin_impuestos` (redondeado, sin decimales).

**Archivo:** `backend/modules/gastos/router.py` (función `exportar_plano_paquete`).

### Flujo operativo para Facturación

1. Abrir el paquete → botón morado **"Calcular sin IVA (IA)"** (analiza soportes con Claude Haiku).
2. Gastos que la IA no pudo validar: digitarlos en la columna "Valor sin IVA" (o botón `=T` si el soporte no discrimina impuestos).
3. **"Exportar plano"** — solo sale cuando todo está validado.

> ⚠️ Si la IA falla con "credit balance is too low" (créditos Anthropic agotados), la validación debe hacerse manual — el export queda bloqueado hasta completarla.

## 2. Check "Cruce" por gasto

**Commit:** `90c3ee9`

### Base de datos

- Nueva columna: `cruce BOOLEAN NOT NULL DEFAULT false` en `gastos_legalizacion`.
- Migración: `u5v6w7x8y9z0_add_cruce_gastos.py`.

### Backend

- **Modelo** (`backend/db/models.py`): campo `cruce` en `GastoLegalizacion`.
- **Schemas** (`backend/modules/gastos/schemas.py`): `cruce: bool = False` en `GastoOut`; nuevo `CruceUpdate {cruce: bool}`.
- **Router** (`backend/modules/gastos/router.py`): nuevo endpoint
  `PATCH /gastos/paquetes/{paquete_id}/gastos/{gasto_id}/cruce`
  - Permiso: `_check_rol_vsi` (Radicación/Facturación, mismo permiso del valor sin impuestos).
  - Devuelve el `GastoOut` actualizado.

### Frontend

- **API** (`frontend/src/lib/api.ts`): `actualizarCruceGasto(paqueteId, gastoId, cruce)`; campo `cruce: boolean` en `GastoOut`.
- **`ResponsablePaquetesView.tsx`** (Facturación): columna "Cruce" (checkbox) entre "Valor sin IVA" y "Soporte". Editable solo con `puedeGestionarVSI`; guarda al instante con spinner; gastos devueltos muestran "—".
- **`TesoreriaPaquetesView.tsx`** (Tesorería): columna "Cruce" de solo lectura después de "Valor" — badge "✓ Cruce" si está marcado, "—" si no.

El cruce **no afecta** el export plano ni ningún cálculo; es puramente informativo entre Facturación y Tesorería.

## ⚠️ Lección: cadena de migraciones con trabajo WIP sin commitear

**Commit:** `4743734`

La migración de cruce se creó inicialmente descendiendo de `t4u5v6w7x8y9` (migración del auto-ruteo OC que **aún no está commiteada**). Eso habría roto `alembic upgrade head` en la EC2 con `Can't locate revision 't4u5v6w7x8y9'`.

**Solución aplicada** — se reencadenó ANTES de las WIP:

```
r2s3t4u5v6w7 (valor_sin_impuestos, en producción)
  → u5v6w7x8y9z0 (cruce, en producción)          ← commiteada/desplegada
  → s3t4u5v6w7x8 (datos OC n8n, WIP)             ← down_revision editado a u5v6w7x8y9z0
  → t4u5v6w7x8y9 (enrutada_automaticamente, WIP)
```

- El `down_revision` de `s3t4u5v6w7x8` quedó apuntando a `u5v6w7x8y9z0` en el working tree — **commitear así** cuando se cierre el auto-ruteo OC.
- La BD local se corrigió con `alembic stamp head` (todo estaba aplicado físicamente).

**Regla general:** una migración que se va a commitear/desplegar por separado NUNCA debe descender de una migración WIP sin commitear. Antes de commitear una migración, verificar que toda su cadena de `down_revision` esté en el repo (`git ls-files backend/alembic/versions`).

## 🚀 Procedimiento de deploy ejecutado

El `git pull` HTTPS en la EC2 falla sin credenciales; se usó el workaround del bundle:

```bash
# Local
git bundle create /tmp/deploy.bundle <sha-actual-ec2>..main
scp -i key-contabilidad.pem /tmp/deploy.bundle ubuntu@52.14.199.224:/tmp/

# En la EC2
cd /home/ubuntu/CONTABILIDADCQ
git pull /tmp/deploy.bundle main
cd backend && venv/bin/alembic upgrade head
sudo systemctl restart contabilidadcq.service
```

**Verificación post-deploy:**
- `systemctl is-active contabilidadcq.service` → `active`
- `curl http://localhost:8000/health` → BD conectada
- El endpoint `/gastos/{gasto_id}/cruce` aparece en `/api/v1/openapi.json`
- Frontend: Amplify se despliega solo con el push a `main`

## 🧪 Gotcha de desarrollo local

El backend local (`uvicorn main:app --port 8000`) corría **sin `--reload`**: los cambios de código no se tomaban y el endpoint nuevo devolvía 404 ("Error al actualizar el cruce"). En desarrollo usar:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
