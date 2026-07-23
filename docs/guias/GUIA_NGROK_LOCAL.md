# Guía rápida: activar ngrok para pruebas locales con n8n

Cómo levantar la API local y exponerla con una URL pública. Tiempo estimado: 2 minutos.

## Paso 1 — Arrancar el backend (puerto 8000)

Abre una terminal (PowerShell) y ejecuta:

```powershell
cd C:\desarollos\CONTABILIDADCQ\backend
C:\desarollos\CONTABILIDADCQ\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Déjala abierta. Sabes que está listo cuando aparece:
`Uvicorn running on http://0.0.0.0:8000`

## Paso 2 — Arrancar ngrok

Abre **otra** terminal y ejecuta:

```powershell
C:\Tools\ngrok\ngrok.exe http 8000
```

## Paso 3 — Ver la URL pública

En la pantalla de ngrok busca la línea **Forwarding**:

```
Forwarding   https://ebb8-201-217-215-58.ngrok-free.app -> http://localhost:8000
```

Esa dirección `https://....ngrok-free.app` es tu URL pública.

> Alternativa: abre http://127.0.0.1:4040 en el navegador (panel de ngrok,
> ahí también se ve la URL y cada request que llega).

## Paso 4 — Actualizar la URL en n8n

En el nodo **HTTP Request** de n8n, pega la URL pública + la ruta de la API:

```
https://TU-URL.ngrok-free.app/api/v1/facturas/
```

⚠️ **Sin** el `/v1` inicial de producción (ese es el stage de AWS API Gateway; en local no existe).

El header `x-api-key` no cambia: `mi-api-key-secreta-2025`

## Paso 5 (opcional) — Frontend local

Para ver los resultados en el app local:

```powershell
cd C:\desarollos\CONTABILIDADCQ\frontend
npm run dev
```

Se abre en http://localhost:3000 (ya está configurado para apuntar al backend local).

## Cosas a tener en cuenta

- **La URL cambia cada vez que reinicias ngrok** (plan gratuito). Cada vez que lo levantes, actualiza el nodo de n8n con la URL nueva.
- Las pruebas usan la **BD local** (`localhost:5432/contabilidadcq`), nunca tocan producción.
- Si reenvías una factura que ya existe (mismo número + proveedor), la API devuelve la existente **sin actualizarla** — para re-probar hay que borrarla primero de la BD local.
- Para apagar todo: cierra las dos terminales (o `Ctrl+C` en cada una).
