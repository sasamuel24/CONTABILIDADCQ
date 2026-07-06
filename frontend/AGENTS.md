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
