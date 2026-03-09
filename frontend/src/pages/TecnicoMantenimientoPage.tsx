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
};

type EstadoUI = 'Borrador' | 'En revision' | 'Devuelto' | 'Aprobado' | 'Pagado';

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
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  }
> = {
  Borrador:       { label: 'Borrador',            bg: '#f3f4f6', text: '#6b7280', icon: FileText },
  'En revision':  { label: 'En revision admin.',  bg: '#e0f2fe', text: '#0284c7', icon: Clock },
  Devuelto:       { label: 'Devuelto a usted',    bg: '#fee2e2', text: '#dc2626', icon: RotateCcw },
  Aprobado:       { label: 'Aprobado',            bg: '#dcfce7', text: '#16a34a', icon: CheckCircle2 },
  Pagado:         { label: 'Pagado / Legalizado', bg: '#f0fdf4', text: '#15803d', icon: BadgeCheck },
};

// ============================================================
// Badge de estado
// ============================================================

function EstadoBadge({ estado }: { estado: EstadoUI }) {
  const conf = estadoConfig[estado];
  const Icon = conf.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: conf.bg,
        color: conf.text,
        fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
      }}
    >
      <Icon className="w-3 h-3" />
      {conf.label}
    </span>
  );
}

// ============================================================
// Pipeline visual
// ============================================================

function PipelineEstado({ estado }: { estado: EstadoUI }) {
  const pasos = [
    { key: 'Borrador',    label: 'Borrador' },
    { key: 'enviado',     label: 'Enviado' },
    { key: 'En revision', label: 'Revision' },
    { key: 'Aprobado',   label: 'Aprobado' },
    { key: 'Pagado',     label: 'Pagado' },
  ];

  const indexActual =
    estado === 'Borrador'    ? 0 :
    estado === 'En revision' ? 2 :
    estado === 'Devuelto'    ? 2 :
    estado === 'Aprobado'    ? 3 : 4;

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
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: devuelto ? '#fee2e2' : activo ? '#00829a' : completado ? '#bbf7d0' : '#f3f4f6',
                  color: devuelto ? '#dc2626' : activo ? '#fff' : completado ? '#15803d' : '#9ca3af',
                  border: activo ? '2px solid #00829a' : 'none',
                }}
              >
                {devuelto
                  ? <RotateCcw className="w-3.5 h-3.5" />
                  : (completado || activo)
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : i + 1}
              </div>
              <span
                className="text-xs mt-1 text-center leading-tight"
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
                className="h-0.5 flex-1 mx-1"
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
// TablaGastos — tabla editable compartida
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
}

function TablaGastos({
  filas,
  bloqueado,
  saving,
  centrosCosto,
  centrosOperacion,
  cuentasAuxiliares,
  onCampo,
  onAgregarFila,
  onEliminarFila,
  onAdjuntar,
  onQuitarArchivoGuardado,
  onQuitarArchivoPendiente,
  onVerArchivo,
}: TablaGastosProps) {
  const inputCls = (editable: boolean) =>
    `w-full rounded px-1.5 py-1 text-xs text-gray-800 bg-transparent focus:outline-none ${
      editable
        ? 'border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white'
        : 'border-none cursor-default select-text'
    }`;

  const totalCalculado = filas.reduce(
    (acc, f) => acc + (parseFloat(f.valorPagado.replace(/[^0-9.]/g, '')) || 0),
    0
  );

  const columnas = [
    'FECHA',
    'No. IDENTIFICACION',
    'PAGADO A',
    'CONCEPTO',
    'No. RECIBO',
    'CENTRO COSTOS',
    'CENTRO OPERACION',
    'CUENTA CONTABLE',
    'VALOR PAGADO',
    'SOPORTE',
    ...(bloqueado ? [] : ['']),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          className="block text-sm text-gray-700"
        >
          Detalle de gastos
        </label>
        {!bloqueado && (
          <button
            type="button"
            onClick={onAgregarFila}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-50"
            style={{
              backgroundColor: '#e0f5f7',
              color: '#00829a',
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
            }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Agregar fila
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs" style={{ minWidth: 1200 }}>
          <thead>
            <tr style={{ backgroundColor: '#00829a' }}>
              {columnas.map((col, ci) => (
                <th
                  key={`${col}-${ci}`}
                  className="px-2 py-2.5 text-left font-semibold text-white whitespace-nowrap"
                  style={{
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    fontSize: 11,
                    ...(col === 'SOPORTE' ? { minWidth: 200 } : col === '' ? { width: 40, minWidth: 40 } : {}),
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, idx) => (
              <tr
                key={fila.localId}
                style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}
                className="border-t border-gray-100"
              >
                {/* FECHA */}
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={fila.fecha}
                    onChange={(e) => onCampo(fila.localId, 'fecha', e.target.value)}
                    readOnly={bloqueado}
                    className={inputCls(!bloqueado)}
                    style={{ minWidth: 110 }}
                  />
                </td>
                {/* No IDENTIFICACION */}
                <td className="px-1 py-1">
                  <input
                    type="text"
                    placeholder="Nit / CC"
                    value={fila.noIdentificacion}
                    onChange={(e) => onCampo(fila.localId, 'noIdentificacion', e.target.value)}
                    readOnly={bloqueado}
                    className={inputCls(!bloqueado)}
                    style={{ minWidth: 110 }}
                  />
                </td>
                {/* PAGADO A */}
                <td className="px-1 py-1">
                  <input
                    type="text"
                    placeholder="Proveedor"
                    value={fila.pagadoA}
                    onChange={(e) => onCampo(fila.localId, 'pagadoA', e.target.value)}
                    readOnly={bloqueado}
                    className={inputCls(!bloqueado)}
                    style={{ minWidth: 120 }}
                  />
                </td>
                {/* CONCEPTO */}
                <td className="px-1 py-1">
                  <input
                    type="text"
                    placeholder="Concepto"
                    value={fila.concepto}
                    onChange={(e) => onCampo(fila.localId, 'concepto', e.target.value)}
                    readOnly={bloqueado}
                    className={inputCls(!bloqueado)}
                    style={{ minWidth: 100 }}
                  />
                </td>
                {/* No RECIBO */}
                <td className="px-1 py-1">
                  <input
                    type="text"
                    placeholder="No. recibo"
                    value={fila.noRecibo}
                    onChange={(e) => onCampo(fila.localId, 'noRecibo', e.target.value)}
                    readOnly={bloqueado}
                    className={inputCls(!bloqueado)}
                    style={{ minWidth: 80 }}
                  />
                </td>
                {/* CENTRO COSTOS */}
                <td className="px-1 py-1">
                  {bloqueado ? (
                    <span className="block px-1.5 py-1 text-xs text-gray-600" style={{ minWidth: 130 }}>
                      {centrosCosto.find(c => c.id === fila.centroCostoId)?.nombre || '—'}
                    </span>
                  ) : (
                    <select
                      value={fila.centroCostoId}
                      onChange={(e) => {
                        onCampo(fila.localId, 'centroCostoId', e.target.value);
                        onCampo(fila.localId, 'centroOperacionId', '');
                      }}
                      className="w-full rounded px-1.5 py-1 text-xs text-gray-800 border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none bg-transparent"
                      style={{ minWidth: 130 }}
                    >
                      <option value="">-- Seleccionar --</option>
                      {centrosCosto.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  )}
                </td>
                {/* CENTRO OPERACION */}
                <td className="px-1 py-1">
                  {bloqueado ? (
                    <span className="block px-1.5 py-1 text-xs text-gray-600" style={{ minWidth: 140 }}>
                      {centrosOperacion.find(c => c.id === fila.centroOperacionId)?.nombre || '—'}
                    </span>
                  ) : (
                    <select
                      value={fila.centroOperacionId}
                      onChange={(e) => onCampo(fila.localId, 'centroOperacionId', e.target.value)}
                      disabled={!fila.centroCostoId}
                      className="w-full rounded px-1.5 py-1 text-xs text-gray-800 border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none bg-transparent disabled:opacity-50"
                      style={{ minWidth: 140 }}
                    >
                      <option value="">-- Seleccionar --</option>
                      {centrosOperacion
                        .filter(c => !fila.centroCostoId || c.centro_costo_id === fila.centroCostoId)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                  )}
                </td>
                {/* CUENTA CONTABLE */}
                <td className="px-1 py-1">
                  {bloqueado ? (
                    <span className="block px-1.5 py-1 text-xs text-gray-600" style={{ minWidth: 130 }}>
                      {cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)
                        ? `${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.codigo} - ${cuentasAuxiliares.find(c => c.id === fila.cuentaAuxiliarId)!.descripcion}`
                        : '—'}
                    </span>
                  ) : (
                    <select
                      value={fila.cuentaAuxiliarId}
                      onChange={(e) => onCampo(fila.localId, 'cuentaAuxiliarId', e.target.value)}
                      className="w-full rounded px-1.5 py-1 text-xs text-gray-800 border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white focus:outline-none bg-transparent"
                      style={{ minWidth: 130 }}
                    >
                      <option value="">-- Seleccionar --</option>
                      {cuentasAuxiliares.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>
                      ))}
                    </select>
                  )}
                </td>
                {/* VALOR PAGADO */}
                <td className="px-1 py-1">
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={fila.valorPagado}
                      onChange={(e) => onCampo(fila.localId, 'valorPagado', e.target.value)}
                      readOnly={bloqueado}
                      className={`${inputCls(!bloqueado)} pl-4 pr-1.5 text-right`}
                      style={{ minWidth: 80 }}
                    />
                  </div>
                </td>
                {/* SOPORTE */}
                <td className="px-2 py-1" style={{ minWidth: 220 }}>
                  <div className="flex flex-col gap-1">
                    {/* Archivos guardados en BD */}
                    {fila.archivos.map((arch) => (
                      <div key={arch.id} className="flex items-center gap-1 w-full min-w-0">
                        <button
                          type="button"
                          onClick={() => onVerArchivo(fila.localId, arch.id)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded min-w-0 flex-1 overflow-hidden hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: '#e0f5f7', color: '#00829a', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                          title={arch.filename}
                        >
                          {arch.filename.toLowerCase().endsWith('.pdf')
                            ? <FileText className="w-3.5 h-3.5 shrink-0" />
                            : <FileImage className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate text-xs">{arch.filename}</span>
                        </button>
                        {!bloqueado && (
                          <button
                            type="button"
                            onClick={() => onQuitarArchivoGuardado(fila.localId, arch.id)}
                            className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {/* Archivos pendientes de subir */}
                    {fila.pendingFiles.map((pf) => (
                      <div key={pf.localKey} className="flex items-center gap-1 w-full min-w-0">
                        <div
                          className="flex items-center gap-1.5 px-2 py-1 rounded min-w-0 flex-1 overflow-hidden"
                          style={{ backgroundColor: '#fef3c7', color: '#92400e', fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                          title={pf.file.name}
                        >
                          {pf.file.name.toLowerCase().endsWith('.pdf')
                            ? <FileText className="w-3.5 h-3.5 shrink-0" />
                            : <FileImage className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate text-xs">{pf.file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onQuitarArchivoPendiente(fila.localId, pf.localKey)}
                          className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {/* Boton adjuntar — maximo 2 archivos en total */}
                    {!bloqueado && (fila.archivos.length + fila.pendingFiles.length) < 2 && (
                      <label
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer hover:opacity-80 whitespace-nowrap text-xs font-semibold"
                        style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', position: 'relative' }}
                      >
                        <Upload className="w-3 h-3" />
                        Adjuntar
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
                    {/* Sin soporte (bloqueado y sin archivos) */}
                    {bloqueado && fila.archivos.length === 0 && (
                      <span className="text-xs text-gray-300 italic" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                        Sin soporte
                      </span>
                    )}
                  </div>
                </td>
                {/* Eliminar fila */}
                {!bloqueado && (
                  <td className="py-1 text-center" style={{ width: 40, minWidth: 40 }}>
                    <button
                      type="button"
                      onClick={() => onEliminarFila(fila.localId)}
                      disabled={saving}
                      className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {/* Fila de totales */}
            <tr className="border-t-2 border-gray-300" style={{ backgroundColor: '#f0fdf4' }}>
              <td
                colSpan={8}
                className="px-3 py-2 text-right font-bold text-gray-700"
                style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', fontSize: 12 }}
              >
                TOTAL
              </td>
              <td
                className="px-2 py-2 text-right font-bold"
                style={{ color: '#00829a', fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', fontSize: 12 }}
              >
                $ {totalCalculado.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
              </td>
              <td />
              {!bloqueado && <td />}
            </tr>
          </tbody>
        </table>
      </div>
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
      </div>
    );
  }

  const estadoUI = apiToUI(paquete.estado);
  const bloqueado = !['borrador', 'devuelto'].includes(paquete.estado);

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
    <div className="w-full max-w-7xl mx-auto">
      {/* Cabecera */}
      <div className="mb-5 space-y-2">
        {/* Fila 1: Volver + botones */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onCerrar}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Volver
          </button>

          {/* Botones de accion */}
          <div className="flex items-center gap-2">
            {(esBorrador || esDevuelto) ? (
              <>
                {esBorrador && (
                  <button
                    onClick={handleGuardarBorrador}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar borrador
                  </button>
                )}
                <button
                  onClick={handleEnviar}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {esDevuelto ? 'Reenviar corregido' : 'Enviar para revision'}
                </button>
              </>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed opacity-40"
                style={{ backgroundColor: '#e5e7eb', color: '#6b7280', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                title="Ya enviado, no se puede editar"
              >
                <Send className="w-4 h-4" />
                Enviado
              </div>
            )}
          </div>
        </div>

        {/* Fila 2: Info del paquete */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-300">|</span>
          <div>
            <span
              style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
              className="text-base font-bold"
            >
              {formatSemanaLabel(paquete.semana)}
            </span>
            <span
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              className="text-sm text-gray-400 ml-2"
            >
              {formatRango(paquete.fecha_inicio, paquete.fecha_fin)}
            </span>
          </div>
          <EstadoBadge estado={estadoUI} />
          {paquete.fecha_envio && (
            <span
              className="flex items-center gap-1 text-xs text-gray-400"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Enviado {fmtFecha(paquete.fecha_envio.slice(0, 10))}
            </span>
          )}
          <span
            className="flex items-center gap-1 text-xs text-gray-500"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            <Banknote className="w-3.5 h-3.5" />
            {fmtMonto(paquete.monto_total)}
          </span>
        </div>
      </div>

      <div
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Pipeline */}
        <div>
          <p
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            className="text-xs text-gray-400 uppercase tracking-wide mb-3"
          >
            Flujo de legalizacion
          </p>
          <PipelineEstado estado={estadoUI} />
        </div>

        {/* Alerta devuelto */}
        {esDevuelto && comentarioDevolucion && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p
                style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                className="text-sm text-red-700 font-semibold mb-1"
              >
                Observacion del administrador
              </p>
              <p
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                className="text-sm text-red-600"
              >
                {comentarioDevolucion.texto}
              </p>
            </div>
          </div>
        )}

        {/* Nota estado enviado */}
        {['En revision', 'Aprobado', 'Pagado'].includes(estadoUI) && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              className="text-xs text-blue-600"
            >
              {estadoUI === 'En revision' &&
                'Tu paquete esta siendo revisado. Los datos no pueden modificarse hasta recibir respuesta.'}
              {estadoUI === 'Aprobado' &&
                'Tu legalizacion fue aprobada. El pago esta siendo procesado.'}
              {estadoUI === 'Pagado' &&
                'Este paquete fue pagado y legalizado exitosamente.'}
            </p>
          </div>
        )}

        {/* Tabla de gastos */}
        <TablaGastos
          filas={gastos}
          bloqueado={bloqueado}
          saving={saving}
          centrosCosto={centrosCosto}
          centrosOperacion={centrosOperacion}
          cuentasAuxiliares={cuentasAuxiliares}
          onCampo={handleCampo}
          onAgregarFila={handleAgregarFila}
          onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar}
          onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente}
          onVerArchivo={handleVerArchivo}
        />
      </div>
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
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
            className="text-xl font-bold text-gray-900"
          >
            Nuevo paquete semanal
          </h3>
          <p
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            className="text-sm text-gray-400 mt-0.5"
          >
            Agrupa tus gastos de la semana y adjunta los soportes
          </p>
        </div>
        <button
          onClick={onCerrar}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Semana */}
        <div className="max-w-sm">
          <label
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            className="block text-sm text-gray-700 mb-1.5"
          >
            Semana de gastos <span className="text-red-500">*</span>
          </label>
          <input
            type="week"
            value={semana}
            onChange={(e) => setSemana(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          />
          <p
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            className="text-xs text-gray-400 mt-1"
          >
            El envio formal debe realizarse antes del jueves de cada semana.
          </p>
        </div>

        {/* Tabla de gastos */}
        <TablaGastos
          filas={filas}
          bloqueado={false}
          saving={saving}
          centrosCosto={centrosCosto}
          centrosOperacion={centrosOperacion}
          cuentasAuxiliares={cuentasAuxiliares}
          onCampo={handleCampo}
          onAgregarFila={handleAgregarFila}
          onEliminarFila={handleEliminarFila}
          onAdjuntar={handleAdjuntar}
          onQuitarArchivoGuardado={handleQuitarArchivoGuardado}
          onQuitarArchivoPendiente={handleQuitarArchivoPendiente}
          onVerArchivo={() => {}}
        />

        {totalCalculado > 0 && (
          <p
            className="text-xs text-gray-400"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
          >
            Monto total calculado:{' '}
            <strong style={{ color: '#00829a' }}>
              ${totalCalculado.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
            </strong>
          </p>
        )}

        {/* Nota borrador */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            className="text-xs text-amber-700"
          >
            El paquete se guardara como <strong>Borrador</strong> hasta que lo envies. Solo tu puedes verlo en ese estado.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCerrar}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear paquete
          </button>
        </div>
      </div>
    </div>
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

  // Activos: borrador o devuelto
  const activos = paquetes.filter((p) =>
    ['borrador', 'devuelto'].includes(p.estado)
  );
  // Historial: el resto
  const historial = paquetes.filter((p) =>
    !['borrador', 'devuelto'].includes(p.estado)
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h1
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
            className="text-lg font-bold text-gray-900 leading-tight"
          >
            Legalizacion
          </h1>
          <p
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            className="text-xs text-gray-500 mt-0.5"
          >
            Modulo de Gastos
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={irALista}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: vista === 'lista' ? '#e0f5f7' : 'transparent',
              color: vista === 'lista' ? '#00829a' : '#6b7280',
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-lg transition-all"
          >
            <PackagePlus className="w-4 h-4 shrink-0" />
            Mis paquetes
            {activos.length > 0 && (
              <span
                className="ml-auto text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white"
                style={{ backgroundColor: '#00829a' }}
              >
                {activos.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setVista('historial');
              setPaqueteActivo(null);
            }}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: vista === 'historial' ? '#e0f5f7' : 'transparent',
              color: vista === 'historial' ? '#00829a' : '#6b7280',
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-lg transition-all"
          >
            <History className="w-4 h-4 shrink-0" />
            Historial de envios
            {historial.length > 0 && (
              <span
                className="ml-auto text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center text-white"
                style={{ backgroundColor: '#6b7280' }}
              >
                {historial.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: vista === 'nuevo' ? '#e0f5f7' : 'transparent',
              color: vista === 'nuevo' ? '#00829a' : '#6b7280',
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-lg transition-all"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Nuevo paquete
          </button>
        </nav>

        {/* Usuario */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                style={{ backgroundColor: '#00829a' }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              >
                {user?.nombre?.charAt(0)?.toUpperCase() ?? 'T'}
              </div>
              <div className="min-w-0">
                <p
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  className="text-sm text-gray-900 truncate"
                >
                  {user?.nombre ?? 'Tecnico'}
                </p>
                <p
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                  className="text-xs text-gray-400 truncate"
                >
                  {user?.area?.nombre ?? 'Campo'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Cerrar sesion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <div>
            <h2
              style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
              className="text-2xl font-bold text-gray-900"
            >
              {vista === 'nuevo'
                ? 'Nuevo paquete semanal'
                : vista === 'detalle'
                ? 'Detalle del paquete'
                : vista === 'historial'
                ? 'Historial de envios'
                : 'Mis Paquetes de Gastos'}
            </h2>
            <p
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              className="text-sm text-gray-400 mt-0.5"
            >
              {vista === 'nuevo'
                ? 'Agrupa tus gastos de la semana y adjunta los soportes'
                : vista === 'detalle'
                ? 'Revisa y edita tu legalizacion semanal'
                : vista === 'historial'
                ? 'Paquetes enviados para revision o aprobados'
                : 'Organiza y envia tus legalizaciones semanales'}
            </p>
          </div>
          {(vista === 'lista' || vista === 'historial') && (
            <button
              onClick={() => { setVista('nuevo'); setPaqueteActivo(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              <Plus className="w-4 h-4" />
              Nuevo paquete semanal
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-8">
          {vista === 'nuevo' && (
            <NuevoPaqueteForm
              onCerrar={irALista}
              onCreado={(id) => {
                setPaqueteActivo(id);
                setVista('detalle');
              }}
            />
          )}

          {vista === 'detalle' && paqueteActivo && (
            <DetallePaquete
              paqueteId={paqueteActivo}
              onCerrar={irALista}
            />
          )}

          {vista === 'historial' && (
            <div className="max-w-2xl">
              {loading && (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
                </div>
              )}
              {!loading && historial.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <History className="w-12 h-12 mb-3 opacity-30" />
                  <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm">
                    No hay paquetes enviados todavia
                  </p>
                </div>
              )}
              {!loading && historial.length > 0 && (
                <div className="flex flex-col gap-3">
                  {historial.map((p) => {
                    const estadoUI = apiToUI(p.estado);
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                        className="w-full text-left bg-white rounded-xl border transition-all p-5 hover:shadow-md"
                        style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p
                              style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                              className="text-sm font-bold"
                            >
                              {formatSemanaLabel(p.semana)}
                            </p>
                            <p
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                              className="text-xs text-gray-400 mt-0.5"
                            >
                              {formatRango(p.fecha_inicio, p.fecha_fin)}
                            </p>
                          </div>
                          <EstadoBadge estado={estadoUI} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            {fmtMonto(p.monto_total)}
                          </span>
                          {p.fecha_envio && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Enviado {fmtFecha(p.fecha_envio.slice(0, 10))}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end mt-2">
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {vista === 'lista' && (
            <div className="space-y-8 max-w-2xl">
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
                </div>
              )}

              {/* Paquetes activos */}
              {!loading && (
                <>
                  {activos.length > 0 && (
                    <div>
                      <p
                        style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        className="text-xs text-gray-400 uppercase tracking-wide mb-3"
                      >
                        Legalizaciones activas
                      </p>
                      <div className="flex flex-col gap-3">
                        {activos.map((p) => {
                          const estadoUI = apiToUI(p.estado);
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                              className="w-full text-left bg-white rounded-xl border transition-all p-5 hover:shadow-md"
                              style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <p
                                    style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                                    className="text-sm font-bold"
                                  >
                                    {formatSemanaLabel(p.semana)}
                                  </p>
                                  <p
                                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                                    className="text-xs text-gray-400 mt-0.5"
                                  >
                                    {formatRango(p.fecha_inicio, p.fecha_fin)}
                                  </p>
                                </div>
                                <EstadoBadge estado={estadoUI} />
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Banknote className="w-3 h-3" />
                                  {fmtMonto(p.monto_total)}
                                </span>
                                {p.fecha_envio && (
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    Enviado {fmtFecha(p.fecha_envio.slice(0, 10))}
                                  </span>
                                )}
                              </div>
                              {p.estado === 'devuelto' && p.comentario_devolucion && (
                                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                  <p
                                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                                    className="text-xs text-red-600 line-clamp-2"
                                  >
                                    {p.comentario_devolucion}
                                  </p>
                                </div>
                              )}
                              <div className="flex justify-end mt-2">
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Historial */}
                  {historial.length > 0 && (
                    <div>
                      <p
                        style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                        className="text-xs text-gray-400 uppercase tracking-wide mb-3"
                      >
                        Historial de envios
                      </p>
                      <div className="flex flex-col gap-3">
                        {historial.map((p) => {
                          const estadoUI = apiToUI(p.estado);
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setPaqueteActivo(p.id); setVista('detalle'); }}
                              className="w-full text-left bg-white rounded-xl border transition-all p-5 hover:shadow-md"
                              style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <p
                                    style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif', color: '#00829a' }}
                                    className="text-sm font-bold"
                                  >
                                    {formatSemanaLabel(p.semana)}
                                  </p>
                                  <p
                                    style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                                    className="text-xs text-gray-400 mt-0.5"
                                  >
                                    {formatRango(p.fecha_inicio, p.fecha_fin)}
                                  </p>
                                </div>
                                <EstadoBadge estado={estadoUI} />
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {p.total_documentos} doc{p.total_documentos !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Banknote className="w-3 h-3" />
                                  {fmtMonto(p.monto_total)}
                                </span>
                                {p.fecha_envio && (
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    Enviado {fmtFecha(p.fecha_envio.slice(0, 10))}
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-end mt-2">
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Estado vacío */}
                  {activos.length === 0 && historial.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-3">
                      <History className="w-16 h-16" />
                      <p className="text-sm text-gray-400">
                        Sin paquetes todavia. Crea tu primer paquete semanal.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
