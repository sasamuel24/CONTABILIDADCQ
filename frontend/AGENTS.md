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
| Aprobación del gerente | `src/pages/AprobarPaquetePage.tsx` (ruta pública `/aprobar-paquete?token=`) | Aprueba al cargar. Si el token es de una solicitud parcial y quedan pendientes, muestra "¡Aprobación registrada!" con el conteo de solicitudes que faltan |
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

## Regla al escribir/editar componentes

1. **Antes de asumir que una clase Tailwind funciona, verificar que exista**: `grep "\.nombre-clase" src/index.css` (ojo con el escape de `:` y `.` → `.sm\:flex`, `.w-3\.5`).
2. Si falta y se necesita: **añadir su definición estándar de Tailwind a mano** en el bloque "Utilidades estructurales" de `index.css` (después del fix de `h-screen`), o usar `style` inline.
3. Las variantes responsive van **en pareja**: nunca añadir `.hidden` sin sus `sm:`/`md:` correspondientes (y viceversa) o se oculta contenido de escritorio.
4. Los keyframes propios se llaman `cq-spin` y `cq-pulse` (no `spin`/`pulse`) para no chocar con nada.
5. **NO activar en bloque las clases cosméticas que siguen faltando** (`text-xs`, `font-semibold`, `rounded-xl`, paddings): cambiarían la apariencia de toda la app en todos los roles de golpe. Si algún día se instala Tailwind real, hacerlo con revisión visual completa de cada rol.

## Cómo auditar (script rápido)

Extraer los tokens de `className` de `src/**/*.tsx` y compararlos contra los selectores `.clase` de `src/index.css` (des-escapando `\:` `\.` `\/`). Los que no aparezcan, no aplican.

---

# Errores "validation error for ..." al asignar/editar carpetas

> Añadido 9-Jul-2026, tras el bug en "Asignar a Carpeta" con facturas en estado Pagada.

- La asignación de una factura a carpeta se hace con **PUT `/carpetas/{id}`** (`updateCarpeta` en `src/lib/api.ts`, usado por `AsignarCarpetaModal.tsx`, `CarpetasPanel.tsx` y `CarpetasPanelTesoreria.tsx`).
- Si el modal muestra un error tipo `"Error al actualizar carpeta: 1 validation error for CarpetaResponse ... input_type=Estado"`, es un **bug de serialización del backend** (schema Pydantic esperando string donde el ORM entrega un objeto de relación), NO un error del usuario ni del frontend. Detalle y regla en `backend/agents.md` → "Schemas Pydantic sobre ORM".
- **Importante:** en esos casos la operación casi siempre **SÍ se guardó** (el commit en BD ocurre antes de serializar la respuesta). Antes de reintentar la asignación, refrescar el árbol de carpetas y verificar — reintentar a ciegas puede archivar la factura dos veces o en carpeta equivocada.
- Caso concreto (corregido 9-Jul-2026): asignar una factura a una carpeta cuyos hijos contenían facturas hacía reventar la respuesta porque `FacturaEnCarpeta.estado` recibía el objeto `Estado` del ORM. Fix: `field_validator(mode='before')` en `backend/modules/carpetas/schemas.py`.
