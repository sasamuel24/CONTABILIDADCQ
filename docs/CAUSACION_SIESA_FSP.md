# Módulo de Causación FSP en Siesa UNOEE (vía Connekta)

**Fechas de desarrollo:** 12–13 de agosto de 2026
**Estado:** ✅ Funcional end-to-end en QA — primera factura causada desde DocuFlow el 12-ago-2026 (amarre `86568490`, FSP **13566** "En elaboración" en el ERP de pruebas)
**Pendiente de:** commit/deploy, consulta de verificación apuntada al ambiente correcto, ajustes del consultor Siesa, matriz de combinaciones de Contabilidad

---

## 1. Qué hace el módulo

Permite que el rol **Contabilidad** cause una factura legalizada de DocuFlow como
**Factura de Servicios (FSP)** en el ERP Siesa UNOEE, usando la API de importación
de **Siesa Connekta** (`conectoresimportar`, documento 249608, compañía 2211).

Flujo completo:

```
Factura legalizada (DocuFlow)
   → Botón "Causar en Siesa" (modal con prefill del mapeo por proveedor)
   → Validación previa (15 reglas + cuadre aritmético) — si falta algo NO se envía
   → POST a Connekta (5 secciones JSON) — cada intento queda registrado
   → codigo:0 = documento FSP creado "En elaboración" en UNOEE (SIN número en la respuesta)
   → "Verificar en Siesa" (ejecutarconsulta) recupera el número FSP real
   → Contabilidad aprueba el documento en UNOEE (paso manual, fuera de DocuFlow)
```

La integración fue validada manualmente el 29-jul-2026 (caso dorado); este módulo
la automatiza y añade todo lo aprendido en ~15 capas de errores del ERP más las
capas nuevas descubiertas durante estas pruebas.

---

## 2. Arquitectura (qué archivos se tocaron/crearon)

### Backend (`backend/`)

| Archivo | Qué es |
|---|---|
| `modules/siesa/builder.py` | **Builder puro** (sin BD ni red): arma el JSON de 5 secciones aplicando las reglas duras; `validar_datos()` devuelve la lista de problemas y `construir_payload_fsp()` se niega a construir con problemas |
| `modules/siesa/client.py` | **Cliente Connekta** (httpx async): `importar_fsp()` con el contrato de errores por capas y `ejecutar_consulta()` para el consecutivo; `ConnektaNetworkError` = estado desconocido; nunca loggea credenciales |
| `modules/siesa/service.py` | Orquestación: prefill del modal, candado de **idempotencia**, registro de intentos, verificación del número FSP |
| `modules/siesa/repository.py` | Acceso a datos (facturas, mapeos por proveedor, causaciones) |
| `modules/siesa/router.py` | 7 endpoints bajo `/api/v1/siesa/*` (roles `contabilidad` + `admin`) |
| `modules/siesa/schemas.py` | Schemas Pydantic (CausarIn, PrepararOut, ConfigProveedor…) |
| `modules/siesa/constants.py` | Maestros de QA cía 1 (motivos, ccostos, tipos proveedor, condiciones de pago) — seeds para selects, NO lógica |
| `core/xml_parser.py` | **Extendido**: extrae base gravable (`TaxExclusiveAmount`), IVA (`TaxTotal` esquema 01) y retenciones declaradas (`WithholdingTaxTotal`). Extracción **defensiva**: XML raro ⇒ campos en null, la factura carga igual |
| `core/config.py` | Bloque `siesa_*` de settings (ver §7) |
| `db/models.py` | Columnas nuevas en `facturas` + 3 tablas nuevas + timestamps timezone-aware en `SiesaCausacion` |
| `modules/facturas/router.py` | Ingesta XML persiste base/IVA/retenciones + backfill en duplicados |
| `alembic/versions/c2d3e4f5a6b7_add_siesa_fsp_fase1.py` | Migración (aplicada en BD local; **pendiente en EC2**) |

### Frontend (`frontend/src/`)

| Archivo | Qué es |
|---|---|
| `components/CausarSiesaModal.tsx` | Modal completo: prefill, cuadre aritmético en vivo, selects de maestros, retenciones editables, historial de causaciones con botón Verificar, checkbox "guardar como default del proveedor" |
| `components/ContabilidadFacturaDetail.tsx` | Botón "Causar en Siesa" en el footer + montaje del modal |
| `lib/api.ts` | Bloque de tipos + 6 funciones (`prepararCausacionSiesa`, `causarEnSiesa`, `verificarCausacionSiesa`, `getMaestrosSiesa`, `getCausacionesSiesa`, upsert de config) |

### Base de datos (migración `c2d3e4f5a6b7`)

- **`facturas`** (columnas nullable — jamás rompen el flujo vivo):
  - `base_gravable`, `valor_iva` — extraídos del XML DIAN
  - `retenciones_xml` (JSONB) — **SOLO INFORMATIVO** (ver §4.3)
- **`siesa_proveedor_config`** — mapeo por proveedor (NIT sin DV): sucursal, tipo proveedor, motivo, ccosto Siesa, código de servicio, condición de pago, llave/tasa de IVA
- **`siesa_proveedor_retenciones`** — N retenciones por proveedor (llave, tasa, clase base, base mínima)
- **`siesa_causaciones`** — registro de CADA intento: amarre, estado, payload enviado (JSONB), respuesta (JSONB), número FSP, ambiente, usuario. **Única fuente de verdad de "ya se causó"**

### Tests (`backend/tests/`)

- `test_siesa_builder.py` — caso dorado (igualdad EXACTA con el JSON que causó el 29-jul), formatos, multi-renglón/multi-retención, regla aritmética, límite de 8 chars, bloqueo de secciones vacías
- `test_siesa_client.py` — contrato de errores completo con `httpx.MockTransport` (códigos 0/1/3/10, query params, headers, formas de respuesta de ejecutarconsulta)
- `test_siesa_service.py` — candado de idempotencia con repo simulado
- `test_xml_parser_siesa.py` — extracción defensiva (XML corrupto/sin impuestos ⇒ carga igual)
- `conftest.py` — fixture `anyio_backend` para tests async

---

## 3. El payload FSP (5 secciones)

El JSON validado el 29-jul-2026 (caso dorado, en `test_siesa_builder.py`):

| Sección | Qué lleva | Notas |
|---|---|---|
| `Docto. compra servicios` | Cabecera: tercero (NIT sin DV), fechas AAAAMMDD, prefijo+número del docto del proveedor, tipo proveedor, condición de pago, notas | `NUMERO_DOCTO_PRO` máx **8 caracteres** |
| `Impuestos` | Una fila por renglón con IVA: llave, tasa, valor. `Numero de registro` la enlaza con su renglón del Movto (F320_ROWID) | El valor del IVA viene del XML, NO se calcula |
| `Retenciones` | N filas según la parametrización de Café Quindío: llave, tasa, clase base, base mínima. `VLR_RET` = base × tasa (half-up) | **NUNCA se copian del XML del emisor** |
| `Cuotas CxP` | Cuota propia: 100%, sin cruces, `FECHA_VCTO` = emisión + días de la condición de pago; pronto pago = vencimiento (nunca vacío) | |
| `Movto. compra servicios` | Renglones: código de servicio, motivo, ccosto, valor bruto, notas (obligatorias), tercero del workaround | `_ID_CO_MOVTO` hoy fijo `"001"` (ver §9) |

`CONSEC_DOCTO` es un **amarre interno** (epoch corto), idéntico en las 5 secciones;
el ERP lo recalcula y asigna el número real.

---

## 4. Reglas duras (cada una costó un error real contra el ERP)

### 4.1 Del diseño original (validadas 29-jul-2026)

1. Fechas SIEMPRE en `AAAAMMDD`.
2. `""` no es vacío válido para fechas (pronto pago siempre con fecha real).
3. NIT **sin** dígito de verificación (el builder normaliza).
4. Enviar TODAS las llaves de todas las secciones; las no usadas en `""`.
5. `CONSEC_DOCTO` = amarre interno; consecutivo automático en el ERP.
6. El éxito NO devuelve el consecutivo → consulta posterior.
7. Cuota propia sin cruces.
8. Formatos: `ID_MOTIVO` ≤2 · llaves 4 alfanuméricas · `D_CLASE_IMP_BASE` numérico ≤3 · tasas `000.0000`.
9. Multi-registro N×N desde el día uno.
10. **BUG ABIERTO del conector**: el tercero del Movto rechaza tanto el proveedor real como el vacío. Workaround: tercero alterno (`7555488`/`001`) **configurable** (`SIESA_WORKAROUND_TERCERO_MOVTO`); dejar en `""` cuando el consultor lo corrija. Verificado: NO contamina el tercero del documento (queda a nombre del proveedor real).

### 4.2 Descubiertas en estas pruebas (12-ago-2026)

11. **Validación aritmética (regla de DocuFlow)**: base + IVA (− retenciones) debe cuadrar con el total de la factura (tolerancia $1). Si no cuadra **NO se causa**. Crítica porque **el ERP no valida la tasa contra la llave** (aceptó IVA $1 con tasa 231% y llave de 19%): el cuadre de DocuFlow es la única defensa.
12. `NUMERO_DOCTO_PRO` máximo **8 caracteres** — el modal muestra contador y botón "usar últimos 8" (nunca trunca en silencio).
13. **NOTAS del movimiento obligatorias** para el ERP (registro 320, pos 233-488). Default: `DocuFlow {número factura} {proveedor}` — además da trazabilidad en el ERP.
14. **LIMITACIÓN TEMPORAL**: el documento 249608 exige `Impuestos` y `Retenciones` **con datos**. Ni `[]` (rechazo del conector) ni fila en blanco (rechazo del plano, registros 321/314) pasan. `validar_datos` **bloquea** facturas sin IVA o sin retenciones con mensaje claro. Retirar cuando el consultor configure las secciones como omitibles (la fila neutra ya queda lista en el builder).
15. **Equivalencias contables**: la tripleta *servicio × motivo × centro de costo* debe estar parametrizada en UNOEE:
    - `CS4515 + motivo 17 (Diferidos)` → "No existe equivalencia válida"
    - `CS4515 + motivo 51 + ccosto 1001` → "El auxiliar y C.Costo no manejan el mismo grupo de C.Costo"
    - El motivo define el **grupo** de centros de costo válidos (51-Admin → 0502; 52-Ventas → 1001/0801…).

### 4.3 Regla tributaria (de negocio, no técnica)

Las **retenciones del XML del emisor son solo informativas**. En Colombia el agente
retenedor (Café Quindío) determina qué retiene según SU parametrización. La fuente
para causar es `siesa_proveedor_config`/`siesa_proveedor_retenciones` (o lo que el
usuario confirme en el modal); el XML se muestra como referencia en un recuadro azul.
Codificar "retener lo que diga el XML" sería un **error tributario**, no técnico.

---

## 5. Contrato de la API Connekta (observado, no documentación oficial)

### Importación

- `POST {base}/api/siesa/v3.1/conectoresimportar`
- Query params SIEMPRE (URL limpia): `idCompania=2211`, `idSistema=2`, `idDocumento=249608`, `nombreDocumento=FACTURA DE SERVICIOS DIRECTA`. Duplicarlos produce `The value 'x,y' is not valid`.
- Headers: `connikey` + `connitoken` (desde `.env`, jamás en código ni logs).
- **Éxito**: `[{"codigo":0,"mensaje":"Transacción Exitosa","detalle":"Importacion exitosa"}]` — sin consecutivo.
- **Errores** (HTTP 400, reportados POR CAPAS — corregir una destapa la siguiente):
  - `codigo:1` + "Error en la Estructura" → validación del conector; `detalle` = lista por campo (`f_nivel`/`f_valor`/`f_detalle`)
  - `codigo:1` + "Error al importar el plano" → validación del ERP; `detalle` trae `f_tipo_reg` (311/320/321/314/353) y posiciones
  - `codigo:10` → configuración del ecosistema Connekta (no es error del request)
  - `codigo:3` → credenciales del ERP en el ecosistema
- El cliente traduce todo a texto legible (sección + campo + causa) que llega al modal vía `detail`.

### Consulta del consecutivo (`ejecutarconsulta`)

- `GET {base}/api/connekta/v3.0.1/ejecutarconsulta`
- Query params: `idCompania=2211`, `descripcion=cafequindio_FSP_CONSECUTIVO_DOCUFLOW`, `paginacion=numPag=1|tamPag=100`, `parametros=Nit=X|Fecha=AAAAMMDD`
- Respuesta: `{"codigo":0,"detalle":{"total_registros":N,"Datos":[...]}}` — el cliente es tolerante a las variantes.
- DocuFlow busca en la primera fila una columna cuyo nombre contenga `consec` o `numero`.

---

## 6. La saga de la consulta del consecutivo (13-ago-2026)

Documentada porque enseña la estructura real de UNOEE:

1. Se creó la consulta `cafequindio_FSP_CONSECUTIVO_DOCUFLOW` en la plataforma Connekta (parámetros `Nit`, `Fecha`).
2. Primer SQL sobre `t350_co_docto_contable` (documento contable) → los FSP de un tercero aparecían, pero **no** el recién importado.
3. Descubrimiento clave #1: **el documento importado queda "En elaboración"** y su fila en `t350` no es visible por el join del tercero (`f350_rowid_tercero` no poblado en elaboración). Se ve en el ERP: pantalla "Factura de servicio compra", número 13566.
4. Exploración de tablas (vía `INFORMATION_SCHEMA` desde la propia consulta):
   - `t451_cm_docto_compras` / `t455_cm_factura_docto` = compras con ítems de inventario (NO servicios; sin columna de consecutivo propia)
   - `t430_cm_pv_docto` = documentos de ventas (0 FSPs)
   - **`t311_co_docto_factura_serv`** = cabecera de la factura de servicios (registro 311 del plano); su consecutivo/tipo viven en `t350` vía `f311_rowid_docto` → `f350_rowid`
   - `t320_co_movto_serv` = movtos de servicios (el F320_ROWID del enlace de impuestos)
   - Tipos históricos: el proveedor probado tenía facturas tipo `FPS` (otro tipo de documento) — el importador crea tipo `FSP`
5. Descubrimiento clave #2: la consulta estaba ejecutándose contra **otra base de datos** (la conexión elegida en Connekta apuntaba al ambiente productivo — con actividad en vivo — y no al ERP de pruebas donde quedó el FSP 13566). Evidencia: la consulta veía documentos creados "hoy" que no existen en pruebas, y no veía el 13566 que sí existe en pruebas.
6. **SQL definitivo** (guardado en la consulta, apto para producción):

```sql
DECLARE @Nit VARCHAR(20) = '{Nit}';
DECLARE @Fecha DATE = '{Fecha}';

SELECT TOP 1
    c.f350_consec_docto       AS consec_docto,
    c.f350_id_tipo_docto      AS tipo_docto,
    c.f350_fecha              AS fecha,
    c.f350_ind_estado         AS ind_estado,
    f.f311_prefijo_docto_prov AS prefijo_prov,
    f.f311_numero_docto_prov  AS numero_prov,
    f.f311_vlr_neto           AS vlr_neto,
    t.f200_nit                AS nit,
    t.f200_razon_social       AS razon_social
FROM t311_co_docto_factura_serv f
JOIN t350_co_docto_contable c ON c.f350_rowid = f.f311_rowid_docto
JOIN t200_mm_terceros t ON t.f200_rowid = f.f311_rowid_tercero
WHERE f.f311_id_cia = 1
  AND c.f350_id_tipo_docto = 'FSP'
  AND t.f200_nit = @Nit
  AND CONVERT(date, c.f350_fecha) = @Fecha
ORDER BY c.f350_consec_docto DESC
```

> Nota: el join del tercero va por **`t311`** (no por `f350_rowid_tercero`) para que
> también encuentre documentos "En elaboración". La cía interna de UNOEE es `1`
> (el `idCompania=2211` es el identificador Connekta, no el `f_cia` de las tablas).

**Pendiente**: validar la consulta contra el ambiente correcto (conexión de la
consulta = misma base que el importador del ecosistema) y replicarla en el
ecosistema productivo con este mismo nombre y SQL.

---

## 7. Configuración (`.env` del backend)

```bash
# Integración Siesa Connekta — causación FSP
SIESA_HABILITADO=true                      # false = modal en solo-lectura, sin envíos
SIESA_CONNI_KEY=...                        # credenciales del ecosistema (ROTAR antes de prod)
SIESA_CONNI_TOKEN=...
SIESA_CONSULTA_FSP=cafequindio_FSP_CONSECUTIVO_DOCUFLOW
SIESA_WORKAROUND_TERCERO_MOVTO=7555488     # bug del conector — "" cuando lo corrijan
SIESA_WORKAROUND_SUCURSAL_MOVTO=001
# Defaults en core/config.py (cambiar para producción):
# SIESA_BASE_URL=https://serviciosqa.siesacloud.com   → prod: servicios.siesacloud.com (confirmar)
# SIESA_ID_COMPANIA=2211 · SIESA_ID_SISTEMA=2 · SIESA_ID_DOCUMENTO=249608
# SIESA_NOMBRE_DOCUMENTO=FACTURA DE SERVICIOS DIRECTA
```

---

## 8. Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/v1/siesa/maestros` | Motivos/ccostos/tipos proveedor/cond. pago para los selects |
| GET | `/api/v1/siesa/proveedores/{nit}` | Mapeo guardado del proveedor (404 si no hay) |
| PUT | `/api/v1/siesa/proveedores/{nit}` | Crear/actualizar mapeo (retenciones se reemplazan completas) |
| GET | `/api/v1/siesa/facturas/{id}/preparar` | Prefill del modal + problemas + cuadre + historial |
| POST | `/api/v1/siesa/facturas/{id}/causar` | Causar (body = datos de decisión + `guardar_como_default`) |
| GET | `/api/v1/siesa/facturas/{id}/causaciones` | Historial de intentos |
| POST | `/api/v1/siesa/causaciones/{id}/verificar` | Recuperar número FSP / resolver envíos dudosos |

Códigos de error de `/causar`: **400** datos incompletos o descuadre (no se envió) ·
**409** ya causada o envío dudoso pendiente de verificar · **422** el ERP rechazó
(detalle legible por capas) · **502** fallo de red con estado desconocido ·
**503** integración deshabilitada o sin credenciales.

### Idempotencia (defensa contra doble causación)

- Estados: `borrador → enviando → enviado → exitoso → verificado | error`
- El registro se crea **antes** del POST (si el proceso muere, queda rastro).
- `exitoso`/`verificado` → 409, no se reenvía jamás.
- `enviando`/`enviado` (fallo de red = estado desconocido) → 409 hasta pasar por **Verificar**: si la consulta encuentra el documento → `verificado` (NO reenviar); si no → `error` (reintento seguro).
- `error` confirmado del ERP → se puede reintentar.

---

## 9. Cronología de la depuración (12-ago-2026, capa por capa)

Ocho intentos registrados en `siesa_causaciones` antes del éxito — cada error
destapó una regla nueva:

| # | Error del ERP | Regla aprendida |
|---|---|---|
| 1 | "campo obligatorio no fue enviado" en Retenciones + "supera el tamaño (8)" | `[]` es rechazado (regla 14) + límite 8 chars (regla 12) |
| 2 | "se esperaba un dato numérico/decimal" en la fila en blanco | Los campos tipados no aceptan `""` ni en filas neutras |
| 3 | Registros 321/314/320: "el dato es obligatorio" | NOTAS obligatorias (regla 13) + secciones exigen datos reales (regla 14) |
| 4 | ídem 321/314 tras el fix de notas | La fila neutra no sobrevive al plano → bloqueo preventivo en `validar_datos` |
| 5 | "El servicio no existe, no es de compras o no está activo" (`3131`) | Solo códigos reales del maestro (validado: `CS4515-1`) |
| 6 | "No existe equivalencia válida… Motivo: 17" | Equivalencias contables servicio×motivo (regla 15) |
| 7 | "El auxiliar y C.Costo no manejan el mismo grupo" (`51`+`1001`) | El motivo define el grupo de ccostos válidos (regla 15) |
| 8 | ✅ `codigo:0` con `CS4515-1 + motivo 52 + ccosto 1001` | Primera causación DocuFlow → FSP 13566 |

Combinaciones validadas (semilla de la matriz de Contabilidad):

| Caso | Servicio | Motivo | C.Costo | C.O. | Resultado |
|---|---|---|---|---|---|
| Caso dorado QA | CS4515-1 | 51 Admin | 0502 Financiera | 001 | ✓ |
| 1ª causación DocuFlow | CS4515-1 | 52 Ventas | 1001 Comercial | 001 | ✓ FSP 13566 |
| Real producción (FSP 14864) | CS3530 Energía | 52 Ventas | 0801 Tiendas | **061** CQ Express | ✓ Aprobado |

> ⚠️ El ejemplo real usa **C.O. 061 por movimiento** — el builder hoy manda
> `_ID_CO_MOVTO="001"` fijo. Ajuste pendiente: tomarlo del centro de operación
> de la factura (DocuFlow ya lo tiene en `centro_operacion_id`).

---

## 10. Otras correcciones hechas en el camino

- **Inbox caído con 500** (`UndefinedColumnError: facturas.base_gravable`): el backend local corría con los modelos nuevos y la BD sin migrar → `alembic upgrade head` aplicó `c2d3e4f5a6b7`. **En EC2 pasará lo mismo**: el deploy DEBE incluir la migración antes del restart.
- **Horas corridas +5h en el historial**: el `TimestampMixin` global usa `datetime.utcnow()` naive; en un equipo en hora Colombia asyncpg lo interpreta como local (doble desfase). Fix puntual en `SiesaCausacion` (timestamps timezone-aware) + corrección de las filas existentes. *El mixin global tiene el mismo problema en todos los modelos cuando el backend corre fuera de UTC — tarea aparte si se quiere corregir.*
- **Consola Windows cp1252**: los scripts de diagnóstico no deben imprimir caracteres Unicode especiales dentro de una transacción (un `UnicodeEncodeError` hizo rollback de un UPDATE la primera vez).

---

## 11. Cómo probar (QA)

1. Backend local con `.env` configurado (§7) y migración aplicada. Reiniciar tras cambiar `.env`.
2. Entrar como rol `contabilidad`, abrir una factura y pulsar **"Causar en Siesa"**.
3. Requisitos de la factura: NIT, fecha de emisión, base+IVA que cuadren con el total, **IVA > 0** y **al menos una retención** (limitación temporal, regla 14), número del documento ≤ 8 chars, tripleta servicio×motivo×ccosto válida.
4. Éxito → historial muestra "Exitoso"; el documento aparece "En elaboración" en UNOEE pruebas (Compra serv. → Consulta de facturas).
5. "Verificar en Siesa" recupera el número cuando la consulta apunte a la base correcta.
6. Tests: `python -m pytest tests -q` (los `test_siesa_*` y `test_xml_parser_siesa`; `test_health_check_structure` falla desde antes de este módulo).

---

## 12. Checklist para producción

**De código/config (DocuFlow):**
- [ ] Commit + push de todo el módulo (backend, frontend, migración)
- [ ] Deploy EC2: `git pull` + **`alembic upgrade head`** + restart `contabilidadcq.service`
- [ ] `.env` de producción: `SIESA_BASE_URL=https://servicios.siesacloud.com` (confirmar URL), credenciales del ecosistema productivo **rotadas**, `SIESA_HABILITADO` (encender al validar)
- [ ] Ajuste del C.O. del movimiento (hoy fijo `001`; el real de tiendas es por factura)

**De terceros (bloqueantes externos):**
- [ ] **Consultor Siesa**: fix del tercero del Movto (regla 10) → vaciar los `SIESA_WORKAROUND_*`
- [ ] **Consultor Siesa**: permitir omitir `Impuestos`/`Retenciones` sin datos en el doc 249608 (regla 14) → retirar el bloqueo de `validar_datos`
- [ ] **Connekta**: conexión de la consulta = misma base que el importador; replicar la consulta en el ecosistema productivo (mismo nombre y SQL de §6)
- [ ] **Contabilidad**: matriz de combinaciones válidas servicio × motivo × ccosto (× C.O./U.N.), lista de servicios de compras activos, llaves tributarias definitivas (las de QA: IVA `0010` 19%, ReteFuente `1040` 2.5%)
- [ ] Rotar `connikey`/`connitoken` (los de QA circularon por chats)

---

## 13. Referencias

- **Excel de mapeo**: `informes/Mapa_DocuFlow_vs_Siesa_FSP.xlsx` (campo por campo DocuFlow ↔ JSON ↔ pantalla Siesa, reglas, combinaciones, flujo)
- **Caso dorado**: JSON completo en `backend/tests/test_siesa_builder.py` (`PAYLOAD_DORADO`)
- **Payloads reales de cada intento**: tabla `siesa_causaciones` (columnas `payload_enviado`/`respuesta`)
- Documento validado en el ERP de pruebas: FSP **13566**, 20/06/2026, SODIMAC, $2.302.012 (bruto), notas "DocuFlow 66141204576…"
