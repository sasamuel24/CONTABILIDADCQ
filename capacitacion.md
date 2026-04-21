# 📘 Guía de Capacitación — Sistema de Gestión Contable Café Quindío

> **¿Para quién es esta guía?**
> Para todos los colaboradores que usan el sistema, sin importar su área. Cada sección explica exactamente qué hace cada perfil, paso a paso, en lenguaje sencillo.

---

## 🏠 ¿Qué es el sistema?

El **Sistema de Gestión Contable de Café Quindío** es una plataforma web que centraliza todo el proceso de facturas y gastos de la empresa:

- Las **facturas de proveedores** entran al sistema y recorren un camino de revisión y aprobación hasta ser pagadas.
- Los **técnicos de mantenimiento** registran sus gastos de campo semana a semana para que sean legalizados y reembolsados.
- Cada área tiene su propio espacio de trabajo y solo ve lo que le corresponde.

---

## 👤 ¿Quiénes usan el sistema?

| Perfil | ¿Qué hace en el sistema? |
|--------|--------------------------|
| **Facturación** | Recibe facturas, las distribuye y lleva el control general |
| **Responsable de Área** | Revisa y aprueba las facturas de su área y los gastos de técnicos |
| **Contabilidad** | Hace la revisión contable final antes del pago |
| **Tesorería** | Organiza los pagos y marca las facturas como pagadas |
| **Gerencia Financiera** | Consulta y supervisa los pagos programados (solo lectura) |
| **Técnico de Mantenimiento** | Registra sus gastos de campo semana a semana |
| **Dirección / Centro Documental** | Consulta el archivo histórico de todas las facturas |
| **Administrador** | Gestiona usuarios, áreas y configuración del sistema |

---

---

# 📂 MÓDULO 1: FACTURAS DE PROVEEDORES

> Este es el flujo principal del sistema. Una factura de proveedor entra al sistema y pasa por varias manos hasta ser pagada.

---

## 🔄 El recorrido de una factura (visión general)

```
Factura llega al sistema
        ↓
   Facturación la recibe y asigna
        ↓
   Responsable de Área la revisa y completa
        ↓
   Contabilidad hace revisión final
        ↓
   Tesorería la paga
        ↓
   Queda archivada en el Centro Documental
```

---

## 📌 PERFIL: FACTURACIÓN

### ¿Cómo llegan las facturas?
Las facturas ingresan automáticamente al sistema desde el correo o sistema externo de la empresa. No es necesario crearlas a mano. Cuando llegan, aparecen en la bandeja de Facturación en estado **"Recibida"**.

### ¿Qué hace Facturación con cada factura?

**Paso 1 — Ver la bandeja de entrada**
Al ingresar, verá una lista de todas las facturas recibidas. Puede filtrar por estado, área, proveedor o fecha.

**Paso 2 — Abrir el detalle de una factura**
Al hacer clic en una factura, se abre su ficha completa con:
- Proveedor, número de factura, monto, fecha
- Archivos adjuntos (PDF, imagen)
- Historial de movimientos y comentarios

**Paso 3 — Asignar la factura a un área**
Facturación decide a qué área corresponde esa factura (Mantenimiento, Administrativo, Operaciones, etc.) y la asigna al responsable correspondiente.

**Paso 4 — Completar datos contables (si aplica)**
Puede completar o verificar:
- **Centro de Costo**: el departamento que asume el gasto
- **Centro de Operación**: la operación específica dentro del centro de costo
- **Cuenta Auxiliar**: la cuenta contable
- **Si tiene inventarios**: indicar si la factura requiere entrada de materiales al inventario
- **Si tiene anticipo**: si parte del pago ya fue adelantado

**Paso 5 — Distribuir el gasto entre varios centros (si aplica)**
Si una factura debe dividirse entre varios departamentos, Facturación puede distribuirla en porcentajes. Por ejemplo:
> "Esta factura de $1.000.000 va un 60% a Mantenimiento y un 40% a Operaciones."

**Paso 6 — Enviar a Tesorería (al final del proceso)**
Una vez que Contabilidad aprueba, Facturación hace el envío final a Tesorería para que procedan con el pago.

**Paso 7 — Añadir comentarios**
En cualquier momento puede dejar un comentario en la factura para comunicarse con otras áreas (Responsable, Contabilidad, etc.).

---

## 📌 PERFIL: RESPONSABLE DE ÁREA

### ¿Cuándo le llega una factura?
Cuando Facturación asigna una factura a su área, usted la verá en su bandeja de entrada.

### ¿Qué hace el Responsable?

**Paso 1 — Revisar la factura**
Abrir la factura y verificar que los datos sean correctos: proveedor, monto, concepto, archivos adjuntos.

**Paso 2 — Completar o verificar datos**
Si Facturación no completó toda la información:
- Confirmar o cambiar el Centro de Costo / Centro de Operación
- Si la factura tiene materiales: confirmar los códigos de inventario correspondientes
- Si hay anticipo: confirmar el porcentaje

**Paso 3 — Tomar una decisión**

✅ **Si todo está correcto:** Cambiar el estado a "Aprobado por Área" para que pase a Contabilidad.

🔁 **Si hay algo incorrecto:** Devolver la factura a Facturación con un comentario explicando qué falta o qué está mal.

---

## 📌 PERFIL: CONTABILIDAD

### ¿Cuándo le llega una factura?
Cuando el Responsable de Área la aprueba, aparece en la bandeja de Contabilidad.

### ¿Qué hace Contabilidad?

**Paso 1 — Revisar los datos contables**
Verificar que los centros de costo, cuentas auxiliares y distribuciones estén correctamente asignados.

**Paso 2 — Tomar una decisión**

✅ **Si todo está correcto:** Aprobar la factura para que pase a Tesorería.

🔁 **Si hay algo incorrecto:** Devolver al Responsable o directamente a Facturación con comentario explicativo.

---

## 📌 PERFIL: TESORERÍA (módulo de facturas)

### ¿Cuándo le llega una factura?
Cuando Facturación la envía a Tesorería después de que Contabilidad la aprueba.

### ¿Qué hace Tesorería?

**Paso 1 — Ver el explorador de carpetas**
Las facturas se organizan en carpetas (por mes, proveedor, etc.). Tesorería navega estas carpetas como un explorador de archivos.

**Paso 2 — Programar el pago**
Tesorería organiza las facturas en carpetas de pago según las fechas programadas y sube el documento de control de egresos (archivo PDF con el resumen de pagos a realizar).

**Paso 3 — Registrar el pago**
Una vez realizado el pago, marca la factura como **"Pagada"** en el sistema y registra la fecha de pago.

---

## 📌 PERFIL: GERENCIA FINANCIERA

### ¿Qué ve Gerencia?
Gerencia tiene acceso de **solo lectura** a las carpetas de Tesorería. Puede:
- Ver qué facturas están programadas para pago
- Ver los montos por pagar
- Descargar los controles de egresos
- Supervisar el estado de los pagos

> ⚠️ **Gerencia no puede modificar nada.** Solo consulta y supervisa.

---

---

# 🧾 MÓDULO 2: GASTOS Y LEGALIZACIÓN DE TÉCNICOS

> Los técnicos de mantenimiento realizan gastos en campo (combustible, hospedaje, materiales, etc.) y los reportan semanalmente para que la empresa los reembolse. Este módulo gestiona ese proceso.

---

## 🔄 El recorrido de un paquete de gastos (visión general)

```
Técnico crea un "paquete" para la semana
        ↓
   Agrega todos sus gastos de esa semana con soportes (fotos/PDFs)
        ↓
   Envía para revisión al Responsable de Mantenimiento
        ↓
   Responsable revisa y aprueba
        ↓
   Gerencia recibe un correo y aprueba con un clic
        ↓
   Facturación envía a Tesorería
        ↓
   Tesorería realiza el pago y lo registra
        ↓
   Técnico recibe notificación de que fue legalizado ✅
```

---

## 📌 PERFIL: TÉCNICO DE MANTENIMIENTO

### ¿Cómo registro mis gastos de la semana?

**Paso 1 — Crear un nuevo paquete semanal**
Al ingresar, haga clic en **"Nuevo paquete"** y seleccione la semana ISO correspondiente (el sistema le muestra las fechas de inicio y fin automáticamente).

> 📌 Solo puede haber **un paquete por semana**. Si ya creó uno, aparecerá en su historial.

**Paso 2 — Agregar gastos uno por uno**
Por cada gasto, complete:

| Campo | ¿Qué es? | Ejemplo |
|-------|----------|---------|
| **Fecha** | Día en que hizo el gasto | 15/04/2026 |
| **No. Identificación** | NIT o cédula de quien le cobró | 8915002771 |
| **Pagado a** | Nombre del establecimiento que le cobró | TAXBELALCAZAR |
| **Concepto** | Descripción breve del gasto | Tiquete Armenia - Cali |
| **No. Recibo** | Número de la factura o tiquete | 3464783 |
| **Valor pagado** | Cuánto pagó (sin puntos ni comas) | 45000 |
| **Centro de Costo** | Departamento al que pertenece | Mantenimiento |
| **Centro de Operación** | Operación específica | Mtto Planta Armenia |
| **Cuenta Auxiliar** | Cuenta contable (si aplica) | 513505 |

> 💡 **Tip — ¡Escanear automático!** Si tiene foto de la factura o tiquete, puede usar el **botón de la cámara** para que el sistema lea automáticamente los datos. Verifique siempre que los campos queden correctos antes de guardar.

> ⚠️ **Importante sobre "No. Identificación" y "Pagado a":**
> - Estos campos corresponden a **quien le vendió** el bien o servicio (el proveedor).
> - **NO son los datos de Café Quindío**, aunque aparezcan en el documento como "cliente".
> - Ejemplo: un tiquete de bus → "Pagado a" es la empresa de transporte, no Café Quindío.

**Paso 3 — Adjuntar el soporte**
Por cada gasto puede adjuntar hasta **2 archivos** (foto de la factura, PDF, etc.).
- Formatos aceptados: JPG, PNG, PDF
- Asegúrese de que la imagen sea legible

**Paso 4 — Guardar**
Los cambios se guardan automáticamente cada vez que termina de llenar un campo.

**Paso 5 — Enviar para revisión**
Cuando haya terminado de agregar todos los gastos de la semana, haga clic en **"Enviar para revisión"**. A partir de este momento ya no podrá editar el paquete.

### ¿Qué pasa después de enviar?

| Estado | ¿Qué significa? | ¿Qué hago yo? |
|--------|-----------------|---------------|
| 🟡 **En revisión** | El Responsable lo está revisando | Esperar |
| 🔴 **Devuelto** | El Responsable encontró algo incorrecto | Leer el motivo, corregir y reenviar |
| 🟢 **Aprobado** | El Responsable lo aprobó, espera aprobación de Gerencia | Esperar |
| 🔵 **En tesorería** | Facturación lo envió a Tesorería para pago | Esperar |
| ✅ **Pagado** | ¡Listo! El pago fue realizado | Verificar que el monto sea correcto |

### ¿Qué hago si me devuelven un gasto?
A veces Facturación puede devolver un **gasto individual** (no todo el paquete) con un motivo. En ese caso:
1. Verá el gasto marcado en rojo con el motivo de devolución.
2. Corrija lo que se indica.
3. Haga clic en **"Reenviar gasto"** para que siga su proceso.

---

## 📌 PERFIL: RESPONSABLE DE ÁREA (módulo de gastos)

### ¿Cuándo me llega un paquete?
Cuando un técnico de su área envía un paquete para revisión, usted recibirá un correo y el paquete aparecerá en su bandeja.

### ¿Qué hago como Responsable?

**Paso 1 — Abrir el paquete**
Ver todos los gastos del técnico uno por uno. Puede descargar y ver los soportes adjuntos (fotos o PDFs de facturas).

**Paso 2 — Revisar cada gasto**
Verifique que:
- Los datos del gasto sean correctos (fecha, proveedor, monto)
- Existan soportes adjuntos
- Los centros de costo y operación sean los correctos
- Los gastos correspondan a actividades del período informado

**Paso 3 — Tomar una decisión**

✅ **Si todo está correcto:** Haga clic en **"Aprobar"**. El sistema enviará automáticamente un correo a la Gerencia Financiera para que dé su visto bueno.

🔁 **Si hay algo incorrecto:** Haga clic en **"Devolver"** y escriba el motivo. El técnico recibirá una notificación con su explicación para que lo corrija.

> 💡 Si necesita reenviar el correo de aprobación a Gerencia (por ejemplo, si no lo recibieron), hay un botón de **"Reenviar correo de aprobación"**.

---

## 📌 PERFIL: GERENCIA FINANCIERA (módulo de gastos)

### ¿Cuándo me llega una solicitud?
Cuando el Responsable de Área aprueba un paquete, usted recibe un **correo electrónico** con un botón de aprobación.

### ¿Cómo apruebo?
1. Abra el correo electrónico recibido.
2. Revise el resumen del paquete (técnico, semana, total de gastos).
3. Haga clic en el botón **"Aprobar paquete"** dentro del correo.
4. Se abrirá una página confirmando que el paquete fue aprobado.

> ⚠️ El enlace de aprobación **tiene una vigencia de 72 horas**. Si venció, pida al Responsable o a Facturación que reenvíen el correo.

> 🔒 No necesita iniciar sesión en el sistema para aprobar por correo.

---

## 📌 PERFIL: FACTURACIÓN (módulo de gastos)

### ¿Qué hace Facturación con los paquetes?

**Ver todos los paquetes**
Facturación tiene visibilidad total de todos los paquetes de todos los técnicos.

**Revisar gastos individuales**
Puede revisar cada línea de gasto y, si encuentra algo incorrecto, **devolver ese gasto específico** al técnico con un motivo, sin rechazar todo el paquete.

**Enviar a Tesorería**
Cuando el paquete está aprobado por Gerencia, Facturación hace clic en **"Enviar a Tesorería"** para que procedan con el reembolso.

> 💡 Si algunos gastos del paquete fueron devueltos individualmente, el monto enviado a Tesorería excluirá esos gastos hasta que el técnico los corrija.

**Subir documento contable (CM PDF)**
Facturación puede subir el comprobante de movimiento contable (CM PDF) por cada gasto individual para efectos de registro contable.

---

## 📌 PERFIL: TESORERÍA (módulo de gastos)

### ¿Qué hace Tesorería con los paquetes?

**Ver paquetes en espera de pago**
La vista de paquetes muestra los que están en estado "En tesorería", listos para ser pagados.

**Revisar el detalle antes de pagar**
Al abrir un paquete, Tesorería ve:
- Todos los gastos con sus valores
- Los archivos soporte de cada gasto
- El total a pagar (descontando gastos devueltos)
- Los documentos contables (CM PDF) adjuntos

**Marcar como pagado**
Una vez realizado el pago:
1. Hacer clic en **"Marcar como pagado"**
2. Confirmar la fecha de pago
3. El técnico recibirá una notificación de que su legalización fue completada ✅

**Pago masivo**
Si hay varios paquetes para pagar al mismo tiempo, puede seleccionarlos todos y hacer un **pago masivo** con una sola fecha de pago.

---

---

# 🗄️ MÓDULO 3: CENTRO DOCUMENTAL

> El Centro Documental es el **archivo histórico** de todas las facturas del sistema. Permite consultar, buscar y organizar facturas de cualquier período.

---

## 📌 PERFIL: DIRECCIÓN / CENTRO DOCUMENTAL

### ¿Para qué sirve este módulo?
Para tener acceso a todas las facturas que han pasado por el sistema: las que ya fueron pagadas, las que están en proceso, y las archivadas. Es útil para auditorías, consultas contables y búsquedas históricas.

### ¿Cómo usar el explorador de facturas?

**Buscar una factura**
Puede buscar por:
- Nombre del proveedor
- Número de factura
- Área que generó el gasto
- Estado de la factura
- Rango de fechas (desde / hasta)

**Ver el detalle de una factura**
Al hacer clic en cualquier factura puede ver:
- Todos sus datos (proveedor, monto, fechas)
- El área y responsable asignados
- Los centros de costo y cuentas contables
- Los archivos adjuntos (PDF de la factura, etc.)
- El historial completo de movimientos y comentarios

**Exportar a Excel**
Si necesita hacer un informe, puede exportar los resultados de su búsqueda a un archivo Excel con todos los datos.

**Asignar a carpeta**
Si una factura no está organizada en una carpeta documental, puede asignarla desde esta vista.

---

---

# ⚙️ MÓDULO 4: ADMINISTRACIÓN DEL SISTEMA

> Solo el perfil **Administrador** tiene acceso a este módulo.

---

## 📌 PERFIL: ADMINISTRADOR

### Gestión de usuarios

**Crear un nuevo usuario:**
1. Ir a la sección **"Usuarios"**
2. Hacer clic en **"Nuevo usuario"**
3. Completar: nombre, correo electrónico, contraseña inicial
4. Asignar **rol** (Facturación, Responsable, Contabilidad, etc.)
5. Asignar **área** a la que pertenece (si aplica)
6. Guardar

**Editar un usuario:**
- Puede cambiar nombre, correo, rol y área en cualquier momento.
- Puede restablecer la contraseña si el usuario la olvidó.
- Puede activar o desactivar el acceso de un usuario.

### Gestión de áreas

**Crear un área nueva:**
1. Ir a la sección **"Áreas"**
2. Hacer clic en **"Nueva área"**
3. Ingresar nombre y código del área
4. Guardar

> Las áreas son los departamentos de la empresa (Mantenimiento, Administración, Operaciones, etc.)

---

---

# 📖 GLOSARIO DE TÉRMINOS

| Término | ¿Qué es? |
|---------|----------|
| **Paquete de gastos** | El grupo de todos los gastos que un técnico reporta en una semana |
| **Folio** | El número único que el sistema le asigna a cada factura o paquete para identificarlo |
| **Centro de Costo** | El departamento o área que "paga" ese gasto |
| **Centro de Operación** | La actividad específica dentro del centro de costo |
| **Cuenta Auxiliar** | La cuenta contable donde se registra el gasto en la contabilidad |
| **Soporte** | El archivo (foto, PDF) que demuestra que el gasto se hizo |
| **Legalización** | El proceso de aprobar y reembolsar los gastos de un técnico |
| **CM PDF** | Comprobante de Movimiento contable — documento que genera contabilidad al procesar el gasto |
| **Control de Egresos** | Documento que resume los pagos a realizar en un período, generado por Tesorería |
| **Estado** | La etapa en la que se encuentra una factura o paquete dentro del proceso |

---

---

# 🚦 RESUMEN RÁPIDO: ¿QUÉ HACE CADA ÁREA?

```
PROVEEDOR
    │
    ▼
┌─────────────────────────────────────────────────┐
│  FACTURACIÓN                                    │
│  • Recibe y distribuye facturas                 │
│  • Asigna a áreas responsables                  │
│  • Envía paquetes de gastos a Tesorería         │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  RESPONSABLE DE ÁREA                            │
│  • Revisa facturas de su departamento           │
│  • Aprueba o devuelve con motivo                │
│  • Revisa y aprueba paquetes de técnicos        │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  CONTABILIDAD                                   │
│  • Revisión contable final de facturas          │
│  • Aprueba o devuelve para correcciones         │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  TESORERÍA                                      │
│  • Programa y ejecuta los pagos                 │
│  • Organiza facturas en carpetas de pago        │
│  • Legaliza gastos de técnicos                  │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  CENTRO DOCUMENTAL / DIRECCIÓN                  │
│  • Consulta histórica de todo                   │
│  • Auditorías y reportes                        │
└─────────────────────────────────────────────────┘


TÉCNICO DE MANTENIMIENTO ──► Registra gastos semanales
                              ↕
                         RESPONSABLE ──► GERENCIA (correo)
                              ↕
                         FACTURACIÓN ──► TESORERÍA ──► PAGO
```

---

> 📞 **¿Tienes dudas?** Contacta al área de Sistemas o al Administrador del sistema.
>
> 📅 Documento generado: Abril 2026 | Versión 1.0 | Sistema de Gestión Contable — Café Quindío
