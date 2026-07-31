# Autenticación con Backend

## Configuración

1. Copiar el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env.local
```

2. Configurar la URL del backend en `.env.local`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Características Implementadas

### Login Real
- Conectado al endpoint `POST /api/v1/auth/login`
- Validación de credenciales con email + password
- Almacenamiento seguro de tokens en localStorage
- Manejo de errores con mensajes informativos
- Loading state durante autenticación

### Gestión de Sesión
- Verificación automática de sesión al iniciar la app
- Token incluido automáticamente en todas las peticiones
- Logout limpia tokens y resetea estado
- Redirección automática si el token expira (401)

### Manejo de Errores
- Mensajes de error claros en UI
- Validación de sesión al inicio
- Fallback a nombre desde email si `/auth/me` no existe

## Flujo de Autenticación

1. Usuario ingresa email y password
2. Frontend llama `POST /api/v1/auth/login`
3. Backend retorna `access_token` y `refresh_token`
4. Tokens se guardan en localStorage
5. Frontend intenta llamar `GET /api/v1/auth/me` para obtener datos del usuario
6. Si existe, usa `user.nombre`, si no, extrae nombre del email
7. Usuario autenticado accede al Dashboard

## Archivos Modificados/Creados

- `src/lib/api.ts` - Cliente API con funciones de autenticación
- `src/App.tsx` - Gestión de estado de sesión y verificación inicial
- `src/components/LoginPage.tsx` - Formulario con manejo de errores y loading
- `.env.local` - Variables de entorno (no commiteado)
- `.env.example` - Plantilla de variables de entorno

## API Client

El archivo `src/lib/api.ts` exporta:

- `login(email, password)` - Autenticar usuario
- `getCurrentUser()` - Obtener datos del usuario actual
- `logout()` - Cerrar sesión
- `hasValidSession()` - Verificar si hay token válido
- `getAccessToken()` - Obtener token de localStorage
- `clearTokens()` - Limpiar tokens

## Próximos Pasos

Para usar el token en otros componentes, importar las funciones del cliente API:

```typescript
import { getCurrentUser } from '../lib/api';

// Ejemplo: obtener datos del usuario
const user = await getCurrentUser();
console.log(user.nombre);
```

Todas las peticiones al backend automáticamente incluyen el header:
```
Authorization: Bearer <access_token>
```

---

# Flujo Tarjeta Comercial — Ventanas del Frontend

> Actualizado 6-Jul-2026. Detalle backend en `backend/agents.md` (sección "Módulo: Flujo Tarjeta Comercial").

## Ventanas y componentes

| Ventana | Archivo | Notas |
|---|---|---|
| Página del Comercial | `src/pages/ComercialPage.tsx` | Todo en un archivo: lista, historial, nuevo paquete, detalle con pipeline visual. SIN campo Cuenta Contable. Campo "Observaciones (opcional)" por gasto. Si el padre tiene hijos (`GET /gastos/comercial/mis-hijos`), muestra select "Legalizar a nombre de" al crear paquete |
| Validación Comercial | `src/pages/ResponsablePage.tsx` (sección `comercial`) + `src/components/ResponsablePaquetesView.tsx` con `modo="comercial"` | Filtros: "Por validar" (en_validacion), "Esperando gerentes" (en_revision, solo modo comercial). Columna "Sel." con checkboxes para armar N solicitudes por aprobador; panel de grupos; lista de estado "Solicitudes de aprobación (X/N aprobadas)" con el visto bueno del gerente comercial visible como Pendiente |
| Aprobación del gerente | `src/pages/AprobarPaquetePage.tsx` (ruta pública `/aprobar-paquete?token=&accion=`) | `accion=aprobar` (o **sin `accion`**, por los correos viejos de 72 h) aprueba al cargar; `accion=rechazar` pide el motivo (≥5 caracteres) y solo entonces llama a `rechazarPaquetePorToken`. Si el token es de una solicitud parcial y quedan pendientes, muestra "¡Aprobación registrada!" con el conteo de solicitudes que faltan. **Estilos 100% en línea** (ver gotcha de CSS abajo): la abren aprobadores externos desde el correo. Gemela de `AprobarFacturaPage.tsx` — cambiar una implica revisar la otra |
| Admin de gerentes | `src/components/AprobadoresGerenciaAdmin.tsx` | Aprobadores con categoría general/comercial |

## Convenciones importantes

- Los badges de los filtros en `ResponsablePaquetesView` se calculan sobre `paquetesEnviados` (lista ya filtrada por modo), NUNCA sobre `paquetes` completo — si no, aparecen contadores fantasma de otros flujos.
- El estado `aprobado` se etiqueta "Pendiente" en la vista de Radicación (= pendiente de envío a Tesorería); no confundir con pendiente de aprobación de gerente (`en_revision`).
- Las observaciones del gasto se muestran como nota ámbar bajo el Concepto en la tabla del validador (la tabla ya es muy ancha para otra columna).
- Cliente API: `src/lib/api.ts` — `getMisHijosComerciales`, `createPaqueteGasto(semana, hijoId?)`, `validarPaquete`, `validarPaqueteMultiple`, `getAprobadoresActivos(categoria?)`.

---

# Perfil Dirección (Director Contable) — Centro Documental + Trazabilidad

> Actualizado 9-Jul-2026. Detalle backend en `backend/agents.md` → "Rol `direccion` — Trazabilidad de Legalizaciones".

## Ventanas y componentes

| Ventana | Archivo | Notas |
|---|---|---|
| Página del director (rol `direccion`, ruta `/centro-documental`) | `src/pages/CentroDocumentalPage.tsx` | Toggle dinámico `vista: 'documental' \| 'trazabilidad'` con pills segmented (activa = gradiente de marca). Vista documental: KPIs (facturas, valor total, en revisión, sin archivar — reaccionan a los filtros), filtros con chips, tabla de facturas |
| Trazabilidad de legalizaciones | `src/components/DirectorTrazabilidadView.tsx` | **Autocontenido y SOLO LECTURA** (cero botones de acción). Lista todos los `tipo_flujo` con KPIs por los 7 estados, filtros (texto/flujo/estado/rango fechas) y tabla paginada. Incluye `DetallePaqueteDirector`: pipeline visual + **línea de tiempo de auditoría** (`historial_estados`: quién, cuándo, estado_anterior → estado_nuevo) + observaciones + gastos |
| Panel de carpetas | `src/components/CarpetasPanel.tsx` | Armonizado con el diseño (rounded-2xl, header con título en micro-mayúsculas) |

## Convenciones y gotchas de este perfil

- **`ESTADOS_CONFIG` propio con los 7 estados**, incluido `en_validacion` — el de `TesoreriaPaquetesView` lo omite. No reutilizar el de Tesorería.
- La carga de trazabilidad pagina en bucle `listPaquetesGastos({ skip, limit: 200 })` hasta `total` (límite del backend: 200/página).
- `PipelineEstadoDirector` es una copia adaptada del `PipelineEstado` de `LegalizacionPage` (que NO está exportado) trabajando con estados snake_case (`en_validacion`=paso 1, `devuelto`=paso 2 en rojo).
- No se reutilizó `TesoreriaPaquetesView` con prop `readOnly` a propósito: esa vista tiene pago masivo y modales de pago; enhebrar readOnly arriesga regresiones en pagos.
- **Diseño del Centro Documental** (aplican los gotchas del snapshot CSS): contenedor a `maxWidth: 1600` inline (no `max-w-7xl`), tabla con `minWidth: 1000` dentro de `overflow-x-auto`, grilla de filtros definida inline (`gridTemplateColumns`, NO `lg:grid-cols-*`), inputs `type="date"` con `minWidth: 0, flex: 1` (su ancho intrínseco desbordaba la tarjeta de filtros), foco de marca vía handlers `focusBrand` (no `focus:ring-*`), y márgenes problemáticos en inline (`ml-2` no existe en el snapshot).
- Tipografía con constantes `F_BOLD` / `F_DEMI` / `F_BOOK` (Neutra Text) definidas al inicio de `CentroDocumentalPage.tsx`.
- **Deploy:** la pestaña Trazabilidad requiere que el backend en EC2 ya tenga el rol `direccion` habilitado (pull + restart) — si Amplify publica antes, da 403 al cargar.

---

# Dominio y Despliegue del Frontend

> Actualizado 6-Jul-2026.

- **URL de producción:** `https://docuflowcafequindio.com` (AWS Amplify con dominio propio; el dominio anterior `https://main.d174bkkc7dp7ba.amplifyapp.com` sigue activo como respaldo).
- **Despliegue:** automático — cada `git push` a `main` dispara el build de Amplify. El backend NO se despliega con el push (requiere pull + restart en EC2, ver `backend/agents.md`).
- **`VITE_API_BASE_URL`:** apunta al API Gateway (`https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1`). Se configura en las variables de entorno de Amplify (con fallback en `.env.production` y en `src/lib/api.ts`). **No cambia cuando cambia el dominio del frontend.**
- **Al cambiar de dominio:** lo que rompe no es el frontend sino el CORS del backend (lista quemada en `backend/main.py`) y los enlaces de correos (`FRONTEND_URL` del `.env` en EC2). Checklist completo en `backend/agents.md` → "Dominios, CORS y URLs de Producción".

---

# ⚠️ CSS: NO hay Tailwind real — `index.css` es un snapshot parcial

> Actualizado 9-Jul-2026. Este es el gotcha #1 de cualquier bug visual del frontend.

## El problema

- El proyecto **NO tiene Tailwind instalado**: no hay paquete `tailwindcss`, ni PostCSS, ni plugin en `vite.config.ts`.
- `src/index.css` es un **snapshot congelado** de utilidades Tailwind v4.1.3 (export de una herramienta de diseño). Solo existen las clases que quedaron literalmente escritas en ese archivo.
- `src/styles/globals.css` existe pero **no se importa en ningún lado** (solo `main.tsx` → `index.css`). No sirve editarlo.
- **Consecuencia:** cualquier clase Tailwind usada en un componente que no esté definida en `index.css` NO HACE NADA, silenciosamente. Auditoría del 9-Jul-2026: ~688 tokens de className usados en `src/**/*.tsx` no existían en el CSS (`text-xs` con 642 usos, `font-semibold` 431, `rounded-xl` 178, `truncate`, `border-2`, `hidden`, `animate-spin`, etc.). La app "se veía bien" en gran parte por estilos inline y por las reglas base de `h1`–`h4`.

## Síntomas típicos que causó (ya corregidos el 9-Jul-2026)

- Layouts `flex h-screen` (TesoreriaPage, ContabilidadPage, GerenciaPage, ResponsablePage, Dashboard) **colapsaban a la altura del contenido**: sidebar a media pantalla, usuario flotando, fondo blanco debajo. Fix: se definió a mano `.h-screen` + `html, body, #root { height: 100% }`.
- Input de subir PDF visible en el panel de carpetas de Tesorería (`hidden` no existía).
- Barra móvil de ResponsablePage visible en escritorio (`md:hidden` no existía).
- Spinners que no giraban (`animate-spin`), chevrons que no rotaban (`rotate-180`), textos que no se truncaban (`truncate`), panel de carpetas sin ancho (`w-80`), modales a pantalla completa (`max-w-2xl`).
- **Botón "Confirmar rechazo" invisible** en `AprobarFacturaPage` (fondo `bg-red-600` inexistente + texto blanco → botón blanco sobre blanco; fix `c8170c0`, 28-Jul-2026). Por eso las páginas públicas de aprobación/rechazo (`AprobarFacturaPage`, `AprobarPaquetePage`, `AprobarAnticipoPagina`) usan **estilos en línea, no clases**: las abre gente externa desde su correo y no pueden depender del snapshot.

## Regla al escribir/editar componentes

1. **Antes de asumir que una clase Tailwind funciona, verificar que exista**: `grep "\.nombre-clase" src/index.css` (ojo con el escape de `:` y `.` → `.sm\:flex`, `.w-3\.5`).
2. Si falta y se necesita: **añadir su definición estándar de Tailwind a mano** en el bloque "Utilidades estructurales" de `index.css` (después del fix de `h-screen`), o usar `style` inline.
3. Las variantes responsive van **en pareja**: nunca añadir `.hidden` sin sus `sm:`/`md:` correspondientes (y viceversa) o se oculta contenido de escritorio.
4. Los keyframes propios se llaman `cq-spin` y `cq-pulse` (no `spin`/`pulse`) para no chocar con nada.
5. **NO activar en bloque las clases cosméticas que siguen faltando** (`text-xs`, `font-semibold`, `rounded-xl`, paddings): cambiarían la apariencia de toda la app en todos los roles de golpe. Si algún día se instala Tailwind real, hacerlo con revisión visual completa de cada rol.

## Cómo auditar (script rápido)

Extraer los tokens de `className` de `src/**/*.tsx` y compararlos contra los selectores `.clase` de `src/index.css` (des-escapando `\:` `\.` `\/`). Los que no aparezcan, no aplican.

---

# Valor sin IVA en el detalle del paquete (Radicación) + análisis IA

> Añadido 9-Jul-2026. Detalle backend en `backend/agents.md` → "Valor sin Impuestos por Gasto + Análisis IA de Soportes".

Todo vive en `src/components/ResponsablePaquetesView.tsx` (detalle del paquete que Radicación abre desde `/facturacion`):

- **Botón morado "Calcular sin IVA (IA)"** junto a "Exportar plano" — visible con `puedeGestionarVSI` (= `esFact` y paquete en `aprobado | en_tesoreria | pagado`). Llama `analizarImpuestosPaquete(paqueteId)` (`api.ts`), recarga el paquete y muestra toast con el resumen; si hay gastos para revisión, el toast incluye el `detalle` del primer fallo (ahí aparece p. ej. el error de créditos de Anthropic).
- **Columna "Valor sin IVA"** entre "Valor" y "Soporte": input editable para `puedeGestionarVSI` (Enter o blur guardan vía `actualizarValorSinImpuestos`), texto formateado para el resto. Badge `VsiBadge` de origen: `IA` (teal), `M` (manual, gris), `=T` (sin desglose, verde). El pie de tabla suma la columna con fallback `valor_sin_impuestos ?? valor_pagado`.
- **Formato es-CO**: el input es `type="text"` con `inputMode="numeric"` y muestra `fmtNumero()` (miles con punto: `17.950`); al guardar se parsea con `parseNumeroCO()` (quita puntos de miles, coma = decimal). No usar `type="number"` — no admite separador de miles.
- La IA es incremental: el botón solo procesa gastos sin valor y nunca pisa los `manual`; se puede dar clic las veces que sea.

## ⚠️ Gotcha: los Decimal del backend llegan como STRING

Pydantic v2 serializa `Decimal` como string JSON (`valor_pagado: "15945.00"`). Sumarlos con `+` en un `reduce` **concatena strings y da NaN**. En `ResponsablePaquetesView` existe `toNum()` y todos los agregados lo usan — al agregar cualquier cálculo con montos de gastos/paquetes, pasar SIEMPRE por `toNum()` (o `Number()`), nunca sumar el campo crudo.

---

# Validación de Centros al crear/enviar paquetes (Comercial, Tarjeta CQ, Legalización)

> Añadido 9-Jul-2026 (commit `5f22481`).

`ComercialPage.tsx`, `TarjetaCQPage.tsx` y `LegalizacionPage.tsx` bloquean con `toast.error` la creación (`NuevoPaquete*Form`) y el envío (`handleEnviar` del detalle) si algún gasto con datos no tiene **Centro de Costo Y Centro de Operación**. La validación filtra primero `filasConDatos` (alguna celda diligenciada) para no exigir centros en filas vacías de la grilla. Es validación de UX — el backend no la exige; si se agrega un flujo nuevo de captura de gastos, replicarla.

---

# Errores "validation error for ..." al asignar/editar carpetas

> Añadido 9-Jul-2026, tras el bug en "Asignar a Carpeta" con facturas en estado Pagada.

- La asignación de una factura a carpeta se hace con **PUT `/carpetas/{id}`** (`updateCarpeta` en `src/lib/api.ts`, usado por `AsignarCarpetaModal.tsx`, `CarpetasPanel.tsx` y `CarpetasPanelTesoreria.tsx`).
- Si el modal muestra un error tipo `"Error al actualizar carpeta: 1 validation error for CarpetaResponse ... input_type=Estado"`, es un **bug de serialización del backend** (schema Pydantic esperando string donde el ORM entrega un objeto de relación), NO un error del usuario ni del frontend. Detalle y regla en `backend/agents.md` → "Schemas Pydantic sobre ORM".
- **Importante:** en esos casos la operación casi siempre **SÍ se guardó** (el commit en BD ocurre antes de serializar la respuesta). Antes de reintentar la asignación, refrescar el árbol de carpetas y verificar — reintentar a ciegas puede archivar la factura dos veces o en carpeta equivocada.
- Caso concreto (corregido 9-Jul-2026): asignar una factura a una carpeta cuyos hijos contenían facturas hacía reventar la respuesta porque `FacturaEnCarpeta.estado` recibía el objeto `Estado` del ORM. Fix: `field_validator(mode='before')` en `backend/modules/carpetas/schemas.py`.

---

# ⚠️ Redirección por rol — mapas rol→ruta DUPLICADOS

> Añadido 10-Jul-2026 (commit `d440ea5`), tras el incidente del rol `comercial` en producción. Roles reales de la BD en `backend/agents.md` → "Roles del sistema".

## El incidente

Los 19 usuarios con rol `comercial` (p. ej. Vanessa Galindo) quedaban **atrapados en "Acceso No Autorizado"** al iniciar sesión en producción. El login era exitoso; el problema era de redirección: `LoginPage.tsx` tenía su **propio** mapa rol→ruta desactualizado (sin `comercial`, `user`, `tarjeta_cq` ni `responsable_tiendas`) y cualquier rol desconocido caía en `/no-autorizado`. Como `NoAutorizadoPage` tampoco conocía `comercial`, su auto-redirección de rescate no disparaba y el usuario quedaba atascado (los roles `user`/`tarjeta_cq` sí rebotaban — por eso nadie lo notó antes).

## Estado actual (post-fix)

El mapa rol→ruta sigue existiendo en **3 lugares** que deben mantenerse sincronizados:

| Archivo | Función | Rol desconocido cae en |
|---|---|---|
| `src/App.tsx` | `roleRedirect()` — **fuente de verdad**; la usan las rutas `/` y `*` | `/no-autorizado` |
| `src/components/ProtectedRoute.tsx` | `getRoleHome()` — rebote cuando el rol no está en `allowedRoles` de la ruta | `/login` |
| `src/pages/NoAutorizadoPage.tsx` | `getRoleHome()` — auto-redirección de rescate; **si falta el rol aquí, el usuario queda ATASCADO** | se queda en la página |

`LoginPage.tsx` **ya NO tiene mapa propio**: tras autenticar navega a `/` y `roleRedirect()` de App.tsx decide. No volver a poner lógica de redirección por rol en el login.

## Checklist al crear un rol nuevo

1. `App.tsx`: agregar la `<Route>` con su `<ProtectedRoute allowedRoles={['nuevo_rol']}>` **y** la línea en `roleRedirect()`.
2. `ProtectedRoute.tsx`: agregar la línea en `getRoleHome()`.
3. `NoAutorizadoPage.tsx`: agregar la línea en `getRoleHome()` — es el que se olvida y el que deja gente atascada.
4. Verificación rápida: `grep -rn "getRoleHome\|roleRedirect" src/` y confirmar que el rol aparece en los 3 mapas.

## Gotchas

- Las comparaciones usan `.toLowerCase()` — necesario porque en la tabla `roles` de la BD hay códigos con mayúsculas (`Gerencia`, `Tecnico` conviven con `tecnico`). Nunca comparar `user.role` crudo.
- `user.role` puede llegar como string o como objeto `{code}` según el endpoint: usar `getUserRoleCode(user)` (`src/lib/api.ts`) en vez de `user.role` directo.
- Diagnóstico de "un usuario ve Acceso No Autorizado con login válido": (1) consultar su rol real en Aurora (query en `backend/agents.md` → "Roles del sistema"), (2) verificar que ese código exista en los 3 mapas. Casi nunca es un problema de credenciales ni de backend.
- "Área: Sin área" en la pantalla de No Autorizado NO es el problema: `users.area_id` es nullable y roles como `comercial` o `tarjeta_cq` no dependen del área para entrar a su página.

---

# "Error HTTP: 409" en Subida Manual de Facturas (gastos fijos)

> Añadido 10-Jul-2026. Causa raíz y fix backend en `backend/agents.md` → "Deduplicación de facturas por número + PROVEEDOR".

**Qué era:** en `GastosAdminSubidaView.tsx` (perfil gastos fijos), registrar una cuenta de cobro fallaba con el genérico "Error HTTP: 409". NO era un fallo del upload en sí: `POST /facturas/` deduplicaba solo por número y devolvía la **factura de otro proveedor** con el mismo texto genérico (`CUENTA DE COBRO JUNIO`), y adjuntarle el PDF chocaba con el `FACTURA_PDF` que esa factura ya tenía.

**Por qué el mensaje era genérico (regla a recordar):** el router de files del backend responde los errores 400/409/500 del upload con body **plano** `{code, message}`, sin la clave `detail` que usa el resto de la API. Todo handler que haga `error.detail || fallback` cae al fallback. Desde el 10-Jul-2026, `uploadFacturaFileViaBackend` (`src/lib/api.ts`) y el `handleSubmit` de `GastosAdminSubidaView.tsx` extraen el mensaje con la cascada:

```ts
(typeof err.detail === 'string' && err.detail) || err.detail?.message || err.message || fallback
```

Al agregar un fetch nuevo contra endpoints de files, usar esa misma cascada — y OJO: `new Error(err.detail)` con `detail` objeto (formato `{code, message}` o los 422 de FastAPI, que traen array) muestra `[object Object]`.

## Gotcha: el fallback silencioso del upload

`uploadFacturaFile` (`src/lib/api.ts`) intenta primero el camino presigned (request-upload-url → PUT a S3 → confirm-upload) y si CUALQUIER paso falla cae a `uploadFacturaFileViaBackend` (multipart) — el usuario solo ve el error del segundo intento. Además `confirm-upload` NO verifica duplicados en el backend (solo request-upload-url lo hace): si confirm alcanzó a registrar en BD pero la respuesta se perdió, el fallback choca con su propio archivo y da 409 con el PDF **ya subido**. Ante un 409 inesperado, verificar en la Bandeja de Entrada si la factura quedó registrada antes de reintentar o diagnosticar.
