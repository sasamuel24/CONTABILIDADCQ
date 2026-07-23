# Deployment: Archivo Egreso para Carpetas de Tesorería

## 📋 Resumen de Cambios

Esta actualización agrega la funcionalidad para adjuntar archivos PDF de control de egresos a cada carpeta de tesorería.

### Cambios Backend

1. **Base de Datos**
   - Nueva columna: `archivo_egreso_url` (TEXT, nullable) en tabla `carpetas_tesoreria`
   - Migración: `462a14cc04de_add_archivo_egreso_to_carpetas_tesoreria.py`

2. **Modelo** (`backend/db/models.py`)
   - Agregado campo `archivo_egreso_url: Mapped[Optional[str]]` al modelo `CarpetaTesoreria`

3. **Schemas** (`backend/modules/carpetas_tesoreria/schemas.py`)
   - Actualizado `CarpetaTesoreriaBase`
   - Actualizado `CarpetaTesoreriaCreate`
   - Actualizado `CarpetaTesoreriaUpdate`
   - Actualizado `CarpetaTesoreriaSimple`
   - Actualizado `CarpetaTesoreriaResponse`
   - Actualizado `CarpetaTesoreriaWithChildren`

4. **Repository** (`backend/modules/carpetas_tesoreria/repository.py`)
   - Método `update` ahora acepta parámetro `update_archivo: bool`
   - Permite actualizar campo a NULL explícitamente

5. **Service** (`backend/modules/carpetas_tesoreria/service.py`)
   - Nuevo método: `upload_archivo_egreso(carpeta_id, file)`
   - Nuevo método: `delete_archivo_egreso(carpeta_id)`
   - Integración con S3Service para almacenamiento

6. **Router** (`backend/modules/carpetas_tesoreria/router.py`)
   - Nuevo endpoint: `POST /carpetas-tesoreria/{carpeta_id}/archivo-egreso`
   - Nuevo endpoint: `DELETE /carpetas-tesoreria/{carpeta_id}/archivo-egreso`

### Cambios Frontend

1. **API Client** (`frontend/src/lib/api.ts`)
   - Interfaces actualizadas con campo `archivo_egreso_url`
   - Nueva función: `uploadArchivoEgresoCarpeta(carpetaId, file)`
   - Nueva función: `deleteArchivoEgresoCarpeta(carpetaId)`

2. **Componente** (`frontend/src/components/CarpetasPanelTesoreria.tsx`)
   - Badge visual "PDF" cuando carpeta tiene archivo adjunto
   - Botón "Upload" para subir PDF
   - Botón "Eliminar" para quitar PDF
   - Validaciones: solo PDF, máximo 10MB

## 🚀 Pasos de Deployment

### Local (Desarrollo)

```bash
# 1. Backend - Ejecutar migración
cd backend
python -m alembic upgrade head

# 2. Verificar columna creada
python -c "from db.session import engine; from sqlalchemy import inspect; print(inspect(engine).get_columns('carpetas_tesoreria'))"

# 3. Reiniciar servidor
# (Ctrl+C y volver a ejecutar uvicorn)
```

### Producción (EC2)

```bash
# 1. Conectar al servidor
ssh -i "key-contabilidad.pem" ubuntu@ec2-18-220-253-46.us-east-2.compute.amazonaws.com

# 2. Copiar script de deployment
# (Desde local)
scp -i "key-contabilidad.pem" backend/deploy-archivo-egreso-ec2.sh ubuntu@ec2-18-220-253-46.us-east-2.compute.amazonaws.com:~/

# 3. Ejecutar script
cd ~
chmod +x deploy-archivo-egreso-ec2.sh
./deploy-archivo-egreso-ec2.sh

# 4. Verificar que todo funciona
curl http://localhost:8000/api/v1/health
```

**O ejecutar manualmente:**

```bash
# En el servidor EC2
cd /home/ubuntu/CONTABILIDADCQ

# Pull cambios
git pull origin main

# Activar entorno
cd backend
source .venv/bin/activate

# Ejecutar migración
python -m alembic upgrade head

# Reiniciar servicio
sudo systemctl restart backend

# Verificar
sudo systemctl status backend
sudo journalctl -u backend -n 50 --no-pager
```

## ✅ Verificación

### Backend

1. **Verificar columna en base de datos:**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'carpetas_tesoreria' 
AND column_name = 'archivo_egreso_url';
```

Resultado esperado:
```
column_name        | data_type | is_nullable
-------------------|-----------|------------
archivo_egreso_url | text      | YES
```

2. **Verificar endpoints:**
```bash
# Obtener carpetas (debe incluir archivo_egreso_url en respuesta)
curl http://localhost:8000/api/v1/carpetas-tesoreria/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Subir archivo a carpeta
curl -X POST http://localhost:8000/api/v1/carpetas-tesoreria/{ID}/archivo-egreso \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"

# Eliminar archivo de carpeta
curl -X DELETE http://localhost:8000/api/v1/carpetas-tesoreria/{ID}/archivo-egreso \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend

1. **Crear carpeta de tesorería**
2. **Hacer clic en botón "Upload" (icono verde)**
3. **Seleccionar archivo PDF (máx 10MB)**
4. **Verificar que aparece badge "PDF" verde**
5. **Hacer clic en botón "Eliminar" (icono naranja)**
6. **Verificar que badge desaparece**

### S3

Verificar que los archivos se guardan en:
```
s3://contabilidadcq-dev/carpetas-tesoreria/{carpeta_id}/archivo-egreso.pdf
```

## 🔧 Troubleshooting

### Error: "Column archivo_egreso_url does not exist"

**Solución:** Ejecutar migración
```bash
cd backend
python -m alembic upgrade head
```

### Error: "Multiple heads detected"

**Solución:** Crear merge
```bash
python -m alembic merge heads -m "merge_heads"
python -m alembic upgrade head
```

### Error: "S3 access denied"

**Solución:** Verificar credenciales AWS en `.env`
```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
S3_BUCKET=contabilidadcq-dev
```

### Error: "File too large"

El límite es 10MB. Si necesitas subir archivos más grandes, ajustar en:
- `frontend/src/components/CarpetasPanelTesoreria.tsx` línea ~133
- Considerar configurar FastAPI `max_request_size`

## 📝 Notas

- Los archivos PDF se almacenan en S3, no en base de datos
- Cada carpeta solo puede tener 1 archivo PDF adjunto
- Al subir nuevo archivo, el anterior se elimina automáticamente de S3
- El campo `archivo_egreso_url` guarda la key de S3, no la URL completa
- Para mostrar/descargar PDF, usar S3Service.get_presigned_url()

## 🎯 Testing Sugerido

1. ✅ Crear carpeta sin archivo → verificar que badge no aparece
2. ✅ Subir PDF válido → verificar que badge aparece
3. ✅ Intentar subir archivo no-PDF → verificar error
4. ✅ Intentar subir archivo >10MB → verificar error
5. ✅ Subir segundo PDF → verificar que reemplaza el primero
6. ✅ Eliminar PDF → verificar que badge desaparece
7. ✅ Eliminar carpeta con PDF → verificar que archivo se elimina de S3
8. ✅ Verificar que URL de S3 funciona (si implementas get_presigned_url)

## 🔄 Rollback

Si necesitas revertir los cambios:

```bash
# Local/Producción
cd backend
python -m alembic downgrade -1

# Verificar
python -m alembic current
```

Esto ejecutará el `downgrade()` de la migración que elimina la columna.
