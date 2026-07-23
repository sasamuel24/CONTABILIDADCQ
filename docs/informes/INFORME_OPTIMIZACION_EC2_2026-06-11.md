# Informe de Optimización de Rendimiento — CONTABILIDADCQ
**Fecha:** 2026-06-11
**Síntoma reportado:** Respuestas de hasta 10 segundos en cargar facturas, botones de enviar/guardar y navegación general. Lentitud transversal en toda la app.

---

## TL;DR — Causa raíz
**El problema NO era la base de datos.** Era la **infraestructura del servidor**: una instancia EC2 `t3.micro` (1 GB RAM, 1 worker, sin swap, disco lleno). El diagnóstico con datos lo demostró: las queries de negocio corren en 2-3 ms (BD sana), pero el servidor estaba asfixiado y se reiniciaba por OOM.

---

## Metodología: MEDIR antes de optimizar

Se siguió el protocolo **MEDIR → DIAGNOSTICAR → PRIORIZAR → IMPLEMENTAR → VERIFICAR**. Nada se cambió por suposición.

### Herramientas usadas
- `pg_stat_statements` (vía túnel SSH a RDS) → queries lentas/frecuentes reales.
- `backend/scripts/diagnostico_rendimiento.py` + `diagnostico-rds.ps1` → script de diagnóstico repetible.
- Inspección del EC2: `free -h`, `df -h`, `nproc`, `systemctl cat`, `nginx -T`.

---

## Evidencia recolectada

### Base de datos (RDS) — SANA
```
Query                          avg_ms   calls
factura_asignaciones           2.65     59174   <- selectin innecesario en listado
comentarios_factura            1.19     65245   <- selectin innecesario en listado
tokens_aprobacion_facturas     0.36     65605
facturas (listado)             9.25      4388
```
Ninguna query lenta. El tiempo se iba en **VOLUMEN** de selectin innecesarios (≈40% del tiempo total de BD), no en queries lentas.

### Servidor (EC2) — EL CUELLO REAL
| Métrica | Valor encontrado | Problema |
|---------|------------------|----------|
| RAM total | 911 MB (t3.micro) | 🔴 diminuto |
| RAM disponible | 141 MB | 🔴 al borde del OOM |
| Swap | 0 B | 🔴 sin red de seguridad → OOM kill |
| Workers uvicorn | 1 | 🔴 sin paralelismo en 2 vCPU |
| `RestartSec` (systemd) | 10 s | 🔴 **explica los "10 segundos"** |
| nginx `gzip_types` | comentado | 🟠 JSON sin comprimir |
| Disco raíz | 6.8 GB al 100% | 🔴 errores de escritura |

### La hipótesis de los "10 segundos exactos"
`Restart=always` + `RestartSec=10` + 141 MB libres + 0 swap → bajo carga el kernel **mata el proceso por OOM**, systemd espera **10 s** y reinicia. Durante ese tiempo la API entera está caída → todos ven 10 s de congelado. El número no era casualidad, era la configuración.

---

## Cambios aplicados

### En código (commit `5132531`)
| Archivo | Cambio | Efecto |
|---------|--------|--------|
| `backend/main.py` | `GZipMiddleware` + middleware de timing (`X-Process-Time`, log `SLOW >1s`) | −~75% payload + medición real |
| `backend/modules/facturas/repository.py` | `noload()` de 6 relaciones no usadas en el listado (asignaciones, comentarios, tokens_aprobacion, distribucion_ccco, area_origen, assigned_user) | −~40% tiempo de BD |
| `backend/modules/files/service.py` | Upload por streaming (`file.file`) en vez de `await file.read()` | No carga el PDF entero en RAM |
| `frontend/src/lib/api.ts` | `uploadFacturaFile`: presigned→S3 directo con **fallback** a backend | Archivos no pasan por el server; nunca se rompe |
| `backend/deploy/contabilidadcq.service` | Unit systemd con `--workers 2`, `--proxy-headers`, `RestartSec=3` | Paralelismo + recuperación rápida |

### En infraestructura (EC2)
1. **Swap** (mitigación inmediata de OOM).
2. **Upgrade t3.micro → t3.medium** (1 GB → 4 GB RAM, 2 vCPU). ← arreglo de raíz.
3. **2 workers** uvicorn (tras el upgrade).
4. **`configure_s3_cors.py`** → habilita el camino presigned directo a S3.
5. **Liberar disco**: `journalctl --vacuum-size=150M` + tope `SystemMaxUse=200M`. Pendiente: ampliar EBS a 30 GB.

---

## Lecciones clave (para no repetir el error)

1. **"Lento" casi nunca significa "la BD está lenta".** Medir primero. Aquí la BD corría en 2-3 ms; el problema era el servidor.
2. **Un solo worker de uvicorn serializa todo.** Con varios usuarios o un upload, todos esperan.
3. **`RestartSec` alto + OOM = outages periódicos del valor exacto de `RestartSec`.** Si ves lentitud de "X segundos redondos", sospecha de reinicios.
4. **RAM y disco se revisan con `free -h` y `df -h` ANTES de tocar código.** Un disco al 100% causa fallos silenciosos.
5. **`lazy="selectin"` en TODAS las relaciones del modelo** hace que cada carga dispare N queries, aunque el endpoint no las use. Usar `noload()` en los listados.
6. **Subir archivos por el backend ocupa el worker y la RAM.** Presigned→S3 directo (con fallback) es superior.
7. **El header `X-Process-Time`** separa "servidor lento" de "red lenta" — instrumentar siempre.

---

## Verificación
- `pgrep -f spawn_main | wc -l` → 2 (workers activos).
- `free -h` → 3.7 Gi total, ~3 Gi disponibles.
- F12 → Network → header `X-Process-Time` + `content-encoding: gzip` en la respuesta de facturas.
- `journalctl -u contabilidadcq -f | grep SLOW` → endpoints lentos en vivo.

---

## Pendientes / Recomendaciones a futuro
- [ ] Ampliar volumen EBS de 6.8 GB → 30 GB (`growpart` + `resize2fs`).
- [ ] Considerar mover el journal a tamaño fijo permanente (hecho: `SystemMaxUse=200M`).
- [ ] Evaluar caché de catálogos (áreas, centros) con TTL si crecen las llamadas.
- [ ] Monitoreo: alarma de CloudWatch en CPU/RAM/Disco del EC2.
