import { useState, useEffect, useCallback } from 'react';
import {
  LogOut,
  PackagePlus,
  History,
  Send,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plus,
  Upload,
  Trash2,
  X,
  ChevronRight,
  CalendarDays,
  Banknote,
  FileImage,
  Info,
  BadgeCheck,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CategoriaGasto,
  GastoOut,
  PaqueteOut,
  PaqueteListItem,
  ArchivoGastoOut,
  listPaquetesGastos,
  getPaqueteGasto,
  createPaqueteGasto,
  enviarPaquete,
  agregarGasto,
  editarGasto,
  eliminarGasto,
  subirArchivoGasto,
  eliminarArchivoGasto,
  getDownloadUrlArchivoGasto,
  getCentrosCosto,
  getCentrosOperacion,
  getCuentasAuxiliares,
  reenviarGasto,
  CentroCosto,
  CentroOperacion,
  CuentaAuxiliar,
} from '../lib/api';

// ============================================================
// Tipos locales
// ============================================================

type GastoLocal = {
  localId: string;
  id?: string;
  fecha: string;
  noIdentificacion: string;
  pagadoA: string;
  concepto: string;
  noRecibo: string;
  valorPagado: string;
  centroCostoId: string;
  centroOperacionId: string;
  cuentaAuxiliarId: string;
  archivos: ArchivoGastoOut[];
  pendingFiles: { localKey: string; file: File; categoria: CategoriaGasto }[];
  isDirty: boolean;
  estado_gasto?: string;
  motivo_devolucion_gasto?: string | null;
};

type EstadoUI = 'Borrador' | 'En revision' | 'Devuelto' | 'Aprobado' | 'En tesoreria' | 'Pagado';

// ============================================================
// Helpers
// ============================================================

function formatSemanaLabel(semana: string): string {
  // "2026-W09" → "Semana 9"
  const match = semana.match(/W(\d+)/);
  if (!match) return semana;
  return `Semana ${parseInt(match[1], 10)}`;
}

function formatRango(ini: string, fin: string): string {
  // "2026-02-24" → "24 Feb - 02 Mar 2026"
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const parseDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  };
  const a = parseDate(ini);
  const b = parseDate(fin);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (a.y === b.y) {
    if (a.m === b.m) {
      return `${pad(a.d)} - ${pad(b.d)} ${meses[b.m - 1]} ${b.y}`;
    }
    return `${pad(a.d)} ${meses[a.m - 1]} - ${pad(b.d)} ${meses[b.m - 1]} ${b.y}`;
  }
  return `${pad(a.d)} ${meses[a.m - 1]} ${a.y} - ${pad(b.d)} ${meses[b.m - 1]} ${b.y}`;
}

function apiToUI(estado: string): EstadoUI {
  const map: Record<string, EstadoUI> = {
    borrador: 'Borrador',
    en_revision: 'En revision',
    devuelto: 'Devuelto',
    aprobado: 'Aprobado',
    en_tesoreria: 'En tesoreria',
    pagado: 'Pagado',
  };
  return map[estado] ?? 'Borrador';
}

function fmtMonto(n: number): string {
  return `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
}

function fmtFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function gastoOutToLocal(g: GastoOut, idx: number): GastoLocal {
  return {
    localId: g.id,
    id: g.id,
    fecha: g.fecha,
    noIdentificacion: g.no_identificacion,
    pagadoA: g.pagado_a,
    concepto: g.concepto,
    noRecibo: g.no_recibo ?? '',
    valorPagado: String(g.valor_pagado),
    centroCostoId: g.centro_costo_id ?? '',
    centroOperacionId: g.centro_operacion_id ?? '',
    cuentaAuxiliarId: g.cuenta_auxiliar_id ?? '',
    archivos: g.archivos,
    pendingFiles: [],
    isDirty: false,
    estado_gasto: g.estado_gasto,
    motivo_devolucion_gasto: g.motivo_devolucion_gasto,
  };
}

function filaVaciaLocal(): GastoLocal {
  return {
    localId: `local-${Date.now()}-${Math.random()}`,
    id: undefined,
    fecha: '',
    noIdentificacion: '',
    pagadoA: '',
    concepto: '',
    noRecibo: '',
    valorPagado: '',
    centroCostoId: '',
    centroOperacionId: '',
    cuentaAuxiliarId: '',
    archivos: [],
    pendingFiles: [],
    isDirty: false,
  };
}

// ============================================================
// Config de estados
// ============================================================

const estadoConfig: Record<
  EstadoUI,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  }
> = {
  Borrador:       { label: 'Borrador',            bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb', icon: FileText },
  'En revision':  { label: 'En revision',         bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', icon: Clock },
  Devuelto:       { label: 'Devuelto',            bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: RotateCcw },
  Aprobado:        { label: 'Aprobado',            bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', icon: CheckCircle2 },
  'En tesoreria':  { label: 'En Tesorería',        bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: Banknote },
  Pagado:          { label: 'Pagado / Legalizado', bg: '#f0fdf4', text: '#15803d', border: '#86efac', icon: BadgeCheck },
};

// ============================================================
// Badge de estado
// ============================================================

function EstadoBadge({ estado, size = 'sm' }: { estado: EstadoUI; size?: 'sm' | 'md' }) {
  const conf = estadoConfig[estado];
  const Icon = conf.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${size === 'md' ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1'}`}
      style={{
        backgroundColor: conf.bg,
        color: conf.text,
        borderColor: conf.border,
        fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
      }}
    >
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      {conf.label}
    </span>
  );
}

// ============================================================
// Pipeline visual
// ============================================================

function PipelineEstado({ estado }: { estado: EstadoUI }) {
  const pasos = [
    { key: 'Borrador',       label: 'Borrador' },
    { key: 'enviado',        label: 'Enviado' },
    { key: 'En revision',    label: 'Revision' },
    { key: 'Aprobado',       label: 'Aprobado' },
    { key: 'En tesoreria',   label: 'Tesorería' },
    { key: 'Pagado',         label: 'Pagado' },
  ];

  const indexActual =
    estado === 'Borrador'      ? 0 :
    estado === 'En revision'   ? 2 :
    estado === 'Devuelto'      ? 2 :
    estado === 'Aprobado'      ? 3 :
    estado === 'En tesoreria'  ? 4 : 5;

  return (
    <div className="flex items-center w-full">
      {pasos.map((paso, i) => {
        const activo     = i === indexActual && estado !== 'Devuelto';
        const completado = i < indexActual;
        const devuelto   = estado === 'Devuelto' && i === 2;

        return (
          <div key={paso.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 52 }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
                style={{
                  backgroundColor: devuelto ? '#fee2e2' : activo ? '#00829a' : completado ? '#bbf7d0' : '#f3f4f6',
                  color: devuelto ? '#dc2626' : activo ? '#fff' : completado ? '#15803d' : '#9ca3af',
                  border: activo ? '2px solid #00829a' : devuelto ? '2px solid #dc2626' : '2px solid transparent',
                }}
              >
                {devuelto
                  ? <RotateCcw className="w-3.5 h-3.5" />
                  : (completado || activo)
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : i + 1}
              </div>
              <span
                className="text-xs mt-1.5 text-center leading-tight"
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  color: devuelto ? '#dc2626' : activo ? '#00829a' : completado ? '#15803d' : '#9ca3af',
                  fontWeight: activo || devuelto ? 700 : 400,
                }}
              >
                {devuelto && paso.key === 'En revision' ? 'Devuelto' : paso.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 rounded-full"
                style={{ backgroundColor: i < indexActual ? '#bbf7d0' : '#e5e7eb' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// CardGasto — card de un gasto individual (reemplaza fila de tabla)
// ============================================================

interface CardGastoProps {
  fila: GastoLocal;
  idx: number;
  bloqueado: boolean;
  saving: boolean;
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  cuentasAuxiliares: CuentaAuxiliar[];
  esPropietario: boolean;
  onCampo: (localId: string, campo: keyof GastoLocal, valor: string) => void;
  onEliminarFila: (localId: string) => void;
  onAdjuntar: (localId: string, file: File, categoria: CategoriaGasto) => void;
  onQuitarArchivoGuardado: (localId: string, archivoId: string) => void;
  onQuitarArchivoPendiente: (localId: string, localKey: string) => void;
  onVerArchivo: (localId: string, archivoId: string) => void;
  onReenviarGasto: (localId: string) => void;
}

function CardGasto({
  fila,
  idx,
  bloqueado,
  saving,
  centrosCosto,
  centrosOperacion,
  cuentasAuxiliares,
  esPropietario,
  onCampo,
  onEliminarFila,
  onAdjuntar,
  onQuitarArchivoGuardado,
  onQuitarArchivoPendiente,
  onVerArchivo,
  onReenviarGasto,
}: CardGastoProps) {
  const inputCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all`;
  const inputReadCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-100 cursor-default`;
  const selectCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all`;

  const monto = parseFloat(fila.valorPagado.replace(/[^0-9.]/g, '')) || 0;
  const tituloGasto = fila.concepto || fila.pagadoA || `Gasto #${idx + 1}`;
  const esGastoDevuelto = fila.estado_gasto === 'devuelto';

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{
        boxShadow: esGastoDevuelto ? '0 2px 8px rgba(220,38,38,0.10)' : '0 2px 8px rgba(0,130,154,0.06)',
        borderLeft: esGastoDevuelto ? '4px solid #dc2626' : '4px solid #00829a',
      }}
    >
      {/* Header de la card */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50"
        style={{ background: 'linear-gradient(to right, rgba(0,130,154,0.04), transparent)' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
            style={{ background: 'linear-gradient(to bottom right, #00829a, #14aab8)' }}
          >
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-semibold text-gray-900 truncate text-sm"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              {tituloGasto}
            </p>
            {fila.fecha && (
              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                {fmtFecha(fila.fecha)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {esGastoDevuelto && (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
            >
              <RotateCcw className="w-3 h-3" />
              Devuelto
            </span>
          )}
          {monto > 0 && (
            <span
              className="text-base font-bold"
              style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
            >
              {fmtMonto(monto)}
            </span>
          )}
          {!bloqueado && (
            <button
              type="button"
              onClick={() => onEliminarFila(fila.localId)}
              disabled={saving}
              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo: campos en grid */}
      <div className="px-5 py-4 space-y-4">
        {/* Fila 1: Fecha, No Identificacion, Pagado A */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Fecha
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>{fila.fecha ? fmtFecha(fila.fecha) : '—'}</p>
            ) : (
              <input
                type="date"
                value={fila.fecha}
                onChange={(e) => onCampo(fila.localId, 'fecha', e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              No. Identificacion
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>{fila.noIdentificacion || '—'}</p>
            ) : (
              <input
                type="text"
                placeholder="NIT / CC"
                value={fila.noIdentificacion}
                onChange={(e) => onCampo(fila.localId, 'noIdentificacion', e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Pagado A
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>{fila.pagadoA || '—'}</p>
            ) : (
              <input
                type="text"
                placeholder="Nombre del proveedor"
                value={fila.pagadoA}
                onChange={(e) => onCampo(fila.localId, 'pagadoA', e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            )}
          </div>
        </div>

        {/* Fila 2: Concepto, No Recibo, Valor Pagado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Concepto
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>{fila.concepto || '—'}</p>
            ) : (
              <input
                type="text"
                placeholder="Descripcion del gasto"
                value={fila.concepto}
                onChange={(e) => onCampo(fila.localId, 'concepto', e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              No. Recibo
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>{fila.noRecibo || '—'}</p>
            ) : (
              <input
                type="text"
                placeholder="Numero de recibo"
                value={fila.noRecibo}
                onChange={(e) => onCampo(fila.localId, 'noRecibo', e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Valor Pagado
            </label>
            {bloqueado ? (
              <p className={`${inputReadCls} font-semibold`} style={{ color: '#00829a' }}>
                {monto > 0 ? fmtMonto(monto) : '—'}
              </p>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={fila.valorPagado}
                  onChange={(e) => onCampo(fila.localId, 'valorPagado', e.target.value)}
                  className={`${inputCls} pl-7`}
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Fila 3: Centro Costo, Centro Operacion, Cuenta Contable */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Centro de Costos
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>
                {centrosCosto.find(c => c.id === fila.centroCostoId)?.nombre || '—'}
              </p>
            ) : (
              <select
                value={fila.centroCostoId}
                onChange={(e) => {
                  onCampo(fila.localId, 'centroCostoId', e.target.value);
                  onCampo(fila.localId, 'centroOperacionId', '');
                }}
                className={selectCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                <option value="">-- Seleccionar --</option>
                {centrosCosto.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Centro de Operacion
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>
                {centrosOperacion.find(c => c.id === fila.centroOperacionId)?.nombre || '—'}
              </p>
            ) : (
              <select
                value={fila.centroOperacionId}
                onChange={(e) => onCampo(fila.localId, 'centroOperacionId', e.target.value)}
                disabled={!fila.centroCostoId}
                className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                <option value="">-- Seleccionar --</option>
                {centrosOperacion
                  .filter(c => !fila.centroCostoId || c.centro_costo_id === fila.centroCostoId)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Cuenta Contable
            </label>
            {bloqueado ? (
              <p className={inputReadCls}>
                {cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)
                  ? `${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.codigo} - ${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.descripcion}`
                  : '—'}
              </p>
            ) : (
              <select
                value={fila.cuentaAuxiliarId}
                onChange={(e) => onCampo(fila.localId, 'cuentaAuxiliarId', e.target.value)}
                className={selectCls}
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                <option value="">-- Seleccionar --</option>
                {cuentasAuxiliares.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer: Soportes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Soportes adjuntos
          </label>
          <div className="flex flex-wrap gap-2">
            {/* Archivos guardados */}
            {fila.archivos.map((arch) => (
              <div key={arch.id} className="flex items-center gap-1.5 rounded-lg overflow-hidden border"
                style={{ borderColor: '#bae6fd', backgroundColor: '#e0f5f7' }}>
                <button
                  type="button"
                  onClick={() => onVerArchivo(fila.localId, arch.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:opacity-80 transition-opacity min-w-0"
                  title={arch.filename}
                >
                  {arch.filename.toLowerCase().endsWith('.pdf')
                    ? <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />
                    : <FileImage className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />}
                  <span className="text-xs font-medium truncate max-w-[120px]"
                    style={{ color: '#00829a', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    {arch.filename}
                  </span>
                </button>
                {!bloqueado && (
                  <button
                    type="button"
                    onClick={() => onQuitarArchivoGuardado(fila.localId, arch.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Archivos pendientes */}
            {fila.pendingFiles.map((pf) => (
              <div key={pf.localKey} className="flex items-center gap-1.5 rounded-lg overflow-hidden border"
                style={{ borderColor: '#fde68a', backgroundColor: '#fef3c7' }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 min-w-0" title={pf.file.name}>
                  {pf.file.name.toLowerCase().endsWith('.pdf')
                    ? <FileText className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    : <FileImage className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
                  <span className="text-xs font-medium truncate max-w-[120px] text-amber-700"
                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    {pf.file.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onQuitarArchivoPendiente(fila.localId, pf.localKey)}
                  className="p-1.5 text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Boton adjuntar */}
            {!bloqueado && (fila.archivos.length + fila.pendingFiles.length) < 2 && (
              <label
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer border border-dashed border-gray-300 hover:border-teal-400 hover:bg-teal-50 transition-all text-xs font-semibold text-gray-500 hover:text-teal-600"
                style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', position: 'relative' }}
              >
                <Upload className="w-3.5 h-3.5" />
                Adjuntar soporte
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAdjuntar(fila.localId, f, 'Otro');
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            {/* Sin soporte en vista bloqueada */}
            {bloqueado && fila.archivos.length === 0 && (
              <span className="text-xs text-gray-300 italic py-1.5"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                Sin soporte adjunto
              </span>
            )}
          </div>
        </div>

        {/* Alerta de gasto devuelto con motivo y botón reenviar */}
        {esGastoDevuelto && esPropietario && (
          <div className="mx-5 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-700 mb-1"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Devuelto por Facturación:
            </p>
            {fila.motivo_devolucion_gasto && (
              <p className="text-xs text-red-600 mb-2"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                {fila.motivo_devolucion_gasto}
              </p>
            )}
            <button
              type="button"
              onClick={() => onReenviarGasto(fila.localId)}
              disabled={saving}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              Marcar como corregido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TablaGastos — lista de cards de gastos
// ============================================================

interface TablaGastosProps {
  filas: GastoLocal[];
  bloqueado: boolean;
  saving: boolean;
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  cuentasAuxiliares: CuentaAuxiliar[];
  esPropietario: boolean;
  onCampo: (localId: string, campo: keyof GastoLocal, valor: string) => void;
  onAgregarFila: () => void;
  onEliminarFila: (localId: string) => void;
  onAdjuntar: (localId: string, file: File, categoria: CategoriaGasto) => void;
  onQuitarArchivoGuardado: (localId: string, archivoId: string) => void;
  onQuitarArchivoPendiente: (localId: string, localKey: string) => void;
  onVerArchivo: (localId: string, archivoId: string) => void;
  onReenviarGasto: (localId: string) => void;
}

function TablaGastos({
  filas,
  bloqueado,
  saving,
  centrosCosto,
  centrosOperacion,
  cuentasAuxiliares,
  esPropietario,
  onCampo,
  onAgregarFila,
  onEliminarFila,
  onAdjuntar,
  onQuitarArchivoGuardado,
  onQuitarArchivoPendiente,
  onVerArchivo,
  onReenviarGasto,
}: TablaGastosProps) {
  const totalCalculado = filas.reduce(
    (acc, f) => acc + (parseFloat(f.valorPagado.replace(/[^0-9.]/g, '')) || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header de seccion */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-base font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
          >
            Detalle de gastos
          </h3>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {filas.length} gasto{filas.length !== 1 ? 's' : ''} registrado{filas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!bloqueado && (
          <button
            type="button"
            onClick={onAgregarFila}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'linear-gradient(to right, #00829a, #14aab8)',
              color: '#fff',
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              boxShadow: '0 2px 8px rgba(0,130,154,0.25)',
            }}
          >
            <PlusCircle className="w-4 h-4" />
            Agregar gasto
          </button>
        )}
      </div>

      {/* Cards de gastos */}
      <div className="space-y-3">
        {filas.map((fila, idx) => (
          <CardGasto
            key={fila.localId}
            fila={fila}
            idx={idx}
            bloqueado={bloqueado}
            saving={saving}
            centrosCosto={centrosCosto}
            centrosOperacion={centrosOperacion}
            cuentasAuxiliares={cuentasAuxiliares}
            esPropietario={esPropietario}
            onCampo={onCampo}
            onEliminarFila={onEliminarFila}
            onAdjuntar={onAdjuntar}
            onQuitarArchivoGuardado={onQuitarArchivoGuardado}
            onQuitarArchivoPendiente={onQuitarArchivoPendiente}
            onVerArchivo={onVerArchivo}
            onReenviarGasto={onReenviarGasto}
          />
        ))}

        {filas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Sin gastos registrados
            </p>
            {!bloqueado && (
              <button
                type="button"
                onClick={onAgregarFila}
                className="mt-3 text-sm font-semibold"
                style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                + Agregar el primer gasto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Total */}
      {filas.length > 0 && (
        <div
          className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: 'linear-gradient(to right, rgba(0,130,154,0.08), rgba(20,170,184,0.05))' }}
        >
          <span
            className="text-sm font-semibold text-gray-600 uppercase tracking-wide"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            Total de gastos
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
          >
            $ {totalCalculado.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DetallePaquete
// ============================================================

function DetallePaquete({
  paqueteId,
  onCerrar,
}: {
  paqueteId: string;
  onCerrar: () => void;
}) {
  const { user } = useAuth();
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [gastos, setGastos] = useState<GastoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);

  useEffect(() => {
    Promise.all([
      getCentrosCosto(),
      getCentrosOperacion(),
      getCuentasAuxiliares(),
    ]).then(([cc, co, ca]) => {
      setCentrosCosto(cc);
      setCentrosOperacion(co);
      setCuentasAuxiliares(ca);
    }).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPaqueteGasto(paqueteId);
      setPaquete(p);
      setGastos(
        [...p.gastos]
          .sort((a, b) => a.orden - b.orden)
          .map((g, idx) => gastoOutToLocal(g, idx))
      );
    } catch {
      toast.error('Error al cargar el paquete');
    } finally {
      setLoading(false);
    }
  }, [paqueteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading || !paquete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
        <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          Cargando paquete...
        </p>
      </div>
    );
  }

  const estadoUI = apiToUI(paquete.estado);
  const bloqueado = !['borrador', 'devuelto'].includes(paquete.estado);
  const esPropietario = user?.id === paquete.tecnico?.id;

  // Comentario de devolución más reciente
  const comentarioDevolucion = paquete.comentarios
    .filter((c) => c.tipo === 'devolucion')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // ---- Handlers de tabla ----

  const handleCampo = (localId: string, campo: keyof GastoLocal, valor: string) => {
    if (bloqueado) return;
    setGastos((prev) =>
      prev.map((f) =>
        f.localId === localId ? { ...f, [campo]: valor, isDirty: true } : f
      )
    );
  };

  const handleAgregarFila = () => {
    if (bloqueado) return;
    setGastos((prev) => [...prev, filaVaciaLocal()]);
  };

  const handleEliminarFila = async (localId: string) => {
    if (bloqueado) return;
    const fila = gastos.find((f) => f.localId === localId);
    if (!fila) return;

    // Si ya existe en BD, confirmar y eliminar en el backend
    if (fila.id) {
      const confirmar = window.confirm(
        '¿Eliminar este gasto? Esta accion no se puede deshacer.'
      );
      if (!confirmar) return;
      try {
        setSaving(true);
        await eliminarGasto(paqueteId, fila.id);
        toast.success('Gasto eliminado');
      } catch {
        toast.error('Error al eliminar el gasto');
        return;
      } finally {
        setSaving(false);
      }
    }

    setGastos((prev) => prev.filter((f) => f.localId !== localId));
  };

  const handleAdjuntar = (localId: string, file: File, categoria: CategoriaGasto) => {
    setGastos((prev) =>
      prev.map((f) => {
        if (f.localId !== localId) return f;
        if (f.archivos.length + f.pendingFiles.length >= 2) return f;
        return {
          ...f,
          pendingFiles: [...f.pendingFiles, { localKey: `${Date.now()}-${Math.random()}`, file, categoria }],
          isDirty: true,
        };
      })
    );
  };

  const handleQuitarArchivoGuardado = async (localId: string, archivoId: string) => {
    const fila = gastos.find((f) => f.localId === localId);
    if (!fila?.id) return;
    try {
      setSaving(true);
      await eliminarArchivoGasto(paqueteId, fila.id, archivoId);
      setGastos((prev) =>
        prev.map((f) =>
          f.localId === localId
            ? { ...f, archivos: f.archivos.filter((a) => a.id !== archivoId) }
            : f
        )
      );
      toast.success('Soporte eliminado');
    } catch {
      toast.error('Error al eliminar el soporte');
    } finally {
      setSaving(false);
    }
  };

  const handleQuitarArchivoPendiente = (localId: string, localKey: string) => {
    setGastos((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, pendingFiles: f.pendingFiles.filter((pf) => pf.localKey !== localKey) }
          : f
      )
    );
  };

  const handleVerArchivo = async (localId: string, archivoId: string) => {
    const fila = gastos.find((f) => f.localId === localId);
    if (!fila?.id) return;
    try {
      const { download_url } = await getDownloadUrlArchivoGasto(paqueteId, fila.id, archivoId);
      window.open(download_url, '_blank');
    } catch {
      toast.error('Error al obtener el archivo');
    }
  };

  const handleReenviarGasto = async (localId: string) => {
    const fila = gastos.find((f) => f.localId === localId);
    if (!fila?.id) return;
    try {
      setSaving(true);
      await reenviarGasto(paqueteId, fila.id);
      // Verificar si era el último gasto devuelto
      const otrosDevueltos = gastos.filter(
        (f) => f.localId !== localId && f.estado_gasto === 'devuelto'
      );
      if (otrosDevueltos.length === 0) {
        toast.success('¡Todos los gastos han sido corregidos! Facturación puede proceder con el envío a Tesorería.');
      } else {
        toast.success('Gasto marcado como corregido.');
      }
      await cargar();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al reenviar el gasto.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---- Persistir cambios ----

  const persistirCambios = async (): Promise<void> => {
    for (const fila of gastos) {
      const esNueva = !fila.id;
      const tieneContenido =
        fila.fecha || fila.noIdentificacion || fila.pagadoA || fila.concepto || fila.valorPagado;

      if (esNueva && !tieneContenido) continue;

      let gastoId = fila.id;

      if (esNueva && tieneContenido) {
        // Crear nuevo gasto
        const creado = await agregarGasto(paqueteId, {
          fecha: fila.fecha || new Date().toISOString().slice(0, 10),
          no_identificacion: fila.noIdentificacion,
          pagado_a: fila.pagadoA,
          concepto: fila.concepto,
          no_recibo: fila.noRecibo || undefined,
          valor_pagado: parseFloat(fila.valorPagado) || 0,
          centro_costo_id: fila.centroCostoId || undefined,
          centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });
        gastoId = creado.id;
      } else if (!esNueva && fila.isDirty && gastoId) {
        // Editar gasto existente
        await editarGasto(paqueteId, gastoId, {
          fecha: fila.fecha || undefined,
          no_identificacion: fila.noIdentificacion || undefined,
          pagado_a: fila.pagadoA || undefined,
          concepto: fila.concepto || undefined,
          no_recibo: fila.noRecibo || undefined,
          valor_pagado: parseFloat(fila.valorPagado) || undefined,
          centro_costo_id: fila.centroCostoId || undefined,
          centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });
      }

      // Subir archivos pendientes
      for (const pf of fila.pendingFiles) {
        if (gastoId) {
          await subirArchivoGasto(paqueteId, gastoId, pf.categoria, pf.file);
        }
      }
    }
  };

  const handleGuardarBorrador = async () => {
    setSaving(true);
    try {
      await persistirCambios();
      toast.success('Borrador guardado correctamente');
      await cargar();
    } catch {
      toast.error('Error al guardar el borrador');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviar = async () => {
    const confirmar = window.confirm(
      '¿Enviar el paquete para revision? Una vez enviado no podras modificarlo hasta recibir respuesta.'
    );
    if (!confirmar) return;
    setSaving(true);
    try {
      await persistirCambios();
      await enviarPaquete(paqueteId);
      toast.success('Paquete enviado al responsable de area para revision');
      onCerrar();
    } catch {
      toast.error('Error al enviar el paquete');
      setSaving(false);
    }
  };

  const esBorrador = paquete.estado === 'borrador';
  const esDevuelto = paquete.estado === 'devuelto';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      {/* Cabecera del detalle */}
      <div
        className="rounded-2xl p-5 border border-gray-100"
        style={{ background: 'linear-gradient(135deg, #fff 60%, rgba(0,130,154,0.04) 100%)', boxShadow: '0 2px 12px rgba(0,130,154,0.08)' }}
      >
        {/* Fila superior: Volver + acciones */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={onCerrar}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Volver a mis paquetes
          </button>

          {/* Botones de accion */}
          <div className="flex items-center gap-2">
            {(esBorrador || esDevuelto) ? (
              <>
                {esBorrador && (
                  <button
                    onClick={handleGuardarBorrador}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar borrador
                  </button>
                )}
                <button
                  onClick={handleEnviar}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(to right, #00829a, #14aab8)',
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    boxShadow: '0 4px 12px rgba(0,130,154,0.30)',
                  }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {esDevuelto ? 'Reenviar corregido' : 'Enviar para revision'}
                </button>
              </>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed opacity-50"
                style={{ backgroundColor: '#e5e7eb', color: '#6b7280', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                title="Ya enviado, no se puede editar"
              >
                <Send className="w-4 h-4" />
                Enviado
              </div>
            )}
          </div>
        </div>

        {/* Info del paquete */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2
                className="text-xl font-bold"
                style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              >
                {formatSemanaLabel(paquete.semana)}
              </h2>
              <EstadoBadge estado={estadoUI} size="md" />
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-gray-500"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                <CalendarDays className="w-4 h-4 text-gray-400" />
                {formatRango(paquete.fecha_inicio, paquete.fecha_fin)}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                <Banknote className="w-4 h-4" />
                {fmtMonto(paquete.monto_total)}
              </span>
              {paquete.fecha_envio && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400"
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  <Send className="w-3.5 h-3.5" />
                  Enviado {fmtFecha(paquete.fecha_envio.slice(0, 10))}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Flujo de legalizacion
          </p>
          <PipelineEstado estado={estadoUI} />
        </div>
      </div>

      {/* Alerta devuelto */}
      {esDevuelto && comentarioDevolucion && (
        <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700 mb-1"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Observacion del administrador
            </p>
            <p className="text-sm text-red-600"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {comentarioDevolucion.texto}
            </p>
          </div>
        </div>
      )}

      {/* Nota estado enviado/aprobado/pagado */}
      {['En revision', 'Aprobado', 'Pagado'].includes(estadoUI) && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-600"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {estadoUI === 'En revision' &&
              'Tu paquete esta siendo revisado. Los datos no pueden modificarse hasta recibir respuesta.'}
            {estadoUI === 'Aprobado' &&
              'Tu legalizacion fue aprobada. El pago esta siendo procesado.'}
            {estadoUI === 'Pagado' &&
              'Este paquete fue pagado y legalizado exitosamente.'}
          </p>
        </div>
      )}

      {/* Lista de gastos */}
      <div
        className="bg-white rounded-2xl border border-gray-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <TablaGastos
          filas={gastos}
          bloqueado={bloqueado}
          saving={saving}
          centrosCosto={centrosCosto}
          centrosOperacion={centrosOperacion}
          cuentasAuxiliares={cuentasAuxiliares}
          esPropietario={esPropietario}
          onCampo={handleCampo}
          onAgregarFila={handleAgregarFila}
          onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar}
          onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente}
          onVerArchivo={handleVerArchivo}
          onReenviarGasto={handleReenviarGasto}
        />
      </div>

      {/* Boton enviar flotante en mobile (extra) */}
      {(esBorrador || esDevuelto) && (
        <div className="pb-4">
          <button
            onClick={handleEnviar}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'linear-gradient(to right, #00829a, #14aab8)',
              fontFamily: 'Neutra Text Bold, Montserrat, sans-serif',
              boxShadow: '0 6px 20px rgba(0,130,154,0.35)',
            }}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {esDevuelto ? 'Reenviar paquete corregido' : 'Enviar paquete para revision'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NuevoPaqueteForm
// ============================================================

function NuevoPaqueteForm({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: (id: string) => void;
}) {
  const [semana, setSemana] = useState('');
  const [filas, setFilas] = useState<GastoLocal[]>([filaVaciaLocal()]);
  const [saving, setSaving] = useState(false);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);

  useEffect(() => {
    Promise.all([
      getCentrosCosto(),
      getCentrosOperacion(),
      getCuentasAuxiliares(),
    ]).then(([cc, co, ca]) => {
      setCentrosCosto(cc);
      setCentrosOperacion(co);
      setCuentasAuxiliares(ca);
    }).catch(() => {});
  }, []);

  const handleCampo = (localId: string, campo: keyof GastoLocal, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.localId === localId ? { ...f, [campo]: valor } : f))
    );
  };

  const handleAgregarFila = () => {
    setFilas((prev) => [...prev, filaVaciaLocal()]);
  };

  const handleEliminarFila = (localId: string) => {
    if (filas.length === 1) return;
    setFilas((prev) => prev.filter((f) => f.localId !== localId));
  };

  const handleAdjuntar = (localId: string, file: File, categoria: CategoriaGasto) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.localId !== localId) return f;
        if (f.archivos.length + f.pendingFiles.length >= 2) return f;
        return {
          ...f,
          pendingFiles: [...f.pendingFiles, { localKey: `${Date.now()}-${Math.random()}`, file, categoria }],
        };
      })
    );
  };

  const handleQuitarArchivoGuardado = (localId: string, archivoId: string) => {
    // En nuevo paquete no hay archivos guardados, pero por consistencia:
    setFilas((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, archivos: f.archivos.filter((a) => a.id !== archivoId) }
          : f
      )
    );
  };

  const handleQuitarArchivoPendiente = (localId: string, localKey: string) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, pendingFiles: f.pendingFiles.filter((pf) => pf.localKey !== localKey) }
          : f
      )
    );
  };

  const handleGuardar = async () => {
    if (!semana) {
      toast.error('Selecciona la semana de gastos');
      return;
    }

    const filasValidas = filas.filter(
      (f) => f.fecha || f.noIdentificacion || f.pagadoA || f.concepto || f.valorPagado
    );
    if (filasValidas.length === 0) {
      toast.error('Agrega al menos un gasto con datos');
      return;
    }

    setSaving(true);
    try {
      // Crear el paquete — el input type=week retorna "2026-W09" nativamente
      const paquete = await createPaqueteGasto(semana);

      // Agregar gastos
      for (const fila of filasValidas) {
        const creado = await agregarGasto(paquete.id, {
          fecha: fila.fecha || new Date().toISOString().slice(0, 10),
          no_identificacion: fila.noIdentificacion,
          pagado_a: fila.pagadoA,
          concepto: fila.concepto,
          no_recibo: fila.noRecibo || undefined,
          valor_pagado: parseFloat(fila.valorPagado) || 0,
          centro_costo_id: fila.centroCostoId || undefined,
          centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });

        // Subir archivos pendientes si existen
        for (const pf of fila.pendingFiles) {
          await subirArchivoGasto(paquete.id, creado.id, pf.categoria, pf.file);
        }
      }

      toast.success('Paquete creado correctamente');
      onCreado(paquete.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear el paquete';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const totalCalculado = filas.reduce(
    (acc, f) => acc + (parseFloat(f.valorPagado.replace(/[^0-9.]/g, '')) || 0),
    0
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-xl font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
          >
            Nuevo paquete semanal
          </h3>
          <p className="text-sm text-gray-400 mt-0.5"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Agrupa tus gastos de la semana y adjunta los soportes
          </p>
        </div>
        <button
          onClick={onCerrar}
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Selector de semana */}
      <div
        className="bg-white rounded-2xl border border-gray-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <label
          className="block text-sm font-bold text-gray-700 mb-2"
          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          Semana de gastos <span className="text-red-500">*</span>
        </label>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <input
              type="week"
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-teal-400 transition-colors"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            />
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-1 min-w-[200px]">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              El envio formal debe realizarse antes del <strong>jueves</strong> de cada semana.
            </p>
          </div>
        </div>
      </div>

      {/* Gastos */}
      <div
        className="bg-white rounded-2xl border border-gray-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <TablaGastos
          filas={filas}
          bloqueado={false}
          saving={saving}
          centrosCosto={centrosCosto}
          centrosOperacion={centrosOperacion}
          cuentasAuxiliares={cuentasAuxiliares}
          esPropietario={true}
          onCampo={handleCampo}
          onAgregarFila={handleAgregarFila}
          onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar}
          onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente}
          onVerArchivo={() => {}}
          onReenviarGasto={() => {}}
        />

        {totalCalculado > 0 && (
          <p className="text-xs text-gray-400 mt-3"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Monto total calculado:{' '}
            <strong style={{ color: '#00829a' }}>
              ${totalCalculado.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </strong>
          </p>
        )}
      </div>

      {/* Nota borrador */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-600"
          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          El paquete se guardara como <strong>Borrador</strong> hasta que lo envies. Solo tu puedes verlo en ese estado.
        </p>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={onCerrar}
          disabled={saving}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'linear-gradient(to right, #00829a, #14aab8)',
            fontFamily: 'Neutra Text Bold, Montserrat, sans-serif',
            boxShadow: '0 4px 12px rgba(0,130,154,0.30)',
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear paquete
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PaqueteCard — card reutilizable para lista y historial
// ============================================================

function PaqueteCard({
  p,
  onClick,
}: {
  p: PaqueteListItem;
  onClick: () => void;
}) {
  const estadoUI = apiToUI(p.estado);
  const conf = estadoConfig[estadoUI];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: `4px solid ${conf.border}` }}
    >
      <div className="p-5">
        {/* Header card */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-base font-bold leading-tight"
                style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              >
                {formatSemanaLabel(p.semana)}
              </p>
              {p.folio && (
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md border"
                  style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                >
                  {p.folio}
                </span>
              )}
            </div>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            >
              {formatRango(p.fecha_inicio, p.fecha_fin)}
            </p>
          </div>
          <EstadoBadge estado={estadoUI} />
        </div>

        {/* Metricas */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            <Banknote className="w-4 h-4" />
            {fmtMonto(p.monto_total)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            <FileText className="w-3.5 h-3.5" />
            {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
          </span>
          {p.fecha_envio && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              <CalendarDays className="w-3.5 h-3.5" />
              Enviado {fmtFecha(p.fecha_envio.slice(0, 10))}
            </span>
          )}
        </div>

        {/* Alerta de devolucion de paquete completo */}
        {p.estado === 'devuelto' && p.comentario_devolucion && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <p
              className="text-xs text-red-600 line-clamp-2"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            >
              {p.comentario_devolucion}
            </p>
          </div>
        )}

        {/* Alerta de gastos individuales devueltos por Facturación */}
        {p.tiene_gastos_devueltos && p.estado !== 'devuelto' && (
          <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p
              className="text-xs text-orange-700 font-semibold"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              Facturación devolvió uno o más gastos — revisa y corrige para completar el pago
            </p>
          </div>
        )}

        {/* Flecha */}
        <div className="flex justify-end mt-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${conf.bg}` }}>
            <ChevronRight className="w-4 h-4" style={{ color: conf.text }} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// Pagina principal
// ============================================================

type Vista = 'lista' | 'historial' | 'nuevo' | 'detalle';

export function TecnicoMantenimientoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista>('lista');
  const [paqueteActivo, setPaqueteActivo] = useState<string | null>(null);
  const [paquetes, setPaquetes] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarLista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPaquetesGastos({ limit: 200 });
      setPaquetes(res.paquetes);
    } catch {
      toast.error('Error al cargar los paquetes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vista === 'lista' || vista === 'historial') {
      cargarLista();
    }
  }, [vista, cargarLista]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const irALista = () => {
    setVista('lista');
    setPaqueteActivo(null);
  };

  // Paquetes que necesitan atención: borrador, devuelto, o con gastos devueltos por Facturación
  const conGastosDevueltos = paquetes.filter(
    (p) => p.tiene_gastos_devueltos && !['borrador', 'devuelto'].includes(p.estado)
  );
  const activos = paquetes.filter((p) =>
    ['borrador', 'devuelto'].includes(p.estado)
  );
  // Historial: el resto (sin contar los que tienen gastos devueltos — ya aparecen arriba)
  const historial = paquetes.filter((p) =>
    !['borrador', 'devuelto'].includes(p.estado) && !p.tiene_gastos_devueltos
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header principal con gradiente de marca */}
      <header
        className="shrink-0"
        style={{ background: 'linear-gradient(to right, #00829a, #14aab8)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo / Nombre */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1
                className="text-white font-bold leading-tight text-base"
                style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              >
                Legalizacion de Gastos
              </h1>
              <p
                className="text-white/70 text-xs"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                Modulo de Tecnico
              </p>
            </div>
          </div>

          {/* Usuario + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white/90 border-2 border-white/30"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
              >
                {user?.nombre?.charAt(0)?.toUpperCase() ?? 'T'}
              </div>
              <div className="text-right">
                <p
                  className="text-white text-xs font-semibold leading-tight"
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  {user?.nombre ?? 'Tecnico'}
                </p>
                <p
                  className="text-white/60 text-xs leading-tight"
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                >
                  {user?.area?.nombre ?? 'Campo'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
              title="Cerrar sesion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs de navegacion */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-end gap-1">
            <button
              onClick={irALista}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all ${
                vista === 'lista' || vista === 'detalle' || vista === 'nuevo'
                  ? 'bg-gray-50 text-gray-900'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              <PackagePlus className="w-4 h-4 shrink-0" />
              Mis paquetes
              {activos.length > 0 && (
                <span
                  className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white"
                  style={{ backgroundColor: '#00829a' }}
                >
                  {activos.length}
                </span>
              )}
              {conGastosDevueltos.length > 0 && (
                <span
                  className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white"
                  style={{ backgroundColor: '#f97316' }}
                  title="Gastos devueltos por Facturación"
                >
                  {conGastosDevueltos.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setVista('historial'); setPaqueteActivo(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all ${
                vista === 'historial'
                  ? 'bg-gray-50 text-gray-900'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              <History className="w-4 h-4 shrink-0" />
              Historial
              {historial.length > 0 && (
                <span
                  className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white"
                  style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                >
                  {historial.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Sub-header: titulo de vista */}
      {(vista === 'lista' || vista === 'historial') && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              >
                {vista === 'historial' ? 'Historial de envios' : 'Mis Paquetes de Gastos'}
              </h2>
              <p
                className="text-xs text-gray-400 mt-0.5"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                {vista === 'historial'
                  ? 'Paquetes enviados para revision o aprobados'
                  : 'Organiza y envia tus legalizaciones semanales'}
              </p>
            </div>
            <button
              onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(to right, #00829a, #14aab8)',
                fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                boxShadow: '0 3px 10px rgba(0,130,154,0.25)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo paquete</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>
      )}

      {/* Cuerpo principal */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

          {/* Vista: nuevo paquete */}
          {vista === 'nuevo' && (
            <NuevoPaqueteForm
              onCerrar={irALista}
              onCreado={(id) => {
                setPaqueteActivo(id);
                setVista('detalle');
              }}
            />
          )}

          {/* Vista: detalle de paquete */}
          {vista === 'detalle' && paqueteActivo && (
            <DetallePaquete
              paqueteId={paqueteActivo}
              onCerrar={irALista}
            />
          )}

          {/* Vista: historial */}
          {vista === 'historial' && (
            <div className="max-w-2xl mx-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
                  <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    Cargando historial...
                  </p>
                </div>
              )}
              {!loading && historial.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <History className="w-10 h-10 text-gray-300" />
                  </div>
                  <p
                    className="text-base font-semibold text-gray-500 mb-1"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    Sin paquetes enviados
                  </p>
                  <p
                    className="text-sm text-gray-400"
                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                  >
                    Cuando envies un paquete para revision aparecera aqui.
                  </p>
                </div>
              )}
              {!loading && historial.length > 0 && (
                <div className="space-y-3">
                  {historial.map((p) => (
                    <PaqueteCard
                      key={p.id}
                      p={p}
                      onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vista: lista de paquetes activos */}
          {vista === 'lista' && (
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
                  <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                    Cargando paquetes...
                  </p>
                </div>
              )}

              {!loading && (
                <>
                  {/* Paquetes con gastos devueltos por Facturación — requieren atención */}
                  {conGastosDevueltos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <p
                          className="text-xs font-bold uppercase tracking-wider text-orange-600"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        >
                          Requiere tu atención ({conGastosDevueltos.length})
                        </p>
                      </div>
                      <div
                        className="rounded-xl border px-3 py-2 mb-3 flex items-start gap-2"
                        style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}
                      >
                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <p
                          className="text-xs text-orange-700"
                          style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                        >
                          Facturación devolvió gastos en los siguientes paquetes. Ingresa al paquete, corrige los gastos marcados y usa el botón <strong>"Marcar como corregido"</strong> para que Facturación pueda procesar el pago.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {conGastosDevueltos.map((p) => (
                          <PaqueteCard
                            key={p.id}
                            p={p}
                            onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paquetes activos */}
                  {activos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00829a' }} />
                        <p
                          className="text-xs font-bold text-gray-500 uppercase tracking-wider"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        >
                          Legalizaciones activas
                        </p>
                      </div>
                      <div className="space-y-3">
                        {activos.map((p) => (
                          <PaqueteCard
                            key={p.id}
                            p={p}
                            onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial en lista */}
                  {historial.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <p
                          className="text-xs font-bold text-gray-500 uppercase tracking-wider"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        >
                          Historial de envios
                        </p>
                      </div>
                      <div className="space-y-3">
                        {historial.map((p) => (
                          <PaqueteCard
                            key={p.id}
                            p={p}
                            onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado vacío total */}
                  {activos.length === 0 && historial.length === 0 && conGastosDevueltos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center mb-5 border border-teal-100">
                        <PackagePlus className="w-12 h-12" style={{ color: '#14aab8', opacity: 0.6 }} />
                      </div>
                      <p
                        className="text-lg font-bold text-gray-700 mb-1"
                        style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                      >
                        Sin paquetes todavia
                      </p>
                      <p
                        className="text-sm text-gray-400 mb-6 max-w-xs"
                        style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                      >
                        Crea tu primer paquete semanal de gastos para comenzar tu legalizacion.
                      </p>
                      <button
                        onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white"
                        style={{
                          background: 'linear-gradient(to right, #00829a, #14aab8)',
                          fontFamily: 'Neutra Text Bold, Montserrat, sans-serif',
                          boxShadow: '0 4px 15px rgba(0,130,154,0.30)',
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Crear mi primer paquete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
