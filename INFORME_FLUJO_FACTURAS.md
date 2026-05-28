# INFORME DEL SISTEMA CONTABILIDADCQ
## Flujo de Facturas — Contexto para Presentación

---

## ACTORES DEL PROCESO

| Actor | Rol |
|---|---|
| **Radicación (Facturación)** | Recibe y distribuye las facturas al área responsable |
| **Responsable de Área** | Valida y completa los datos de la factura |
| **Gerente Aprobador** | Aprueba facturas por correo electrónico (externo al sistema) |
| **Contabilidad** | Audita la factura antes del pago |
| **Tesorería** | Procesa el pago y cierra el ciclo |

---

## ETAPAS Y ESTADOS DEL CICLO DE VIDA

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1 · RECIBIDA                         Actor: Radicación            │
│                                                                          │
│  La factura ingresa al sistema. Radicación revisa y la asigna            │
│  al área responsable correspondiente.                                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ asigna al área responsable
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 2 · ASIGNADA                         Actor: Responsable de Área  │
│                                                                          │
│  El responsable completa la información requerida:                       │
│   • Centro de Costo y Centro de Operación                                │
│   • Intervalo de entrega a Contabilidad                                  │
│   • Anticipo (si aplica, con porcentaje entre 0–100%)                    │
│   • Códigos de inventario según destino (TIENDA o ALMACÉN)               │
│   • Documentos: OC/OS y Aprobación de Gerencia                           │
│                                                                          │
│  ► En esta etapa se solicita la APROBACIÓN DEL GERENTE por correo        │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ envía a Contabilidad (con todas las validaciones)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3 · EN CONTABILIDAD                  Actor: Contabilidad          │
│                                                                          │
│  Contabilidad revisa y audita la documentación contable.                 │
│  Puede aprobar (→ Tesorería) o devolver con motivo (→ Responsable).      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ aprueba y envía a Tesorería
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 4 · EN TESORERÍA                     Actor: Tesorería             │
│                                                                          │
│  Tesorería carga los documentos de pago requeridos:                      │
│   • PEC  (Paquete de Envío a Contabilidad)                               │
│   • EC   (Extracto de Cuenta)                                            │
│   • PCE  (Paquete de Cierre y Egreso)                                    │
│                                                                          │
│  Una vez completos, cierra la factura.                                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ cierra con documentos completos
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ETAPA 5 · PAGADA  ✓  ESTADO FINAL          Ciclo completado            │
│                                                                          │
│  La factura queda archivada. No admite más modificaciones.               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## FLUJO DE APROBACIÓN DEL GERENTE (Detalle Completo)

### PASO 1 — El Responsable envía la solicitud

Desde el sistema, el Responsable de Área:

1. Selecciona al gerente aprobador de una lista precargada (nombre, cargo, correo)
2. Escribe un **comentario de trazabilidad** explicando el contexto de la factura
3. Hace clic en **"Enviar correo de aprobación"**

El sistema genera automáticamente un **token criptográfico único de 48 caracteres** válido por **72 horas** y envía el correo.

---

### PASO 2 — Lo que recibe el Gerente en su correo

El correo contiene:

| Elemento | Descripción |
|---|---|
| **Encabezado** | "Solicitud de Aprobación de Factura — Sistema CONTABILIDADCQ" |
| **Datos de la factura** | N° factura, proveedor, fecha emisión, fecha vencimiento, valor total |
| **Comentario de trazabilidad** | Texto escrito por el responsable (resaltado en amarillo) |
| **Botón de aprobación** | Botón verde "✓ Aprobar Factura" con enlace único |
| **PDF adjunto** | El PDF de la factura electrónica adjunto al correo |
| **Enlace de respaldo** | Link copiable en caso de que el botón no funcione |
| **Aviso de vigencia** | "Válido por 72 horas" |

---

### PASO 3 — El Gerente aprueba (sin usuario ni contraseña)

El gerente hace clic en el botón desde **cualquier dispositivo** (computador, celular, tablet).

**No necesita cuenta en el sistema.**

El sistema valida automáticamente:
- ✅ El enlace es auténtico (token existe en base de datos)
- ✅ El enlace no ha sido usado antes (un solo uso)
- ✅ El enlace no ha expirado (dentro de 72 horas)

Si todo es válido, el gerente ve una pantalla de confirmación con el resumen de la factura aprobada.

---

### PASO 4 — Registro y notificación

El sistema registra de forma inmutable:

| Campo | Dato registrado |
|---|---|
| `fecha_aprobacion_email` | Fecha y hora exacta de la aprobación |
| `aprobado_por_nombre` | Nombre del gerente |
| `aprobado_por_email` | Correo del gerente |
| `usado_por_ip` | Dirección IP desde donde se aprobó |

El sistema envía automáticamente una **notificación al Responsable** informando que el gerente aprobó y que puede continuar el proceso hacia Contabilidad.

---

## DEVOLUCIONES Y RECHAZOS

```
Responsable de Área  →  puede devolver a Radicación       (motivo obligatorio)
Contabilidad         →  puede devolver a Responsable      (motivo obligatorio)
Tesorería            →  puede devolver a Contabilidad      (motivo obligatorio)
```

Cada devolución registra el motivo y queda en el historial de la factura para trazabilidad completa. El responsable puede ver el motivo de devolución en todo momento.

---

## DOCUMENTOS POR ETAPA

| Etapa | Documentos requeridos |
|---|---|
| **Responsable de Área** | OC / OS (Orden de Compra / Servicio) |
| **Responsable de Área** | Aprobación de Gerencia (documento físico o imagen) |
| **Inventarios — Tienda** | OCT, ECT, FPC (+ NP si hay novedad) |
| **Inventarios — Almacén** | OCC, EDO, FPC (+ NP si hay novedad) |
| **Tesorería** | PEC, EC, PCE |
| **Factura electrónica** | PDF de la factura (se adjunta al correo del gerente) |

---

## VALIDACIONES OBLIGATORIAS ANTES DE ENVIAR A CONTABILIDAD

El sistema no permite avanzar sin completar:

1. **Centro de Costo** — seleccionado y válido
2. **Centro de Operación** — debe pertenecer al Centro de Costo seleccionado
3. **Intervalo de entrega** — 1 semana / 2 semanas / 3 semanas / 1 mes
4. **Anticipo** — si tiene anticipo, el porcentaje debe estar entre 0 y 100%
5. **Inventarios** — códigos completos según el destino (Tienda o Almacén)

---

## SEGURIDAD DEL TOKEN DE APROBACIÓN

| Característica | Detalle |
|---|---|
| **Longitud** | 48 caracteres URL-safe (criptográficamente seguro) |
| **Vigencia** | 72 horas desde el envío |
| **Uso** | Un solo uso — se invalida al ser utilizado |
| **Registro de IP** | Se guarda la IP desde donde se aprobó |
| **Sin autenticación** | El gerente no necesita cuenta en el sistema |
| **Generación** | `secrets.token_urlsafe(48)` — estándar criptográfico de Python |

---

## DIAGRAMA DE RESPONSABILIDADES

```
 RADICACIÓN          RESPONSABLE          GERENTE          CONTABILIDAD      TESORERÍA
     │                    │                  │                   │               │
     │ Crea factura        │                  │                   │               │
     │──────────────────► │                  │                   │               │
     │                    │ Completa datos   │                   │               │
     │                    │ Solicita         │                   │               │
     │                    │ aprobación ─────►│                   │               │
     │                    │                  │ Aprueba por       │               │
     │                    │◄─────────────────│ correo            │               │
     │                    │ Envía a          │                   │               │
     │                    │ Contabilidad ───────────────────────►│               │
     │                    │                  │                   │ Audita        │
     │                    │                  │                   │ Envía a ─────►│
     │                    │                  │                   │ Tesorería     │
     │                    │                  │                   │               │ Sube PEC/EC/PCE
     │                    │                  │                   │               │ Cierra factura
     │                    │                  │                   │               │ → PAGADA ✓
```

---

## PUNTOS CLAVE PARA LA PRESENTACIÓN

1. **El gerente aprueba desde su correo** — sin login, sin instalaciones, cualquier dispositivo
2. **Token único con 72h de vigencia** — seguro, inviolable y de un solo uso
3. **PDF adjunto automáticamente** — el gerente ve exactamente lo que aprueba
4. **Comentario de trazabilidad** — el responsable explica el contexto antes de enviar
5. **Trazabilidad completa** — quién aprobó, cuándo y desde qué IP
6. **5 etapas lineales** con posibilidad de devolución en cualquier punto con motivo
7. **Documentación obligatoria** por etapa antes de poder avanzar
8. **Notificaciones automáticas** en cada transición relevante

---

*Sistema CONTABILIDADCQ — Documento generado el 27 de abril de 2026*
