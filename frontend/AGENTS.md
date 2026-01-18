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
