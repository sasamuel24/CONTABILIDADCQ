import { useState, useEffect, useCallback } from 'react';
import {
  LogOut,
  PackagePlus,
  History,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Banknote,
  BadgeCheck,
  Loader2,
  X,
  Info,
  Send,
  Upload,
  Trash2,
  FileImage,
  ChevronRight,
  CalendarDays,
  PlusCircle,
  Scan,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CategoriaGasto,
  GastoOut,
  PaqueteOut,
  PaqueteListItem,
  ArchivoGastoOut,
  AprobadorGerencia,
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
  getAprobadoresActivos,
  reenviarGasto,
  checkBuzon,
  extraerDatosImagen,
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
  const match = semana.match(/W(\d+)/);
  if (!match) return semana;
  return `Semana ${parseInt(match[1], 10)}`;
}

function formatRango(ini: string, fin: string): string {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const parseDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  };
  const a = parseDate(ini);
  const b = parseDate(fin);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (a.y === b.y) {
    if (a.m === b.m) return `${pad(a.d)} - ${pad(b.d)} ${meses[b.m - 1]} ${b.y}`;
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

function gastoOutToLocal(g: GastoOut): GastoLocal {
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

const estadoConfig: Record<EstadoUI, { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }> = {
  Borrador:       { label: 'Borrador',            bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb', icon: FileText },
  'En revision':  { label: 'Esperando gerente',   bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: Clock },
  Devuelto:       { label: 'Devuelto',            bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: RotateCcw },
  Aprobado:       { label: 'Aprobado',            bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', icon: CheckCircle2 },
  'En tesoreria': { label: 'En Tesorería',        bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: Banknote },
  Pagado:         { label: 'Pagado / Legalizado', bg: '#f0fdf4', text: '#15803d', border: '#86efac', icon: BadgeCheck },
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
      style={{ backgroundColor: conf.bg, color: conf.text, borderColor: conf.border, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
    >
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      {conf.label}
    </span>
  );
}

// ============================================================
// Pipeline visual — adaptado para tarjeta CQ
// ============================================================

function PipelineTarjetaCQ({ estado }: { estado: EstadoUI }) {
  const pasos = [
    { key: 'Borrador',      label: 'Borrador' },
    { key: 'En revision',   label: 'Gerente' },
    { key: 'Aprobado',      label: 'Aprobado' },
    { key: 'Facturacion',   label: 'Facturación' },
    { key: 'En tesoreria',  label: 'Tesorería' },
    { key: 'Pagado',        label: 'Pagado' },
  ];

  const indexActual =
    estado === 'Borrador'     ? 0 :
    estado === 'En revision'  ? 1 :
    estado === 'Devuelto'     ? 1 :
    estado === 'Aprobado'     ? 3 :
    estado === 'En tesoreria' ? 4 : 5;

  return (
    <div className="flex items-center w-full">
      {pasos.map((paso, i) => {
        const activo     = i === indexActual && estado !== 'Devuelto';
        const completado = i < indexActual;
        const devuelto   = estado === 'Devuelto' && i === 1;

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
// CardGasto
// ============================================================

interface CardGastoProps {
  fila: GastoLocal;
  idx: number;
  bloqueado: boolean;
  saving: boolean;
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  cuentasAuxiliares: CuentaAuxiliar[];
  onCampo: (localId: string, campo: keyof GastoLocal, valor: string) => void;
  onEliminarFila: (localId: string) => void;
  onAdjuntar: (localId: string, file: File, categoria: CategoriaGasto) => void;
  onQuitarArchivoGuardado: (localId: string, archivoId: string) => void;
  onQuitarArchivoPendiente: (localId: string, localKey: string) => void;
  onVerArchivo: (localId: string, archivoId: string) => void;
  onReenviarGasto: (localId: string) => void;
  onEscanear: (localId: string, file: File) => void;
  escaneando: boolean;
}

function CardGasto({
  fila, idx, bloqueado, saving,
  centrosCosto, centrosOperacion, cuentasAuxiliares,
  onCampo, onEliminarFila, onAdjuntar,
  onQuitarArchivoGuardado, onQuitarArchivoPendiente,
  onVerArchivo, onReenviarGasto, onEscanear, escaneando,
}: CardGastoProps) {
  const inputCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all`;
  const inputReadCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-100 cursor-default`;
  const selectCls = `w-full rounded-lg px-3 py-2.5 text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all`;

  type BuzonEstado = 'cargando' | 'encontrada' | 'no_encontrada';
  const [buzonStatus, setBuzonStatus] = useState<{ estado: BuzonEstado; proveedor?: string } | null>(null);

  const handleBlurRecibo = async (valor: string) => {
    if (!valor.trim()) { setBuzonStatus(null); return; }
    setBuzonStatus({ estado: 'cargando' });
    try {
      const res = await checkBuzon(valor.trim());
      setBuzonStatus(res.existe
        ? { estado: 'encontrada', proveedor: res.proveedor ?? undefined }
        : { estado: 'no_encontrada' }
      );
    } catch { setBuzonStatus(null); }
  };

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
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50"
        style={{ background: 'linear-gradient(to right, rgba(0,130,154,0.04), transparent)' }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
            style={{ background: 'linear-gradient(to bottom right, #00829a, #14aab8)' }}>
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate text-sm"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
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
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}>
              <RotateCcw className="w-3 h-3" /> Devuelto
            </span>
          )}
          {monto > 0 && (
            <span className="text-base font-bold" style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              {fmtMonto(monto)}
            </span>
          )}
          {!bloqueado && (
            <button type="button" onClick={() => onEliminarFila(fila.localId)} disabled={saving}
              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!bloqueado && (
        <div className="px-5 pt-3 pb-1">
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all border ${
            escaneando ? 'bg-purple-50 border-purple-200 text-purple-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-indigo-100 hover:border-purple-300'
          }`} style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            {escaneando ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</> : <><Sparkles className="w-4 h-4" /><Scan className="w-4 h-4" /> Escanear con IA</>}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={escaneando}
              style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onEscanear(fila.localId, f); e.target.value = ''; }} />
          </label>
        </div>
      )}

      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Fecha</label>
            {bloqueado ? <p className={inputReadCls}>{fila.fecha ? fmtFecha(fila.fecha) : '—'}</p>
              : <input type="date" value={fila.fecha} onChange={(e) => onCampo(fila.localId, 'fecha', e.target.value)} className={inputCls} />}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>No. Identificacion</label>
            {bloqueado ? <p className={inputReadCls}>{fila.noIdentificacion || '—'}</p>
              : <input type="text" placeholder="NIT / CC" value={fila.noIdentificacion}
                onChange={(e) => onCampo(fila.localId, 'noIdentificacion', e.target.value)} className={inputCls} />}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Pagado A</label>
            {bloqueado ? <p className={inputReadCls}>{fila.pagadoA || '—'}</p>
              : <input type="text" placeholder="Nombre del proveedor" value={fila.pagadoA}
                onChange={(e) => onCampo(fila.localId, 'pagadoA', e.target.value)} className={inputCls} />}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Concepto</label>
            {bloqueado ? <p className={inputReadCls}>{fila.concepto || '—'}</p>
              : <input type="text" placeholder="Descripcion del gasto" value={fila.concepto}
                onChange={(e) => onCampo(fila.localId, 'concepto', e.target.value)} className={inputCls} />}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>No. Recibo</label>
            {bloqueado ? <p className={inputReadCls}>{fila.noRecibo || '—'}</p> : (
              <>
                <input type="text" placeholder="Numero de recibo" value={fila.noRecibo}
                  onChange={(e) => { onCampo(fila.localId, 'noRecibo', e.target.value); setBuzonStatus(null); }}
                  onBlur={(e) => handleBlurRecibo(e.target.value)} className={inputCls} />
                {buzonStatus?.estado === 'cargando' && <p className="mt-1 text-xs text-gray-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Verificando...</p>}
                {buzonStatus?.estado === 'encontrada' && <p className="mt-1 text-xs font-medium flex items-center gap-1" style={{ color: '#16a34a' }}><BadgeCheck size={13} /> En buzón · {buzonStatus.proveedor}</p>}
                {buzonStatus?.estado === 'no_encontrada' && <p className="mt-1 text-xs font-medium flex items-center gap-1" style={{ color: '#d97706' }}><AlertCircle size={13} /> No encontrada aún</p>}
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Valor Pagado</label>
            {bloqueado ? <p className={`${inputReadCls} font-semibold`} style={{ color: '#00829a' }}>{monto > 0 ? fmtMonto(monto) : '—'}</p>
              : <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                <input type="number" placeholder="0" value={fila.valorPagado}
                  onChange={(e) => onCampo(fila.localId, 'valorPagado', e.target.value)} className={`${inputCls} pl-7`} /></div>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Centro de Costos</label>
            {bloqueado ? <p className={inputReadCls}>{centrosCosto.find(c => c.id === fila.centroCostoId)?.nombre || '—'}</p>
              : <select value={fila.centroCostoId} onChange={(e) => { onCampo(fila.localId, 'centroCostoId', e.target.value); onCampo(fila.localId, 'centroOperacionId', ''); }} className={selectCls}>
                <option value="">-- Seleccionar --</option>
                {centrosCosto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Centro de Operacion</label>
            {bloqueado ? <p className={inputReadCls}>{centrosOperacion.find(c => c.id === fila.centroOperacionId)?.nombre || '—'}</p>
              : <select value={fila.centroOperacionId} onChange={(e) => onCampo(fila.localId, 'centroOperacionId', e.target.value)} className={selectCls}>
                <option value="">-- Seleccionar --</option>
                {centrosOperacion.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Cuenta Contable</label>
            {bloqueado ? <p className={inputReadCls}>{cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)
              ? `${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.codigo} - ${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.descripcion}` : '—'}</p>
              : <select value={fila.cuentaAuxiliarId} onChange={(e) => onCampo(fila.localId, 'cuentaAuxiliarId', e.target.value)} className={selectCls}>
                <option value="">-- Seleccionar --</option>
                {cuentasAuxiliares.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>)}
              </select>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Soportes adjuntos</label>
          <div className="flex flex-wrap gap-2">
            {fila.archivos.map((arch) => (
              <div key={arch.id} className="flex items-center gap-1.5 rounded-lg overflow-hidden border"
                style={{ borderColor: '#bae6fd', backgroundColor: '#e0f5f7' }}>
                <button type="button" onClick={() => onVerArchivo(fila.localId, arch.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:opacity-80 transition-opacity min-w-0" title={arch.filename}>
                  {arch.filename.toLowerCase().endsWith('.pdf')
                    ? <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />
                    : <FileImage className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />}
                  <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: '#00829a' }}>{arch.filename}</span>
                </button>
                {!bloqueado && (
                  <button type="button" onClick={() => onQuitarArchivoGuardado(fila.localId, arch.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {fila.pendingFiles.map((pf) => (
              <div key={pf.localKey} className="flex items-center gap-1.5 rounded-lg overflow-hidden border"
                style={{ borderColor: '#fde68a', backgroundColor: '#fef3c7' }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 min-w-0" title={pf.file.name}>
                  {pf.file.name.toLowerCase().endsWith('.pdf')
                    ? <FileText className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    : <FileImage className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
                  <span className="text-xs font-medium truncate max-w-[120px] text-amber-700">{pf.file.name}</span>
                </div>
                <button type="button" onClick={() => onQuitarArchivoPendiente(fila.localId, pf.localKey)}
                  className="p-1.5 text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {!bloqueado && (fila.archivos.length + fila.pendingFiles.length) < 2 && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer border border-dashed border-gray-300 hover:border-teal-400 hover:bg-teal-50 transition-all text-xs font-semibold text-gray-500 hover:text-teal-600"
                style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', position: 'relative' }}>
                <Upload className="w-3.5 h-3.5" /> Adjuntar soporte
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdjuntar(fila.localId, f, 'Otro'); e.target.value = ''; }} />
              </label>
            )}
            {bloqueado && fila.archivos.length === 0 && (
              <span className="text-xs text-gray-300 italic py-1.5">Sin soporte adjunto</span>
            )}
          </div>
        </div>

        {esGastoDevuelto && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-700 mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Devuelto por Radicación:
            </p>
            {fila.motivo_devolucion_gasto && (
              <p className="text-xs text-red-600 mb-2">{fila.motivo_devolucion_gasto}</p>
            )}
            <button type="button" onClick={() => onReenviarGasto(fila.localId)} disabled={saving}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Marcar como corregido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TablaGastos
// ============================================================

interface TablaGastosProps {
  filas: GastoLocal[];
  bloqueado: boolean;
  saving: boolean;
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  cuentasAuxiliares: CuentaAuxiliar[];
  onCampo: (localId: string, campo: keyof GastoLocal, valor: string) => void;
  onAgregarFila: () => void;
  onEliminarFila: (localId: string) => void;
  onAdjuntar: (localId: string, file: File, categoria: CategoriaGasto) => void;
  onQuitarArchivoGuardado: (localId: string, archivoId: string) => void;
  onQuitarArchivoPendiente: (localId: string, localKey: string) => void;
  onVerArchivo: (localId: string, archivoId: string) => void;
  onReenviarGasto: (localId: string) => void;
  onEscanear: (localId: string, file: File) => void;
  escaneandoId: string | null;
}

function TablaGastos({ filas, bloqueado, saving, centrosCosto, centrosOperacion, cuentasAuxiliares, onCampo, onAgregarFila, onEliminarFila, onAdjuntar, onQuitarArchivoGuardado, onQuitarArchivoPendiente, onVerArchivo, onReenviarGasto, onEscanear, escaneandoId }: TablaGastosProps) {
  const totalCalculado = filas.reduce((acc, f) => acc + (parseFloat(f.valorPagado.replace(/[^0-9.]/g, '')) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Detalle de gastos
          </h3>
          <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {filas.length} gasto{filas.length !== 1 ? 's' : ''} registrado{filas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!bloqueado && (
          <button type="button" onClick={onAgregarFila} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', color: '#fff', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', boxShadow: '0 2px 8px rgba(0,130,154,0.25)' }}>
            <PlusCircle className="w-4 h-4" /> Agregar gasto
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filas.map((fila, idx) => (
          <CardGasto key={fila.localId} fila={fila} idx={idx} bloqueado={bloqueado} saving={saving}
            centrosCosto={centrosCosto} centrosOperacion={centrosOperacion} cuentasAuxiliares={cuentasAuxiliares}
            onCampo={onCampo} onEliminarFila={onEliminarFila} onAdjuntar={onAdjuntar}
            onQuitarArchivoGuardado={onQuitarArchivoGuardado} onQuitarArchivoPendiente={onQuitarArchivoPendiente}
            onVerArchivo={onVerArchivo} onReenviarGasto={onReenviarGasto}
            onEscanear={onEscanear} escaneando={escaneandoId === fila.localId} />
        ))}
        {filas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Sin gastos registrados</p>
            {!bloqueado && (
              <button type="button" onClick={onAgregarFila} className="mt-3 text-sm font-semibold" style={{ color: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                + Agregar el primer gasto
              </button>
            )}
          </div>
        )}
      </div>

      {filas.length > 0 && (
        <div className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: 'linear-gradient(to right, rgba(0,130,154,0.08), rgba(20,170,184,0.05))' }}>
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>Total de gastos</span>
          <span className="text-2xl font-bold" style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            $ {totalCalculado.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DetallePaquete CQ
// ============================================================

function DetallePaqueteCQ({
  paqueteId,
  onCerrar,
  aprobadores,
}: {
  paqueteId: string;
  onCerrar: () => void;
  aprobadores: AprobadorGerencia[];
}) {
  const { user } = useAuth();
  const [paquete, setPaquete] = useState<PaqueteOut | null>(null);
  const [gastos, setGastos] = useState<GastoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [escaneandoId, setEscaneandoId] = useState<string | null>(null);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);
  const [showAprobadorModal, setShowAprobadorModal] = useState(false);
  const [aprobadorSeleccionado, setAprobadorSeleccionado] = useState<string>('');

  useEffect(() => {
    Promise.all([getCentrosCosto(), getCentrosOperacion(), getCuentasAuxiliares()])
      .then(([cc, co, ca]) => { setCentrosCosto(cc); setCentrosOperacion(co); setCuentasAuxiliares(ca); })
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPaqueteGasto(paqueteId);
      setPaquete(p);
      setGastos([...p.gastos].sort((a, b) => a.orden - b.orden).map(g => gastoOutToLocal(g)));
    } catch {
      toast.error('Error al cargar el paquete');
    } finally {
      setLoading(false);
    }
  }, [paqueteId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading || !paquete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
        <p className="text-sm text-gray-400">Cargando paquete...</p>
      </div>
    );
  }

  const estadoUI = apiToUI(paquete.estado);
  const bloqueado = !['borrador', 'devuelto'].includes(paquete.estado);

  const comentarioDevolucion = paquete.comentarios
    .filter((c) => c.tipo === 'devolucion')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const handleCampo = (localId: string, campo: keyof GastoLocal, valor: string) => {
    if (bloqueado) return;
    setGastos(prev => prev.map(f => f.localId === localId ? { ...f, [campo]: valor, isDirty: true } : f));
  };

  const handleAgregarFila = () => { if (!bloqueado) setGastos(prev => [...prev, filaVaciaLocal()]); };

  const handleEliminarFila = async (localId: string) => {
    if (bloqueado) return;
    const fila = gastos.find(f => f.localId === localId);
    if (!fila) return;
    if (fila.id) {
      if (!window.confirm('¿Eliminar este gasto?')) return;
      try {
        setSaving(true);
        await eliminarGasto(paqueteId, fila.id);
        toast.success('Gasto eliminado');
      } catch { toast.error('Error al eliminar el gasto'); return; }
      finally { setSaving(false); }
    }
    setGastos(prev => prev.filter(f => f.localId !== localId));
  };

  const handleAdjuntar = (localId: string, file: File, categoria: CategoriaGasto) => {
    setGastos(prev => prev.map(f => {
      if (f.localId !== localId) return f;
      if (f.archivos.length + f.pendingFiles.length >= 2) return f;
      return { ...f, pendingFiles: [...f.pendingFiles, { localKey: `${Date.now()}-${Math.random()}`, file, categoria }], isDirty: true };
    }));
  };

  const handleQuitarArchivoGuardado = async (localId: string, archivoId: string) => {
    const fila = gastos.find(f => f.localId === localId);
    if (!fila?.id) return;
    try {
      setSaving(true);
      await eliminarArchivoGasto(paqueteId, fila.id, archivoId);
      setGastos(prev => prev.map(f => f.localId === localId ? { ...f, archivos: f.archivos.filter(a => a.id !== archivoId) } : f));
      toast.success('Soporte eliminado');
    } catch { toast.error('Error al eliminar el soporte'); }
    finally { setSaving(false); }
  };

  const handleQuitarArchivoPendiente = (localId: string, localKey: string) => {
    setGastos(prev => prev.map(f => f.localId === localId ? { ...f, pendingFiles: f.pendingFiles.filter(pf => pf.localKey !== localKey) } : f));
  };

  const handleVerArchivo = async (localId: string, archivoId: string) => {
    const fila = gastos.find(f => f.localId === localId);
    if (!fila?.id) return;
    try {
      const { download_url } = await getDownloadUrlArchivoGasto(paqueteId, fila.id, archivoId);
      window.open(download_url, '_blank');
    } catch { toast.error('Error al obtener el archivo'); }
  };

  const handleReenviarGasto = async (localId: string) => {
    const fila = gastos.find(f => f.localId === localId);
    if (!fila?.id) return;
    try {
      setSaving(true);
      await reenviarGasto(paqueteId, fila.id);
      toast.success('Gasto marcado como corregido.');
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al reenviar.');
    } finally { setSaving(false); }
  };

  const handleEscanear = async (localId: string, file: File) => {
    setEscaneandoId(localId);
    try {
      const datos = await extraerDatosImagen(file);
      const campos: Partial<Record<keyof GastoLocal, string>> = {};
      if (datos.no_identificacion) campos.noIdentificacion = datos.no_identificacion;
      if (datos.pagado_a)          campos.pagadoA          = datos.pagado_a;
      if (datos.concepto)          campos.concepto         = datos.concepto;
      if (datos.no_recibo)         campos.noRecibo         = datos.no_recibo;
      if (datos.valor_pagado)      campos.valorPagado      = datos.valor_pagado;
      if (datos.fecha)             campos.fecha            = datos.fecha;
      setGastos(prev => prev.map(f => f.localId === localId ? { ...f, ...campos, isDirty: true } : f));
      const n = datos.campos_detectados.length;
      if (n === 0) toast.warning('No se detectaron datos. Intenta con una foto más nítida.');
      else toast.success(`${n} campo${n !== 1 ? 's' : ''} completado${n !== 1 ? 's' : ''} automáticamente`);
    } catch { toast.error('No se pudo analizar la imagen.'); }
    finally { setEscaneandoId(null); }
  };

  const persistirCambios = async () => {
    for (const fila of gastos) {
      const esNueva = !fila.id;
      const tieneContenido = fila.fecha || fila.noIdentificacion || fila.pagadoA || fila.concepto || fila.valorPagado;
      if (esNueva && !tieneContenido) continue;
      let gastoId = fila.id;
      if (esNueva && tieneContenido) {
        const creado = await agregarGasto(paqueteId, {
          fecha: fila.fecha || new Date().toISOString().slice(0, 10),
          no_identificacion: fila.noIdentificacion, pagado_a: fila.pagadoA,
          concepto: fila.concepto, no_recibo: fila.noRecibo || undefined,
          valor_pagado: parseFloat(fila.valorPagado) || 0,
          centro_costo_id: fila.centroCostoId || undefined,
          centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });
        gastoId = creado.id;
        if (creado.aviso_buzon) toast.info(creado.aviso_buzon, { duration: 8000 });
      } else if (!esNueva && fila.isDirty && gastoId) {
        await editarGasto(paqueteId, gastoId, {
          fecha: fila.fecha || undefined, no_identificacion: fila.noIdentificacion || undefined,
          pagado_a: fila.pagadoA || undefined, concepto: fila.concepto || undefined,
          no_recibo: fila.noRecibo || undefined, valor_pagado: parseFloat(fila.valorPagado) || undefined,
          centro_costo_id: fila.centroCostoId || undefined, centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });
      }
      for (const pf of fila.pendingFiles) {
        if (gastoId) await subirArchivoGasto(paqueteId, gastoId, pf.categoria, pf.file);
      }
    }
  };

  const handleGuardarBorrador = async () => {
    setSaving(true);
    try {
      await persistirCambios();
      toast.success('Borrador guardado correctamente');
      await cargar();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al guardar el borrador');
    } finally { setSaving(false); }
  };

  const handleEnviar = () => {
    // Tarjeta CQ siempre requiere selección de aprobador de gerencia
    setAprobadorSeleccionado(paquete?.aprobador?.id ?? '');
    setShowAprobadorModal(true);
  };

  const handleEnviarConfirmado = async (aprobadorId: string) => {
    setSaving(true);
    try {
      await persistirCambios();
      await enviarPaquete(paqueteId, aprobadorId);
      toast.success('Paquete enviado. El gerente recibirá el correo de aprobación.');
      onCerrar();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || 'Error al enviar el paquete');
      setSaving(false);
    }
  };

  const esBorrador = paquete.estado === 'borrador';
  const esDevuelto = paquete.estado === 'devuelto';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div className="rounded-2xl p-5 border border-gray-100"
        style={{ background: 'linear-gradient(135deg, #fff 60%, rgba(0,130,154,0.04) 100%)', boxShadow: '0 2px 12px rgba(0,130,154,0.08)' }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={onCerrar}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            <ChevronRight className="w-4 h-4 rotate-180" /> Volver a mis paquetes
          </button>
          <div className="flex items-center gap-2">
            {(esBorrador || esDevuelto) ? (
              <>
                {esBorrador && (
                  <button onClick={handleGuardarBorrador} disabled={saving}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar borrador
                  </button>
                )}
                <button onClick={handleEnviar} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(0,130,154,0.30)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {esDevuelto ? 'Reenviar corregido' : 'Enviar para aprobación'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed opacity-50"
                style={{ backgroundColor: '#e5e7eb', color: '#6b7280' }}>
                <Send className="w-4 h-4" /> Enviado
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold" style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {formatSemanaLabel(paquete.semana)}
              </h2>
              <EstadoBadge estado={estadoUI} size="md" />
              {paquete.folio && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md border"
                  style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                  {paquete.folio}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                {formatRango(paquete.fecha_inicio, paquete.fecha_fin)}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#00829a' }}>
                <Banknote className="w-4 h-4" /> {fmtMonto(paquete.monto_total)}
              </span>
              {paquete.aprobador && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <BadgeCheck className="w-3.5 h-3.5 text-amber-500" />
                  Aprobador: <strong className="text-gray-600">{paquete.aprobador.nombre}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Flujo Tarjeta CQ
          </p>
          <PipelineTarjetaCQ estado={estadoUI} />
        </div>
      </div>

      {esDevuelto && comentarioDevolucion && (
        <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700 mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Motivo de devolución
            </p>
            <p className="text-sm text-red-600">{comentarioDevolucion.texto}</p>
          </div>
        </div>
      )}

      {['En revision', 'Aprobado', 'Pagado'].includes(estadoUI) && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-600" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {estadoUI === 'En revision' && `Esperando aprobación del gerente${paquete.aprobador ? ` (${paquete.aprobador.nombre})` : ''}. Se enviará un correo con el enlace de aprobación (válido 72 horas).`}
            {estadoUI === 'Aprobado' && 'Gastos aprobados por el gerente. El área de Radicación procesará el envío a Tesorería.'}
            {estadoUI === 'Pagado' && 'Este paquete fue pagado y legalizado exitosamente.'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <TablaGastos filas={gastos} bloqueado={bloqueado} saving={saving}
          centrosCosto={centrosCosto} centrosOperacion={centrosOperacion} cuentasAuxiliares={cuentasAuxiliares}
          onCampo={handleCampo} onAgregarFila={handleAgregarFila} onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar} onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente} onVerArchivo={handleVerArchivo}
          onReenviarGasto={handleReenviarGasto} onEscanear={handleEscanear} escaneandoId={escaneandoId} />
      </div>

      {(esBorrador || esDevuelto) && (
        <div className="pb-4">
          <button onClick={handleEnviar} disabled={saving}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', boxShadow: '0 6px 20px rgba(0,130,154,0.35)' }}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {esDevuelto ? 'Reenviar paquete corregido' : 'Enviar para aprobación de gerencia'}
          </button>
        </div>
      )}

      {/* Modal selección aprobador — siempre requerido para tarjeta CQ */}
      {showAprobadorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #00829a, #14aab8)' }}>
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                  Seleccionar Aprobador de Gerencia
                </h3>
                <p className="text-xs text-gray-500" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Recibirá el enlace de aprobación por correo (válido 72 horas)
                </p>
              </div>
            </div>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 mb-5 focus:outline-none focus:ring-2 focus:ring-[#00829a]"
              value={aprobadorSeleccionado}
              onChange={(e) => setAprobadorSeleccionado(e.target.value)}
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              <option value="">— Selecciona el gerente aprobador —</option>
              {aprobadores.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} · {a.cargo}</option>
              ))}
            </select>
            {aprobadores.length === 0 && (
              <p className="text-xs text-amber-600 mb-4 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> No hay aprobadores activos. Contacta al administrador.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAprobadorModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                Cancelar
              </button>
              <button disabled={!aprobadorSeleccionado || saving}
                onClick={() => { setShowAprobadorModal(false); handleEnviarConfirmado(aprobadorSeleccionado); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(0,130,154,0.30)' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar y notificar gerente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NuevoPaqueteCQForm
// ============================================================

function NuevoPaqueteCQForm({
  aprobadores,
  onCerrar,
  onCreado,
}: {
  aprobadores: AprobadorGerencia[];
  onCerrar: () => void;
  onCreado: (id: string) => void;
}) {
  const [semana, setSemana] = useState('');
  const [filas, setFilas] = useState<GastoLocal[]>([filaVaciaLocal()]);
  const [saving, setSaving] = useState(false);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);
  const [escaneandoId, setEscaneandoId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCentrosCosto(), getCentrosOperacion(), getCuentasAuxiliares()])
      .then(([cc, co, ca]) => { setCentrosCosto(cc); setCentrosOperacion(co); setCuentasAuxiliares(ca); })
      .catch(() => {});
  }, []);

  const handleCampo = (localId: string, campo: keyof GastoLocal, valor: string) => {
    setFilas(prev => prev.map(f => f.localId === localId ? { ...f, [campo]: valor } : f));
  };
  const handleAgregarFila = () => setFilas(prev => [...prev, filaVaciaLocal()]);
  const handleEliminarFila = (localId: string) => {
    if (filas.length === 1) return;
    setFilas(prev => prev.filter(f => f.localId !== localId));
  };
  const handleAdjuntar = (localId: string, file: File, categoria: CategoriaGasto) => {
    setFilas(prev => prev.map(f => {
      if (f.localId !== localId) return f;
      if (f.archivos.length + f.pendingFiles.length >= 2) return f;
      return { ...f, pendingFiles: [...f.pendingFiles, { localKey: `${Date.now()}-${Math.random()}`, file, categoria }] };
    }));
  };
  const handleQuitarArchivoGuardado = (localId: string, archivoId: string) => {
    setFilas(prev => prev.map(f => f.localId === localId ? { ...f, archivos: f.archivos.filter(a => a.id !== archivoId) } : f));
  };
  const handleQuitarArchivoPendiente = (localId: string, localKey: string) => {
    setFilas(prev => prev.map(f => f.localId === localId ? { ...f, pendingFiles: f.pendingFiles.filter(pf => pf.localKey !== localKey) } : f));
  };
  const handleEscanear = async (localId: string, file: File) => {
    setEscaneandoId(localId);
    try {
      const datos = await extraerDatosImagen(file);
      const campos: Partial<Record<keyof GastoLocal, string>> = {};
      if (datos.no_identificacion) campos.noIdentificacion = datos.no_identificacion;
      if (datos.pagado_a)          campos.pagadoA          = datos.pagado_a;
      if (datos.concepto)          campos.concepto         = datos.concepto;
      if (datos.no_recibo)         campos.noRecibo         = datos.no_recibo;
      if (datos.valor_pagado)      campos.valorPagado      = datos.valor_pagado;
      if (datos.fecha)             campos.fecha            = datos.fecha;
      setFilas(prev => prev.map(f => f.localId === localId ? { ...f, ...campos } : f));
      const n = datos.campos_detectados.length;
      if (n === 0) toast.warning('No se detectaron datos.');
      else toast.success(`${n} campo${n !== 1 ? 's' : ''} completado${n !== 1 ? 's' : ''} automáticamente`);
    } catch { toast.error('No se pudo analizar la imagen.'); }
    finally { setEscaneandoId(null); }
  };

  const handleGuardar = async () => {
    if (!semana) { toast.error('Selecciona la semana de gastos'); return; }
    const filasValidas = filas.filter(f => f.fecha || f.noIdentificacion || f.pagadoA || f.concepto || f.valorPagado);
    if (filasValidas.length === 0) { toast.error('Agrega al menos un gasto con datos'); return; }

    setSaving(true);
    try {
      const paquete = await createPaqueteGasto(semana);
      for (const fila of filasValidas) {
        const creado = await agregarGasto(paquete.id, {
          fecha: fila.fecha || new Date().toISOString().slice(0, 10),
          no_identificacion: fila.noIdentificacion, pagado_a: fila.pagadoA,
          concepto: fila.concepto, no_recibo: fila.noRecibo || undefined,
          valor_pagado: parseFloat(fila.valorPagado) || 0,
          centro_costo_id: fila.centroCostoId || undefined,
          centro_operacion_id: fila.centroOperacionId || undefined,
          cuenta_auxiliar_id: fila.cuentaAuxiliarId || undefined,
        });
        if (creado.aviso_buzon) toast.info(creado.aviso_buzon, { duration: 8000 });
        for (const pf of fila.pendingFiles) {
          await subirArchivoGasto(paquete.id, creado.id, pf.categoria, pf.file);
        }
      }
      toast.success('Paquete creado correctamente');
      onCreado(paquete.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el paquete');
    } finally { setSaving(false); }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Nuevo paquete de gastos CQ
          </h3>
          <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Registra los gastos realizados con la tarjeta CQ y adjunta los soportes
          </p>
        </div>
        <button onClick={onCerrar} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
          Semana de gastos <span className="text-red-500">*</span>
        </label>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <input type="week" value={semana} onChange={(e) => setSemana(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-teal-400 transition-colors" />
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 flex-1 min-w-[200px]">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Al enviar, podrás seleccionar el gerente aprobador. Se enviará un correo con enlace de aprobación <strong>válido 72 horas</strong>.
            </p>
          </div>
        </div>
      </div>

      {aprobadores.length === 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700">
            No hay aprobadores de gerencia activos. Contacta al administrador para configurarlos antes de enviar un paquete.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <TablaGastos filas={filas} bloqueado={false} saving={saving}
          centrosCosto={centrosCosto} centrosOperacion={centrosOperacion} cuentasAuxiliares={cuentasAuxiliares}
          onCampo={handleCampo} onAgregarFila={handleAgregarFila} onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar} onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente} onVerArchivo={() => {}}
          onReenviarGasto={() => {}} onEscanear={handleEscanear} escaneandoId={escaneandoId} />
      </div>

      <div className="flex gap-3 pb-4">
        <button onClick={onCerrar} disabled={saving}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
          Cancelar
        </button>
        <button onClick={handleGuardar} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(0,130,154,0.30)' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear paquete CQ
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PaqueteCard CQ
// ============================================================

function PaqueteCardCQ({ p, onClick }: { p: PaqueteListItem; onClick: () => void }) {
  const estadoUI = apiToUI(p.estado);
  const conf = estadoConfig[estadoUI];
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: `4px solid ${conf.border}` }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold leading-tight" style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {formatSemanaLabel(p.semana)}
              </p>
              {p.folio && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md border"
                  style={{ backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                  {p.folio}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {formatRango(p.fecha_inicio, p.fecha_fin)}
            </p>
          </div>
          <EstadoBadge estado={estadoUI} />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#00829a' }}>
            <Banknote className="w-4 h-4" /> {fmtMonto(p.monto_total)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <FileText className="w-3.5 h-3.5" /> {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
          </span>
          {p.fecha_envio && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <CalendarDays className="w-3.5 h-3.5" /> Enviado {fmtFecha(p.fecha_envio.slice(0, 10))}
            </span>
          )}
        </div>
        {p.estado === 'devuelto' && p.comentario_devolucion && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 line-clamp-2">{p.comentario_devolucion}</p>
          </div>
        )}
        {p.tiene_gastos_devueltos && p.estado !== 'devuelto' && (
          <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 font-semibold" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Radicación devolvió uno o más gastos — revisa y corrige
            </p>
          </div>
        )}
        <div className="flex justify-end mt-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: conf.bg }}>
            <ChevronRight className="w-4 h-4" style={{ color: conf.text }} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// Página principal TarjetaCQPage
// ============================================================

type Vista = 'lista' | 'historial' | 'nuevo' | 'detalle';

export function TarjetaCQPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paqueteIdInicial = searchParams.get('paquete');
  const [vista, setVista] = useState<Vista>(paqueteIdInicial ? 'detalle' : 'lista');
  const [paqueteActivo, setPaqueteActivo] = useState<string | null>(paqueteIdInicial);
  const [paquetes, setPaquetes] = useState<PaqueteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprobadores, setAprobadores] = useState<AprobadorGerencia[]>([]);

  useEffect(() => {
    getAprobadoresActivos().then(setAprobadores).catch(() => {});
  }, []);

  const cargarLista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPaquetesGastos({ limit: 200 });
      setPaquetes(res.paquetes);
    } catch {
      toast.error('Error al cargar los paquetes');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (vista === 'lista' || vista === 'historial') cargarLista();
  }, [vista, cargarLista]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const irALista = () => { setVista('lista'); setPaqueteActivo(null); };

  const conGastosDevueltos = paquetes.filter(p => p.tiene_gastos_devueltos && !['borrador', 'devuelto'].includes(p.estado));
  const activos = paquetes.filter(p => ['borrador', 'devuelto'].includes(p.estado));
  const historial = paquetes.filter(p => !['borrador', 'devuelto'].includes(p.estado) && !p.tiene_gastos_devueltos);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="shrink-0" style={{ background: 'linear-gradient(to right, #00829a, #14aab8)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold leading-tight text-base" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                Tarjeta Anticipo CQ
              </h1>
              <p className="text-white/70 text-xs" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                Legalización de gastos con tarjeta CQ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white/90 border-2 border-white/30"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                {user?.nombre?.charAt(0)?.toUpperCase() ?? 'R'}
              </div>
              <div className="text-right">
                <p className="text-white text-xs font-semibold leading-tight" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  {user?.nombre ?? 'Responsable'}
                </p>
                <p className="text-white/60 text-xs leading-tight" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  {user?.area?.nombre ?? 'Tarjeta CQ'}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors" title="Cerrar sesion">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-end gap-1">
            <button onClick={irALista}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all ${
                vista === 'lista' || vista === 'detalle' || vista === 'nuevo'
                  ? 'bg-gray-50 text-gray-900' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`} style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              <PackagePlus className="w-4 h-4 shrink-0" /> Mis paquetes
              {activos.length > 0 && (
                <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white" style={{ backgroundColor: '#00829a' }}>
                  {activos.length}
                </span>
              )}
              {conGastosDevueltos.length > 0 && (
                <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white" style={{ backgroundColor: '#f97316' }}>
                  {conGastosDevueltos.length}
                </span>
              )}
            </button>
            <button onClick={() => { setVista('historial'); setPaqueteActivo(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all ${
                vista === 'historial' ? 'bg-gray-50 text-gray-900' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`} style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              <History className="w-4 h-4 shrink-0" /> Historial
              {historial.length > 0 && (
                <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                  {historial.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {(vista === 'lista' || vista === 'historial') && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {vista === 'historial' ? 'Historial de envios' : 'Mis Paquetes Tarjeta CQ'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                {vista === 'historial'
                  ? 'Paquetes enviados para aprobación o pagados'
                  : 'Registra y legaliza los gastos realizados con tu tarjeta CQ'}
              </p>
            </div>
            {vista === 'lista' && (
              <button onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', boxShadow: '0 3px 10px rgba(0,130,154,0.25)' }}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo paquete</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

          {vista === 'nuevo' && (
            <NuevoPaqueteCQForm aprobadores={aprobadores} onCerrar={irALista}
              onCreado={(id) => { setPaqueteActivo(id); setVista('detalle'); }} />
          )}

          {vista === 'detalle' && paqueteActivo && (
            <DetallePaqueteCQ paqueteId={paqueteActivo} onCerrar={irALista} aprobadores={aprobadores} />
          )}

          {vista === 'historial' && (
            <div className="max-w-2xl mx-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
                  <p className="text-sm text-gray-400">Cargando historial...</p>
                </div>
              )}
              {!loading && historial.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <History className="w-10 h-10 text-gray-300" />
                  </div>
                  <p className="text-base font-semibold text-gray-500 mb-1" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                    Sin paquetes enviados
                  </p>
                </div>
              )}
              {!loading && historial.length > 0 && (
                <div className="space-y-3">
                  {historial.map(p => <PaqueteCardCQ key={p.id} p={p} onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }} />)}
                </div>
              )}
            </div>
          )}

          {vista === 'lista' && (
            <div className="max-w-2xl mx-auto space-y-8">
              {loading && (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
                  <p className="text-sm text-gray-400">Cargando paquetes...</p>
                </div>
              )}
              {!loading && (
                <>
                  {conGastosDevueltos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                          Requiere tu atención ({conGastosDevueltos.length})
                        </p>
                      </div>
                      <div className="space-y-3">
                        {conGastosDevueltos.map(p => <PaqueteCardCQ key={p.id} p={p} onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }} />)}
                      </div>
                    </div>
                  )}
                  {activos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00829a' }} />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                          Paquetes activos
                        </p>
                      </div>
                      <div className="space-y-3">
                        {activos.map(p => <PaqueteCardCQ key={p.id} p={p} onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }} />)}
                      </div>
                    </div>
                  )}
                  {historial.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider"
                          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                          Historial de envios
                        </p>
                      </div>
                      <div className="space-y-3">
                        {historial.map(p => <PaqueteCardCQ key={p.id} p={p} onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }} />)}
                      </div>
                    </div>
                  )}
                  {activos.length === 0 && historial.length === 0 && conGastosDevueltos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center mb-5 border border-teal-100">
                        <CreditCard className="w-12 h-12" style={{ color: '#14aab8', opacity: 0.6 }} />
                      </div>
                      <p className="text-lg font-bold text-gray-700 mb-1" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                        Sin paquetes todavia
                      </p>
                      <p className="text-sm text-gray-400 mb-6 max-w-xs" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                        Crea tu primer paquete de gastos con tarjeta CQ para comenzar la legalización.
                      </p>
                      <button onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(to right, #00829a, #14aab8)', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', boxShadow: '0 4px 15px rgba(0,130,154,0.30)' }}>
                        <Plus className="w-4 h-4" /> Crear mi primer paquete CQ
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
