import { useState, useEffect } from 'react';
import {
  Plus, Loader2, X, AlertCircle, CheckCircle2, Clock,
  XCircle, Banknote, ArrowRight, ArrowLeft, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AnticipoOut, AnticipoListItem, AnticipoEstado,
  AprobadorGerencia,
  listAnticipos, listMisAnticipos, createAnticipo,
  getAnticipo, desembolsarAnticipo, cerrarAnticipo,
  getAprobadoresActivos,
  getUserRoleCode,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { DetallePaquete } from '../pages/LegalizacionPage';
import { DetalleAuditoriaTes } from './TesoreriaPaquetesView';

// ============================================================
// Helpers
// ============================================================

function fmtMonto(n: number | string): string {
  return `$ ${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const SEMANAS_OPCIONES: { label: string; value: string }[] = (() => {
  const hoy = new Date();
  const opciones: { label: string; value: string }[] = [];
  for (let i = -2; i <= 4; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i * 7);
    const iso = getISOWeek(d);
    const match = iso.match(/W(\d+)/);
    const label = match ? `Semana ${parseInt(match[1], 10)} (${iso})` : iso;
    opciones.push({ label, value: iso });
  }
  return opciones;
})();

// ============================================================
// Badge de estado
// ============================================================

const ESTADO_CONFIG: Record<AnticipoEstado, { label: string; bg: string; color: string; border: string; icon: React.ReactNode }> = {
  pendiente:    { label: 'Pendiente aprobación', bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: <Clock className="w-3 h-3" /> },
  aprobado:     { label: 'Aprobado',             bg: 'rgba(20,170,184,0.08)', color: '#00829a', border: '#14aab8', icon: <CheckCircle2 className="w-3 h-3" /> },
  rechazado:    { label: 'Rechazado',            bg: '#fef2f2', color: '#991b1b', border: '#fecaca', icon: <XCircle className="w-3 h-3" /> },
  desembolsado: { label: 'En legalización',      bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: <Banknote className="w-3 h-3" /> },
  cerrado:      { label: 'Cerrado',              bg: '#f0fdf4', color: '#15803d', border: '#86efac', icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PKG_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  borrador:     { label: 'Llenando gastos',  bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  devuelto:     { label: 'Devuelto',         bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  aprobado:     { label: 'En Radicación',   bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
  en_tesoreria: { label: 'En Tesorería',     bg: 'rgba(20,170,184,0.08)', color: '#00829a', border: '#14aab8' },
  pagado:       { label: 'Pagado',           bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
};

function EstadoBadge({ estado, paqueteEstado }: { estado: AnticipoEstado; paqueteEstado?: string | null }) {
  // Si está en legalización y hay estado de paquete, mostrar el del paquete
  if (estado === 'desembolsado' && paqueteEstado && PKG_BADGE[paqueteEstado]) {
    const pkg = PKG_BADGE[paqueteEstado];
    const icon = paqueteEstado === 'en_tesoreria' ? <CheckCircle2 className="w-3 h-3" />
      : paqueteEstado === 'devuelto' ? <XCircle className="w-3 h-3" />
      : <Banknote className="w-3 h-3" />;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: pkg.bg, color: pkg.color, border: `1px solid ${pkg.border}` }}>
        {icon} {pkg.label}
      </span>
    );
  }
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.pendiente;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

const ESTADO_PKG: Record<string, { label: string; color: string }> = {
  borrador:     { label: 'Borrador',     color: '#6b7280' },
  en_revision:  { label: 'En revisión',  color: '#0284c7' },
  devuelto:     { label: 'Devuelto',     color: '#dc2626' },
  aprobado:     { label: 'Aprobado',     color: '#16a34a' },
  en_tesoreria: { label: 'En Tesorería', color: '#00829a' },
  pagado:       { label: 'Pagado',       color: '#15803d' },
};

// ============================================================
// Tarjeta de anticipo
// ============================================================

function AnticipoCard({
  anticipo,
  onClick,
  isTesoreria = false,
}: {
  anticipo: AnticipoListItem;
  onClick: () => void;
  isTesoreria?: boolean;
}) {
  const hayDiferencia = anticipo.estado === 'desembolsado' &&
    anticipo.monto_legalizado > 0 &&
    anticipo.diferencia > 0;
  const esLegalizacion = anticipo.estado === 'desembolsado';
  const paqueteEditable = !anticipo.paquete_estado ||
    anticipo.paquete_estado === 'borrador' ||
    anticipo.paquete_estado === 'devuelto';
  const pendienteDesembolso = isTesoreria && anticipo.estado === 'aprobado';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 border transition-all"
      style={{
        background: '#fff',
        boxShadow: '0 1px 6px rgba(0,130,154,0.06)',
        borderColor: pendienteDesembolso ? '#14aab8'
          : esLegalizacion ? '#6ee7b7'
          : '#f3f4f6',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">{anticipo.folio}</p>
          <p className="text-sm font-bold text-gray-900 truncate">{anticipo.solicitante.nombre}</p>
          {anticipo.descripcion && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{anticipo.descripcion}</p>
          )}
        </div>
        <EstadoBadge estado={anticipo.estado} paqueteEstado={anticipo.paquete_estado} />
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div>
          <p className="text-xs text-gray-400">Anticipo</p>
          <p className="font-bold text-gray-900">{fmtMonto(anticipo.monto)}</p>
        </div>
        {anticipo.estado === 'desembolsado' && (
          <div>
            <p className="text-xs text-gray-400">Legalizado</p>
            <p className="font-bold" style={{ color: '#15803d' }}>{fmtMonto(anticipo.monto_legalizado)}</p>
          </div>
        )}
        {anticipo.aprobador && (
          <div className="ml-auto text-xs text-gray-400 text-right">
            <p>Aprobador</p>
            <p className="font-medium text-gray-600">{anticipo.aprobador.nombre}</p>
          </div>
        )}
      </div>

      {/* CTA según estado del paquete */}
      {esLegalizacion && paqueteEditable && (
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Banknote className="w-3.5 h-3.5 shrink-0" style={{ color: '#15803d' }} />
          <p className="text-xs font-semibold flex-1" style={{ color: '#15803d' }}>
            {anticipo.paquete_estado === 'devuelto'
              ? 'Devuelto por Tesorería — clic para corregir'
              : 'Clic para registrar tus gastos y legalizar'}
          </p>
          <ArrowRight className="w-3.5 h-3.5" style={{ color: '#15803d' }} />
        </div>
      )}
      {esLegalizacion && anticipo.paquete_estado === 'aprobado' && (
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: '#faf5ff', border: '1px solid #ddd6fe' }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />
          <p className="text-xs font-semibold" style={{ color: '#7c3aed' }}>
            En Radicación — pendiente de envío a Tesorería
          </p>
        </div>
      )}
      {/* Para empleado: paquete en tesorería */}
      {esLegalizacion && !isTesoreria && anticipo.paquete_estado === 'en_tesoreria' && (
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(20,170,184,0.08)', border: '1px solid #14aab8' }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />
          <p className="text-xs font-semibold" style={{ color: '#00829a' }}>
            En Tesorería — pendiente de pago
          </p>
        </div>
      )}
      {/* Para Tesorería: paquete en_tesoreria pendiente de auditar/pagar */}
      {isTesoreria && anticipo.paquete_estado === 'en_tesoreria' && (
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(20,170,184,0.08)', border: '1px solid #14aab8' }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />
          <p className="text-xs font-semibold flex-1" style={{ color: '#00829a' }}>
            Clic para auditar y registrar el pago
          </p>
          <ArrowRight className="w-3.5 h-3.5" style={{ color: '#00829a' }} />
        </div>
      )}

      {/* CTA Tesorería: desembolsar */}
      {pendienteDesembolso && (
        <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(20,170,184,0.08)', border: '1px solid #14aab8' }}>
          <Banknote className="w-3.5 h-3.5 shrink-0" style={{ color: '#00829a' }} />
          <p className="text-xs font-semibold flex-1" style={{ color: '#00829a' }}>
            Clic para desembolsar este anticipo
          </p>
          <ArrowRight className="w-3.5 h-3.5" style={{ color: '#00829a' }} />
        </div>
      )}

      {hayDiferencia && (
        <div className="mt-2 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <p className="text-xs text-orange-700 font-semibold">
            Pendiente por legalizar: {fmtMonto(anticipo.diferencia)}
          </p>
        </div>
      )}

      {anticipo.estado === 'rechazado' && (
        <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-semibold">Solicitud rechazada</p>
        </div>
      )}
    </button>
  );
}

// ============================================================
// Modal detalle
// ============================================================

function DetalleModal({
  anticipo,
  onClose,
  onDesembolsar,
  onCerrar,
  isTesoreria,
}: {
  anticipo: AnticipoOut;
  onClose: () => void;
  onDesembolsar?: (semana: string) => Promise<void>;
  onCerrar?: () => Promise<void>;
  isTesoreria: boolean;
}) {
  const [semanaDesembolso, setSemanaDesembolso] = useState(SEMANAS_OPCIONES[2]?.value ?? '');
  const [saving, setSaving] = useState(false);

  async function handleDesembolsar() {
    if (!onDesembolsar) return;
    setSaving(true);
    try {
      await onDesembolsar(semanaDesembolso);
    } finally {
      setSaving(false);
    }
  }

  async function handleCerrar() {
    if (!onCerrar) return;
    setSaving(true);
    try {
      await onCerrar();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">{anticipo.folio}</p>
            <h2 className="text-lg font-bold text-gray-900">{anticipo.solicitante.nombre}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <EstadoBadge estado={anticipo.estado} />
            <span className="text-xs text-gray-400">{fmtFecha(anticipo.created_at)}</span>
          </div>

          {/* Info principal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 bg-gray-50">
              <p className="text-xs text-gray-400 mb-1">Monto solicitado</p>
              <p className="text-lg font-bold text-gray-900">{fmtMonto(anticipo.monto)}</p>
            </div>
            {anticipo.estado === 'desembolsado' && (
              <div className="rounded-xl p-3 bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">Legalizado</p>
                <p className="text-lg font-bold" style={{ color: '#15803d' }}>
                  {fmtMonto(anticipo.monto_legalizado)}
                </p>
              </div>
            )}
          </div>

          {/* Descripción */}
          {anticipo.descripcion && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Descripción</p>
              <p className="text-sm text-gray-700">{anticipo.descripcion}</p>
            </div>
          )}

          {/* Aprobador */}
          {anticipo.aprobador && (
            <div className="rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Aprobador (jefe directo)</p>
              <p className="text-sm font-semibold text-gray-800">{anticipo.aprobador.nombre}</p>
              <p className="text-xs text-gray-500">{anticipo.aprobador.cargo} · {anticipo.aprobador.email}</p>
              {anticipo.fecha_aprobacion && (
                <p className="text-xs text-gray-400 mt-1">
                  Aprobado el {fmtFecha(anticipo.fecha_aprobacion)}
                </p>
              )}
            </div>
          )}

          {/* Rechazo */}
          {anticipo.estado === 'rechazado' && anticipo.motivo_rechazo && (
            <div className="rounded-xl p-3 bg-red-50 border border-red-200">
              <p className="text-xs font-semibold text-red-700 mb-1">Motivo del rechazo</p>
              <p className="text-sm text-red-800">{anticipo.motivo_rechazo}</p>
            </div>
          )}

          {/* Desembolso */}
          {anticipo.fecha_desembolso && (
            <div className="rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Desembolso</p>
              <p className="text-sm text-gray-700">
                {fmtFecha(anticipo.fecha_desembolso)}
                {anticipo.desembolsado_por && ` — por ${anticipo.desembolsado_por.nombre}`}
              </p>
            </div>
          )}

          {/* Paquetes */}
          {anticipo.paquetes.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Paquetes de gastos</p>
              <div className="space-y-2">
                {anticipo.paquetes.map(p => {
                  const pkgCfg = ESTADO_PKG[p.estado] ?? { label: p.estado, color: '#6b7280' };
                  return (
                    <div key={p.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2 border border-gray-100 bg-gray-50">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{p.folio || p.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500">Semana {p.semana}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold" style={{ color: pkgCfg.color }}>{pkgCfg.label}</span>
                        <p className="text-xs text-gray-700">{fmtMonto(Number(p.monto_total))}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acción: Tesorería desembolsa */}
          {isTesoreria && anticipo.estado === 'aprobado' && onDesembolsar && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-2">Desembolsar anticipo</p>
              <p className="text-xs text-gray-500 mb-3">
                Selecciona la semana del paquete de gastos que se creará para el empleado.
              </p>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#14aab8]/30"
                value={semanaDesembolso}
                onChange={e => setSemanaDesembolso(e.target.value)}
              >
                {SEMANAS_OPCIONES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={handleDesembolsar}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#00829a' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Confirmar desembolso
              </button>
            </div>
          )}

          {/* Acción: Tesorería cierra manualmente */}
          {isTesoreria && anticipo.estado === 'desembolsado' && onCerrar && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleCerrar}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#15803d' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Cerrar anticipo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal crear solicitud (empleado)
// ============================================================

function CrearAnticipoModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [aprobadores, setAprobadores] = useState<AprobadorGerencia[]>([]);
  const [aprobadorId, setAprobadorId] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAprobadores, setLoadingAprobadores] = useState(true);

  useEffect(() => {
    getAprobadoresActivos()
      .then(setAprobadores)
      .catch(() => toast.error('Error cargando aprobadores'))
      .finally(() => setLoadingAprobadores(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aprobadorId) { toast.error('Selecciona un aprobador (jefe directo)'); return; }
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      await createAnticipo({
        aprobador_id: aprobadorId,
        monto: montoNum,
        descripcion: descripcion.trim() || undefined,
      });
      toast.success('Solicitud enviada. Tu jefe recibirá un correo para aprobarla.');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.detail || 'Error al crear la solicitud');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Solicitar anticipo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Aprobador */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Jefe directo (aprobador) *
            </label>
            {loadingAprobadores ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            ) : (
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14aab8]/30"
                value={aprobadorId}
                onChange={e => setAprobadorId(e.target.value)}
                required
              >
                <option value="">Selecciona un aprobador</option>
                {aprobadores.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} — {a.cargo}</option>
                ))}
              </select>
            )}
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto (COP) *</label>
            <input
              type="number"
              min="1"
              step="any"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14aab8]/30"
              placeholder="ej: 500000"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#14aab8]/30"
              placeholder="¿Para qué es el anticipo?"
              rows={3}
              maxLength={500}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-400">
            Tu jefe recibirá un correo con un enlace para aprobar o rechazar esta solicitud.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#00829a' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Vista principal
// ============================================================

const FILTROS_EMPLEADO: { label: string; value: string }[] = [
  { label: 'Todos', value: '' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Aprobados', value: 'aprobado' },
  { label: 'Rechazados', value: 'rechazado' },
  { label: 'En legalización', value: 'desembolsado' },
  { label: 'Cerrados', value: 'cerrado' },
];

const FILTROS_TESORERIA: { label: string; value: string }[] = [
  { label: 'Todos', value: '' },
  { label: 'Por desembolsar', value: 'aprobado' },
  { label: 'En legalización', value: 'desembolsado' },
  { label: 'Cerrados', value: 'cerrado' },
];

export function AnticiposView() {
  const { user } = useAuth();
  const roleCode = getUserRoleCode(user);
  const isTesoreria = ['tesoreria', 'tes', 'admin'].includes(roleCode);

  const [anticipos, setAnticipos] = useState<AnticipoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Tesorería empieza en "Por desembolsar" para ver anticipos aprobados pendientes
  const [filtroEstado, setFiltroEstado] = useState(isTesoreria ? 'aprobado' : '');
  const [selected, setSelected] = useState<AnticipoOut | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  // paqueteActivo: empleado legaliza gastos inline
  const [paqueteActivo, setPaqueteActivo] = useState<string | null>(null);
  // paqueteTesoreriaActivo: Tesorería audita/paga un paquete de anticipo inline
  const [paqueteTesoreriaActivo, setPaqueteTesoreriaActivo] = useState<string | null>(null);
  const [aprobadores, setAprobadores] = useState<AprobadorGerencia[]>([]);

  const filtros = isTesoreria ? FILTROS_TESORERIA : FILTROS_EMPLEADO;

  async function cargar() {
    setLoading(true);
    try {
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const data = isTesoreria
        ? await listAnticipos(params)
        : await listMisAnticipos(params);
      setAnticipos(data.anticipos);
    } catch {
      toast.error('Error al cargar anticipos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroEstado]);

  useEffect(() => {
    getAprobadoresActivos().then(setAprobadores).catch(() => {});
  }, []);

  async function abrirDetalle(item: AnticipoListItem) {
    // Tesorería: anticipo con paquete en_tesoreria → abrir vista de auditoría/pago inline
    if (isTesoreria && item.paquete_estado === 'en_tesoreria') {
      setLoadingDetalle(true);
      try {
        const data = await getAnticipo(item.id);
        if (data.paquetes.length > 0) {
          setPaqueteTesoreriaActivo(data.paquetes[0].id);
          return;
        }
        setSelected(data);
      } catch {
        toast.error('Error al cargar el anticipo');
      } finally {
        setLoadingDetalle(false);
      }
      return;
    }

    // Empleado con anticipo desembolsado → abrir DetallePaquete inline
    if (!isTesoreria && item.estado === 'desembolsado') {
      setLoadingDetalle(true);
      try {
        const data = await getAnticipo(item.id);
        if (data.paquetes.length > 0) {
          setPaqueteActivo(data.paquetes[0].id);
          return;
        }
        // Sin paquete aún, mostrar detalle normal
        setSelected(data);
      } catch {
        toast.error('Error al cargar el anticipo');
      } finally {
        setLoadingDetalle(false);
      }
      return;
    }

    setLoadingDetalle(true);
    try {
      const data = await getAnticipo(item.id);
      setSelected(data);
    } catch {
      toast.error('Error al cargar detalle');
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function handleDesembolsar(semana: string) {
    if (!selected) return;
    try {
      await desembolsarAnticipo(selected.id, { semana });
      toast.success('Anticipo desembolsado y paquete creado.');
      setSelected(null);
      await cargar();
    } catch (err: any) {
      toast.error(err?.detail || 'Error al desembolsar');
      throw err;
    }
  }

  async function handleCerrar() {
    if (!selected) return;
    try {
      await cerrarAnticipo(selected.id);
      toast.success('Anticipo cerrado.');
      setSelected(null);
      await cargar();
    } catch (err: any) {
      toast.error(err?.detail || 'Error al cerrar');
      throw err;
    }
  }

  // Vista inline de auditoría Tesorería: DetalleAuditoriaTes embebido
  if (paqueteTesoreriaActivo) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
          <button
            onClick={() => { setPaqueteTesoreriaActivo(null); cargar(); }}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a anticipos
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-400">Auditoría y pago de anticipo</span>
        </div>
        <div className="flex-1 overflow-auto p-8">
          <DetalleAuditoriaTes
            paqueteId={paqueteTesoreriaActivo}
            onCerrar={() => { setPaqueteTesoreriaActivo(null); cargar(); }}
            onPagado={() => { setPaqueteTesoreriaActivo(null); cargar(); }}
          />
        </div>
      </div>
    );
  }

  // Vista inline de legalización: DetallePaquete embebido sin salir del layout
  if (paqueteActivo) {
    return (
      <div className="flex flex-col h-full">
        {/* Sub-header con botón volver */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white shrink-0">
          <button
            onClick={() => { setPaqueteActivo(null); cargar(); }}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a mis anticipos
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-400">Legalización de gastos</span>
        </div>
        {/* DetallePaquete ocupa el resto del espacio */}
        <div className="flex-1 overflow-auto">
          <DetallePaquete
            paqueteId={paqueteActivo}
            onCerrar={() => { setPaqueteActivo(null); cargar(); }}
            aprobadores={aprobadores}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Anticipos
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isTesoreria ? 'Gestión de anticipos — desembolso y seguimiento' : 'Tus solicitudes de anticipo'}
          </p>
        </div>
        {!isTesoreria && (
          <button
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#00829a' }}
          >
            <Plus className="w-4 h-4" /> Solicitar anticipo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 px-6 py-3 border-b border-gray-50 overflow-x-auto shrink-0">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroEstado(f.value)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={filtroEstado === f.value
              ? { background: '#00829a', color: '#fff' }
              : { background: '#f1f5f9', color: '#475569' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...
          </div>
        ) : anticipos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <Banknote className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {isTesoreria ? 'No hay anticipos pendientes' : 'Aún no tienes solicitudes'}
            </p>
            {!isTesoreria && (
              <button
                onClick={() => setShowCrear(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#00829a' }}
              >
                Crear primera solicitud
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {anticipos.map(a => (
              <AnticipoCard
                key={a.id}
                anticipo={a}
                isTesoreria={isTesoreria}
                onClick={() => abrirDetalle(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {loadingDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
      {selected && (
        <DetalleModal
          anticipo={selected}
          onClose={() => setSelected(null)}
          onDesembolsar={isTesoreria ? handleDesembolsar : undefined}
          onCerrar={isTesoreria ? handleCerrar : undefined}
          isTesoreria={isTesoreria}
        />
      )}

      {/* Modal crear solicitud */}
      {showCrear && (
        <CrearAnticipoModal
          onClose={() => setShowCrear(false)}
          onCreated={cargar}
        />
      )}
    </div>
  );
}
