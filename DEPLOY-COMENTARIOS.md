# GUÍA DE DESPLIEGUE A PRODUCCIÓN - MÓDULO COMENTARIOS
## Sistema de Facturación Café Quindío

---

## 📋 RESUMEN DE CAMBIOS

### Backend
- ✅ Nuevo modelo: `ComentarioFactura`
- ✅ Nuevo módulo: `modules/comentarios/`
- ✅ Nuevos endpoints API REST
- ✅ Migración Alembic: `5538a10e5277_add_comentarios_factura_table.py`

### Frontend
- ✅ Componente: `ComentariosFactura.tsx`
- ✅ Integración en vistas de detalle (4 componentes)
- ✅ API client actualizado
- ✅ Modales de notificación mejorados

---

## 🚀 PASOS DE DESPLIEGUE

### PASO 1: Subir código a Git

#### 1.1. Backend
```bash
cd c:\desarollos\CONTABILIDADCQ\backend

# Ver cambios
git status

# Agregar archivos
git add .

# Commit
git commit -m "feat: Sistema de comentarios con trazabilidad completa para facturas"

# Push
git push origin main
```

#### 1.2. Frontend
```bash
cd c:\desarollos\CONTABILIDADCQ\frontend

# Ver cambios
git status

# Agregar archivos
git add .

# Commit
git commit -m "feat: UI de comentarios con integración completa y modales mejorados"

# Push
git push origin main
```

---

### PASO 2: Desplegar Backend en EC2

Conectarse al servidor EC2:
```bash
ssh ubuntu@<IP_DEL_SERVIDOR>
```

#### 2.1. Actualizar código
```bash
cd /home/ubuntu/CONTABILIDADCQ/backend

# Pull de cambios
git pull origin main

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias (si hay nuevas)
pip install -r requirements.txt
```

#### 2.2. Aplicar migración de base de datos
```bash
# Dar permisos de ejecución al script
chmod +x deploy-comentarios-migration-ec2.sh

# Ejecutar migración
./deploy-comentarios-migration-ec2.sh
```

El script te pedirá confirmación. Responde **"si"** para continuar.

#### 2.3. Reiniciar servicio backend
```bash
sudo systemctl restart backend

# Verificar que está corriendo
sudo systemctl status backend

# Ver logs en tiempo real
sudo journalctl -u backend -f
```

---

### PASO 3: Desplegar Frontend en EC2

#### 3.1. Actualizar código
```bash
cd /home/ubuntu/CONTABILIDADCQ/frontend

# Pull de cambios
git pull origin main

# Instalar dependencias (si hay nuevas)
npm install
```

#### 3.2. Build de producción
```bash
# Generar build optimizado
npm run build
```

#### 3.3. Reiniciar servicio frontend (si aplica)
```bash
# Si usas PM2
pm2 restart frontend

# O reiniciar servidor web
sudo systemctl restart nginx
```

---

## ✅ VERIFICACIÓN POST-DESPLIEGUE

### 1. Verificar Backend
```bash
# Verificar que el servicio está corriendo
curl http://localhost:8000/health

# Verificar nuevos endpoints
curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:8000/api/v1/facturas/<FACTURA_ID>/comentarios
```

### 2. Verificar Base de Datos
```bash
# Conectarse a PostgreSQL
sudo -u postgres psql -d contabilidad_db

# Verificar tabla creada
\dt comentarios_factura

# Ver estructura
\d comentarios_factura

# Salir
\q
```

### 3. Verificar Frontend
- Abrir aplicación en el navegador
- Ir al detalle de una factura
- Verificar que aparece la sección "Comentarios"
- Crear un comentario de prueba
- Verificar que se guarda correctamente
- Probar editar y eliminar (solo comentarios propios)

---

## 🔧 TROUBLESHOOTING

### Error: "Module 'comentarios' not found"
```bash
# Verificar que el módulo existe
ls /home/ubuntu/CONTABILIDADCQ/backend/modules/comentarios/

# Reiniciar servicio
sudo systemctl restart backend
```

### Error: "Tabla comentarios_factura no existe"
```bash
# Verificar versión de migración
cd /home/ubuntu/CONTABILIDADCQ/backend
source venv/bin/activate
alembic current

# Si no se aplicó, ejecutar:
alembic upgrade head
```

### Error 500 al crear comentario
```bash
# Ver logs del backend
sudo journalctl -u backend -n 100 --no-pager

# Verificar permisos del usuario en la BD
sudo -u postgres psql -d contabilidad_db -c "SELECT * FROM pg_tables WHERE tablename='comentarios_factura';"
```

---

## 📝 ROLLBACK (si es necesario)

Si algo sale mal, puedes revertir la migración:

```bash
cd /home/ubuntu/CONTABILIDADCQ/backend
source venv/bin/activate

# Revertir última migración
alembic downgrade -1

# Reiniciar servicio
sudo systemctl restart backend
```

---

## 📞 CONTACTO

Si encuentras problemas durante el despliegue:
1. Revisar logs del sistema
2. Verificar el estado de los servicios
3. Comprobar la conectividad a la base de datos

---

## ✨ FUNCIONALIDADES NUEVAS

### Para usuarios:
- ✅ Agregar comentarios en facturas
- ✅ Ver historial de comentarios con trazabilidad
- ✅ Editar comentarios propios
- ✅ Eliminar comentarios propios
- ✅ Ver quién comentó y cuándo
- ✅ Modales de confirmación mejorados

### Para administradores:
- ✅ Trazabilidad completa de comentarios
- ✅ Registro de usuario, fecha y hora
- ✅ Indicador de ediciones
- ✅ API REST completa para integraciones futuras

---

**Fecha de despliegue recomendada:** Fuera del horario laboral
**Tiempo estimado:** 15-20 minutos
**Requiere downtime:** Mínimo (~2 minutos durante reinicio de servicios)
