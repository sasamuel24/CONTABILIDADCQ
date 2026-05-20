import { useState } from 'react';
import {
  FileText, ClipboardCheck, Shield, Calculator, Wallet, CheckCircle2,
  ChevronRight, RotateCcw, X, Info,
} from 'lucide-react';

interface FlowNode {
  id: string;
  step: number;
  title: string;
  role: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
  summary: string;
  actions: string[];
  exceptions?: { label: string; target: string }[];
}

const FLOW_NODES: FlowNode[] = [
  {
    id: 'facturacion',
    step: 1,
    title: 'Facturación',
    role: 'Rol: facturación',
    color: '#3b82f6',
    bg: '#eff6ff',
    Icon: FileText,
    summary: 'Punto de entrada del documento. El equipo de facturación crea y envía la factura al flujo.',
    actions: [
      'Carga la factura (XML / PDF / manual)',
      'Adjunta documentos soporte requeridos',
      'Asigna el área y responsable de aprobación',
      'Define la categoría del gasto',
      'Envía a revisión del responsable',
    ],
  },
  {
    id: 'responsable',
    step: 2,
    title: 'Responsable',
    role: 'Rol: responsable',
    color: '#f59e0b',
    bg: '#fffbeb',
    Icon: ClipboardCheck,
    summary: 'El responsable del área valida que el documento sea correcto y autoriza su paso al siguiente nivel.',
    actions: [
      'Revisa la factura y los documentos adjuntos',
      'Valida montos, proveedor y conceptos',
      'Puede solicitar correcciones al emisor',
      'Aprueba hacia Gerencia o directo a Contabilidad',
      'Puede reenviar a doble aprobación si aplica',
    ],
    exceptions: [
      { label: 'Devolver por documentación incompleta', target: 'Facturación' },
    ],
  },
  {
    id: 'gerencia',
    step: 3,
    title: 'Gerencia',
    role: 'Rol: gerencia',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    Icon: Shield,
    summary: 'Aprobación ejecutiva para documentos que requieren visto bueno gerencial. Paso opcional según configuración del área.',
    actions: [
      'Recibe notificación del documento pendiente',
      'Revisa el detalle completo de la factura',
      'Aprueba y envía a Contabilidad',
      'Puede rechazar con observación',
    ],
    exceptions: [
      { label: 'Rechazar y devolver al responsable', target: 'Responsable' },
    ],
  },
  {
    id: 'contabilidad',
    step: 4,
    title: 'Contabilidad',
    role: 'Rol: contabilidad',
    color: '#10b981',
    bg: '#ecfdf5',
    Icon: Calculator,
    summary: 'El equipo contable procesa, codifica y registra el documento en los libros de la empresa.',
    actions: [
      'Recibe la factura aprobada',
      'Asigna centro de costos y cuenta auxiliar',
      'Verifica datos tributarios (NIT, IVA, retenciones)',
      'Registra en el sistema contable',
      'Envía a Tesorería para gestión del pago',
    ],
  },
  {
    id: 'tesoreria',
    step: 5,
    title: 'Tesorería',
    role: 'Rol: tesorería',
    color: '#0891b2',
    bg: '#ecfeff',
    Icon: Wallet,
    summary: 'Tesorería gestiona el pago efectivo de la factura y cierra el ciclo documental.',
    actions: [
      'Recibe facturas listas para pago',
      'Programa el desembolso según flujo de caja',
      'Registra el comprobante de pago',
      'Marca la factura como Pagada',
      'La factura queda archivada y cerrada',
    ],
  },
];

const EXCEPCIONES = [
  {
    from: 'Responsable',
    to: 'Facturación',
    colorFrom: '#f59e0b',
    colorTo: '#3b82f6',
    motivo: 'Documentación incompleta, montos incorrectos o información del proveedor inválida.',
  },
  {
    from: 'Gerencia',
    to: 'Responsable',
    colorFrom: '#8b5cf6',
    colorTo: '#f59e0b',
    motivo: 'Desacuerdo en la aprobación, necesidad de corrección o información adicional.',
  },
];

export function AdminFlujogramaView() {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedNode = FLOW_NODES.find(n => n.id === selected);

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-800"
          style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
        >
          Flujo Documental
        </h1>
        <p
          className="text-sm text-gray-500 mt-1"
          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
        >
          Ciclo de vida de una factura en DocuFlow — haz clic en cada paso para ver el detalle
        </p>
      </div>

      {/* Diagrama principal */}
      <div
        className="rounded-2xl border border-gray-200 p-8 mb-6 overflow-x-auto"
        style={{
          background: 'white',
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="flex items-center gap-0 min-w-max mx-auto" style={{ width: 'fit-content' }}>
          {FLOW_NODES.map((node, index) => (
            <div key={node.id} className="flex items-center">
              {/* Nodo */}
              <button
                onClick={() => setSelected(selected === node.id ? null : node.id)}
                className="rounded-xl border-2 p-4 w-44 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  backgroundColor: selected === node.id ? node.bg : 'white',
                  borderColor: selected === node.id ? node.color : '#e5e7eb',
                  boxShadow: selected === node.id
                    ? `0 4px 20px ${node.color}30`
                    : '0 1px 3px rgba(0,0,0,0.07)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Icono + paso */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: node.color }}
                  >
                    <node.Icon className="w-4 h-4 text-white" />
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${node.color}18`, color: node.color }}
                  >
                    {node.step}
                  </span>
                </div>

                {/* Título */}
                <div
                  className="font-bold text-gray-800 text-sm mb-2 leading-tight"
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                >
                  {node.title}
                </div>

                {/* Rol */}
                <div
                  className="text-xs px-2 py-0.5 rounded-full inline-block font-medium truncate max-w-full"
                  style={{ backgroundColor: `${node.color}15`, color: node.color }}
                >
                  {node.role}
                </div>

                {/* Indicador seleccionado */}
                {selected === node.id && (
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: node.color }}>
                    <Info className="w-3 h-3" />
                    <span>Ver detalle</span>
                  </div>
                )}
              </button>

              {/* Flecha */}
              {index < FLOW_NODES.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className="w-6 h-px bg-gray-300" />
                  <ChevronRight className="w-4 h-4 text-gray-400 -ml-0.5" />
                </div>
              )}
            </div>
          ))}

          {/* Flecha final */}
          <div className="flex items-center mx-1">
            <div className="w-6 h-px bg-gray-300" />
            <ChevronRight className="w-4 h-4 text-gray-400 -ml-0.5" />
          </div>

          {/* Estado final */}
          <div
            className="rounded-xl border-2 border-dashed p-4 w-40"
            style={{ borderColor: '#10b981', backgroundColor: '#f0fdf4' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm bg-emerald-500">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                Fin
              </span>
            </div>
            <div
              className="font-bold text-gray-800 text-sm mb-2"
              style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
            >
              Pagada
            </div>
            <div className="text-xs px-2 py-0.5 rounded-full inline-block font-medium bg-emerald-100 text-emerald-700">
              Estado final
            </div>
          </div>
        </div>
      </div>

      {/* Panel de detalle */}
      {selectedNode && (
        <div
          className="bg-white rounded-2xl border-2 p-6 mb-6 transition-all"
          style={{ borderColor: selectedNode.color, boxShadow: `0 4px 24px ${selectedNode.color}20` }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: selectedNode.color }}
              >
                <selectedNode.Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2
                  className="font-bold text-gray-800 text-lg"
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                >
                  Paso {selectedNode.step}: {selectedNode.title}
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${selectedNode.color}15`, color: selectedNode.color }}
                >
                  {selectedNode.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p
            className="text-sm text-gray-600 mb-5 leading-relaxed"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          >
            {selectedNode.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Acciones */}
            <div>
              <h3
                className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              >
                Acciones en este paso
              </h3>
              <ul className="space-y-2">
                {selectedNode.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5"
                      style={{ backgroundColor: selectedNode.color }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Excepciones propias */}
            {selectedNode.exceptions && selectedNode.exceptions.length > 0 && (
              <div>
                <h3
                  className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                >
                  Rutas de excepción
                </h3>
                <ul className="space-y-2">
                  {selectedNode.exceptions.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <RotateCcw className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                        <span className="font-medium text-red-500">→ {e.target}:</span> {e.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excepciones globales */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2
          className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2"
          style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
        >
          <RotateCcw className="w-4 h-4 text-red-400" />
          Rutas de excepción (devoluciones y rechazos)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXCEPCIONES.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4"
            >
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: e.colorFrom }}
                >
                  {e.from}
                </span>
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: e.colorTo }}
                >
                  {e.to}
                </span>
              </div>
              <p
                className="text-xs text-gray-600 leading-relaxed"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                {e.motivo}
              </p>
            </div>
          ))}
        </div>

        {/* Leyenda */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
          <span
            className="text-xs text-gray-400"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          >
            Leyenda:
          </span>
          {FLOW_NODES.map(n => (
            <span key={n.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.color }} />
              {n.title}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Pagada (final)
          </span>
        </div>
      </div>
    </div>
  );
}
