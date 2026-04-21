export const MOTIVOS_DEVOLUCION = [
  'Documentación soporte incompleta o faltante',
  'Valores o montos incorrectos en la factura',
  'Factura sin orden de compra asociada',
  'Firma o autorización del responsable faltante',
  'Datos del proveedor incorrectos (NIT, razón social, cuenta)',
  'Factura duplicada o ya registrada en el sistema',
  'Concepto no corresponde al servicio o producto contratado',
  'Retenciones mal aplicadas o incorrectas',
  'Factura vencida o fuera del período de vigencia',
  'Centro de costo o área no corresponde',
  'Requiere entrada de inventario no registrada',
  'Falta aprobación de gerencia o dirección',
  'Error en la descripción del bien o servicio',
  'Información tributaria incompleta o incorrecta',
  'Otro motivo (especificar en comentarios)',
] as const;

export const MOTIVOS_COMENTARIO = [
  'Favor adjuntar la documentación soporte requerida',
  'Verificar y corregir los valores registrados',
  'Se requiere autorización formal del área responsable',
  'Pendiente de aprobación por parte de gerencia',
  'Factura en revisión de retenciones aplicables',
  'Solicitar nota crédito al proveedor',
  'Verificar cumplimiento de las condiciones del contrato',
  'Requiere registro de entrada de inventario',
  'Pendiente de asignación de centro de costos',
  'Información enviada a gerencia para aprobación',
  'Se devuelve para corrección de datos del proveedor',
  'Confirmar que los servicios fueron efectivamente prestados',
  'Revisar los soportes de pago adjuntos',
  'Pendiente de revisión por parte de Tesorería',
  'Comentario adicional (especificar)',
] as const;

export type MotivoDevolucion = typeof MOTIVOS_DEVOLUCION[number];
export type MotivoComentario = typeof MOTIVOS_COMENTARIO[number];
