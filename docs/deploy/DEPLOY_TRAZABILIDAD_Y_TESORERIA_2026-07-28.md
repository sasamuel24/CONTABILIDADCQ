# Deployment: Trazabilidad de facturas + Tesorería (28-Jul-2026)

Desplegado en producción el 28-jul-2026. EC2 en commit `647ba83`. **Sin migraciones propias** (ver ⚠️ *Migración pendiente ajena* al final).

| Commit | Cambio | Estado |
|---|---|---|
| `f42fc19` | Historial de facturas: fechas y textos falsos | ✅ Desplegado |
| `a3057b9` | Fecha de cierre visible en Tesorería | ✅ Desplegado |
| `647ba83` | Archivado masivo en una sola petición | ✅ Desplegado |
| `1dc0854` | (ajeno) Tiendas sin marcar | ⚠️ Código desplegado, **migración sin aplicar** |

## 📋 Resumen

1. **El historial de facturas afirmaba hechos que no ocurrieron** — fecha prestada de otra área, devolución sin fecha y un texto que inventaba un ruteo automático.
2. **La fecha de cierre de Tesorería existía en la BD pero no llegaba a ninguna pantalla de Tesorería.**
3. **El archivado en lote perdía facturas** por disparar N peticiones HTTP en paralelo.

---

## 1. Historial de facturas: fechas y textos falsos

**Commit:** `f42fc19` — `backend/modules/facturas/service.py::historial_factura`

### Caso reportado

Factura `PAQE652890` (EXXE LOGÍSTICA, `33c9996e-127d-4d3d-9289-fd6f456e70d8`): el historial mostraba
*"Asignada a Torre Control — Asignación automática por área"* fechada el **28-jul**, cuando la factura
llegó a Torre Control el **24-jul** y `enrutada_automaticamente = false`.

### Causa raíz — tres defectos independientes

**a) `assigned_at` es un campo único de la factura, no uno por área.**
Cuando el área actual no tiene fila en `factura_asignaciones`, el historial genera un evento sintético
(fallback para ingestas XML). Ese evento se fechaba con `factura.assigned_at`, que pertenece a la
**última asignación real** — la de otra área. En `PAQE652890`, `assigned_at = 28-jul 13:11 UTC` era la
marca del pase a **Contabilidad**, no de la llegada a Torre Control.

**b) La devolución se emitía con `"fecha": None`.**
El comparador manda los eventos sin fecha al final de la lista, así que el hecho que explicaba el
regreso (Camilo devolvió la factura) quedaba desconectado de la línea de tiempo.

**c) Texto de respaldo engañoso.**
`"Asignación automática por área."` se escribe cuando `assigned_to_user_id` es NULL. No significa que
el sistema haya ruteado nada, pero se lee exactamente así.

### Comportamiento nuevo

- El evento sintético del área actual **no usa `assigned_at`** si la última fila de
  `factura_asignaciones` apunta a otra área. En su lugar toma `created_at` cuando el área actual es
  también el área de origen.
- Si la factura volvió por una devolución, **no se emite** el evento sintético: lo cuenta el evento de
  devolución, ahora fechado. Se agrega el evento de llegada al área de origen con `created_at`.
- La devolución lleva fecha, área destino, quién la devolvió y a cargo de quién queda.
- El texto pasa a `"A cargo del área; sin responsable nominal asignado."`.

### ⚠️ Gotcha crítico: `motivo_devolucion` no se limpia al avanzar

`motivo_devolucion` **solo** se pone a NULL en `submit_responsable` (`service.py:1563`). Al avanzar a
Tesorería (`submit_tesoreria`) o al cerrar, el motivo **queda como dato viejo**.

Fechar toda devolución con `updated_at` habría inventado **471 regresos falsos**. Por eso se distingue:

```python
devolucion_vigente = bool(factura.motivo_devolucion) and not (
    factura.fecha_envio_contabilidad or factura.fecha_envio_tesoreria or factura.fecha_cierre
)
```

- **Vigente** → evento fechado, `"Devuelta a {área}"`.
- **Anterior** → `"Devolución registrada (anterior)"`, **sin fecha**. No se inventa cuándo ocurrió.

### Alcance (sobre 5.154 facturas)

| Facturas | Situación previa |
|---|---|
| 1.241 | Fecha prestada + texto de ruteo automático |
| 47 | Devolución vigente sin fecha, al final de la lista |
| 471 | Devolución antigua (habrían recibido una fecha falsa) |

Corregidas por código, **sin migración ni backfill**.

### Verificación

Se ejecutó `historial_factura` contra Aurora en una **copia aislada** del backend en `/tmp` del EC2
(producción intacta), comparando código viejo vs nuevo sobre **32 facturas** de perfiles distintos
(devueltas, en Radicación, en Tesorería, con área origen distinta, recientes). Sin errores y sin
pérdida de información.

Línea de tiempo resultante de `PAQE652890`:

```
24-jul 12:22  Factura recibida en Radicación — EXXE LOGISTICA S.A.S
24-jul 12:22  Asignada a Torre Control
27-jul 15:50  Solicitud de aprobación a Gerencia
28-jul 08:09  Aprobada por Gerencia (correo) — Nataly Hidalgo Montoya
28-jul 08:11  Asignada a Contabilidad — Camilo Contabilidad
28-jul 14:18  Devuelta a Torre Control — "se envió a torre de control el 24 y a
              contabilidad el 28 fuera de cierre de mes de julio"
```

---

## 2. Fecha de cierre de Tesorería visible en sus vistas

**Commit:** `a3057b9`

`facturas.fecha_cierre` ya se poblaba (`service.py:2066`, `repository.py:248`) pero **no salía en
ningún payload que consuman las vistas de Tesorería** — solo la usaba el historial del responsable
(`/facturas/historial-area`).

### Backend

- `FacturaBandejaItem` y `FacturaListItem` exponen `fecha_cierre` y `fecha_envio_tesoreria`.
- `repository.get_bandeja_tesoreria()` incluye `Factura.fecha_cierre` en el SELECT plano.
- `service.bandeja_tesoreria()` y el mapeo de `FacturaListItem` lo propagan.

### Frontend

| Vista | Componente | Cómo se ve |
|---|---|---|
| Carpetas de Tesorería | `CarpetasTesoreriaView.tsx` | Columna **"Fecha de cierre"**, ordenable |
| Explorador de archivos | `ExploradorArchivosTesoreria.tsx` | Línea verde **"Cerrada: 28 jul 2026"** |

`FacturaBandeja` / `FacturaListItem` en `api.ts` y el mapeo `bandejaToListItem` incorporan el campo.

### Estado de los datos (verificado en Aurora)

| Estado | Total en carpeta | Sin `fecha_cierre` |
|---|---|---|
| Pagada | 3.092 | **0** |
| Pendiente en Tesorería | 1.716 | 1.716 (correcto: aún no se cierran) |

**No requiere backfill.** Existe `backend/fix_fechas_historial.py` por si en el futuro aparecen
Pagadas sin fecha.

---

## 3. Archivado masivo: una sola petición

**Commit:** `647ba83`

### Caso reportado

Tesorería archivó facturas manualmente durante ~2 horas; el sistema dio error y **no archivó todas
las seleccionadas**, sin indicar cuáles faltaron.

### Evidencia en logs (28-jul, 14:47 UTC = 09:47 Colombia)

- ~50 `POST /facturas/{id}/carpeta-tesoreria` **en el mismo segundo**.
- **Todas las que llegaron respondieron `200 OK`.** Cero 5xx, cero errores de BD.
- Las que fallaron **no dejaron rastro en el servidor**: murieron antes de llegar.

### Causa raíz

`api.ts::asignarFacturasACarpetaTesoreriaMasivo` disparaba **una petición por factura, todas en
paralelo** (`Promise.allSettled` sobre un `.map`), sin límite de concurrencia ni reintento. Con lotes
grandes, el navegador y API Gateway no las sostienen todas.

Agravantes de UX:
- El `alert()` decía cuántas fallaron, **no cuáles**.
- `onSuccess()` recargaba la lista y **borraba la selección** → imposible reintentar solo las faltantes.

### Solución

**Nuevo endpoint:** `POST /api/v1/facturas/carpeta-tesoreria/masivo`

```jsonc
// Request
{ "carpeta_id": "uuid", "factura_ids": ["uuid", "..."] }   // máx. 2000

// Response
{
  "carpeta_id": "uuid",
  "carpeta_nombre": "PAGOS DEL 4 AL 10 DE MAYO",
  "solicitadas": 3,
  "archivadas": 2,
  "no_archivadas": [{ "factura_id": "uuid", "motivo": "La factura ya no existe en el sistema" }]
}
```

- Un único `UPDATE ... WHERE id IN (...)` dentro de **una transacción**.
- Valida la carpeta **antes** de escribir → `404` sin tocar nada.
- **Deduplica** ids preservando el orden de llegada.
- Declarado **antes** de las rutas `/{factura_id}/...` en el router.

> El endpoint unitario `POST /facturas/{factura_id}/carpeta-tesoreria` **se mantiene**: lo sigue usando
> `AsignarCarpetaModal_new.tsx`.

**Frontend** (`AsignarCarpetaTesoreriaModal.tsx`): se elimina el `alert()`. Si hay facturas sin
archivar, el modal **no se cierra** y lista los números afectados con su motivo, más un botón
*"Entendido, actualizar lista"*. Si la petición falla entera, avisa que **nada cambió** y que puede
reintentar sin rehacer la selección.

### Verificación (contra Aurora, copia aislada)

| Caso | Resultado |
|---|---|
| Solo un id inexistente | `archivadas=0`, reportado, **sin escribir** |
| Carpeta inexistente | `404`, sin tocar nada |
| 2 reales + 1 falso + 1 repetido | 4 enviados → `solicitadas=3`, `archivadas=2`, 1 reportado |
| Post-verificación | Las facturas de prueba siguen en su carpeta original |

En producción, vía API Gateway, responde `404` ante carpeta inexistente sin efectos.

> Nota: la prueba usó facturas **ya archivadas en esa misma carpeta** (Pagadas, sin
> `motivo_devolucion`), así el UPDATE fue un no-op salvo por `updated_at`.

---

## 🚀 Procedimiento de deploy ejecutado

`git pull` HTTPS falla en sesiones SSH **no interactivas** (sin TTY no puede pedir credenciales:
`could not read Username for 'https://github.com'`). Desde la shell interactiva del usuario **sí
funciona**. Para deploys automatizados se usa el bundle:

```bash
# Local
git bundle create /tmp/deploy.bundle <sha-actual-ec2>..main
scp -i key-contabilidad.pem /tmp/deploy.bundle ubuntu@52.14.199.224:/tmp/

# En la EC2
cd /home/ubuntu/CONTABILIDADCQ
git pull /tmp/deploy.bundle main
sudo systemctl restart contabilidadcq.service
```

**Verificación post-deploy:**
- `systemctl is-active contabilidadcq.service` → `active`
- `curl http://localhost:8000/health` → BD conectada
- `curl http://localhost:8000/api/v1/openapi.json | grep carpeta-tesoreria/masivo`
- `journalctl -u contabilidadcq.service --since "-2 min" | grep -iE "error|traceback"` → vacío
- Frontend: Amplify se despliega solo con el push a `main`

### 🧪 Patrón de verificación sin tocar producción

Para probar código nuevo contra datos reales sin desplegarlo:

```bash
rm -rf /tmp/verif && mkdir -p /tmp/verif
cd ~/CONTABILIDADCQ/backend
tar --exclude=venv --exclude=__pycache__ -cf - . | (cd /tmp/verif && tar -xf -)
ln -sfn ~/CONTABILIDADCQ/backend/venv /tmp/verif/venv   # el venv se comparte por symlink
cp /tmp/<archivo_parcheado>.py /tmp/verif/modules/facturas/
cd /tmp/verif && ./venv/bin/python <script_de_chequeo>.py
```

El script lee `DATABASE_URL` del `.env` copiado y llama al servicio directamente, evitando necesitar
un JWT. Comparar la salida de `/tmp/verif` (nuevo) contra `/tmp/verif_old` (actual) detecta
regresiones antes de desplegar. **Borrar los temporales al terminar** y confirmar
`git status --porcelain` limpio en `~/CONTABILIDADCQ`.

---

## ⚠️ Migración pendiente ajena

El deploy del 28-jul arrastró el commit `1dc0854` *(fix(tiendas): marca como tienda las areas que no
aparecían en la bandeja del responsable)*, que ya estaba en `main`. **Su código está en producción
pero su migración no se aplicó:**

```
alembic current : v6w7x8y9z0a1
alembic heads   : w7x8y9z0a1b2   ← pendiente
```

`w7x8y9z0a1b2_mark_missing_tiendas.py` hace `UPDATE areas SET es_tienda = true` para los codes
`FONTANAR`, `T94`, `Tienda NQS` y `Bocagrande`. Sin ella, esas facturas siguen invisibles para el rol
`responsable_tiendas`.

**Nada está roto:** el código de áreas no depende de la migración y el servicio está activo sin
errores. Para completarlo:

```bash
cd ~/CONTABILIDADCQ/backend && ./venv/bin/alembic upgrade head
sudo systemctl restart contabilidadcq.service
```

Tiene `downgrade()`, así que es reversible.

---

## 📌 Pendientes conocidos

1. **Falta la columna `fecha_devolucion` en `facturas`.** El historial aproxima la fecha de devolución
   con `updated_at`: si alguien edita una factura devuelta, esa fecha se corre. `gastos_legalizacion`
   ya tiene `fecha_devolucion_gasto` como referencia. Requiere migración.
   > Ojo: el archivado masivo también toca `updated_at` (por `onupdate` de `TimestampMixin`).

2. **Horas corridas 5 h en los eventos de asignación.** `factura_asignaciones.created_at` es
   `TIMESTAMP WITHOUT TIME ZONE`, mientras las demás fechas son `timestamptz`. Pydantic serializa la
   primera sin `Z`, el navegador la interpreta como hora local y la corre 5 h. Visible en
   `PAQE652890`: "Asignada a Contabilidad" se muestra 13:11 cuando en BD son las 08:11 Colombia.
   Defecto **anterior** a este deploy; afecta a todas las facturas.

3. **`GET /api/v1/facturas/` no exige autenticación.** No tiene `Depends(get_current_user)`
   (`router.py::list_facturas`), a diferencia de `exportar-plano`. Devuelve `200` con proveedor,
   valores y archivos sin token. Debe cerrarse antes de entregar la API al equipo financiero.
