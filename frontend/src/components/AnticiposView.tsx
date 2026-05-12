import { useState, useEffect } from 'react';
import {
  Plus, Loader2, X, AlertCircle, CheckCircle2, Clock,
  ChevronRight, Banknote, User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AnticipoOut, AnticipoListItem,
  listAnticipos, createAnticipo, getAnticipo, cerrarAnticipo,
  getUsers, UserDetail,
} from '../lib/api';

// ============================================================
// Helpers
// ============================================================

function fmtMonto(n: number): string {
  return `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
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
// Badge estado anticipo
// ============================================================

function EstadoBadge({ estado }: { estado: 'activo' | 'cerrado' }) {
  if (estado === 'cerrado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
        <CheckCircle2 className="w-3 h-3" /> Cerrado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
      <Clock className="w-3 h-3" /> Activo
    </span>
  );
}

// ============================================================
// Tarjeta de anticipo (lista)
// ============================================================

function AnticipoCard({
  anticipo,
  onClick,
}: {
  anticipo: AnticipoListItem;
  onClick: () => void;
}) {
  const diferencia = anticipo.diferencia;
  const conciliado = anticipo.monto_legalizado >= anticipo.monto;
  const hayDiferencia = anticipo.monto_legalizado > 0 && !conciliado;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 border border-gray-100 hover:border-[#14aab8]/40 transition-all"
      style={{ background: '#fff', boxShadow: '0 1px 6px rgba(0,130,154,0.06)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {anticipo.folio}
          </p>
          <p className="text-sm font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            {anticipo.asignado_a.nombre}
          </p>
          {anticipo.descripcion && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {anticipo.descripcion}
            </p>
          )}
        </div>
        <EstadoBadge estado={anticipo.estado} />
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Anticipo</p>
          <p className="font-bold text-gray-900">{fmtMonto(anticipo.monto)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Legalizado</p>
          <p className="font-bold" style={{ color: '#15803d' }}>
            {fmtMonto(anticipo.monto_legalizado)}
          </p>
        </div>
        {hayDiferencia && (
          <div>
            <p className="text-xs text-gray-400">Saldo pendiente</p>
            <p className="font-bold text-orange-600">{fmtMonto(Math.abs(diferencia))}</p>
          </div>
        )}
        <div className="ml-auto text-xs text-gray-400">
          {anticipo.total_paquetes} paquete{anticipo.total_paquetes !== 1 ? 's' : ''}
        </div>
      </div>

      {hayDiferencia && (
        <div className="mt-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <p className="text-xs text-orange-700 font-semibold"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Diferencia de {fmtMonto(Math.abs(diferencia))} — revisar con el colaborador
          </p>
        </div>
      )}
    </button>
  );
}

// ============================================================
// Modal detalle anticipo
// ============================================================

const ESTADO_PKG: Record<string, { label: string; color: string }> = {
  borrador:     { label: 'Borrador',      color: '#6b7280' },
  en_revision:  { label: 'En revisión',   color: '#0284c7' },
  devuelto:     { label: 'Devuelto',      color: '#dc2626' },
  aprobado:     { label: 'Aprobado',      color: '#16a34a' },
  en_tesoreria: { label: 'En Tesorería',  color: '#1d4ed8' },
  pagado:       { label: 'Pagado',        color: '#15803d' },
};

function DetalleModal({
  anticipoId,
  onClose,
  onCerrado,
}: {
  anticipoId: string;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const [anticipo, setAnticipo] = useState<AnticipoOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    getAnticipo(anticipoId)
      .then(setAnticipo)
      .catch(() => toast.error('Error al cargar el anticipo'))
      .finally(() => setLoading(false));
  }, [anticipoId]);

  const handleCerrar = async () => {
    if (!window.confirm('¿Cerrar este anticipo? Esta acción indica que el proceso ha concluido.')) return;
    setCerrando(true);
    try {
      const updated = await cerrarAnticipo(anticipoId);
      setAnticipo(updated);
      toast.success('Anticipo cerrado correctamente');
      onCerrado();
    } catch {
      toast.error('Error al cerrar el anticipo');
    } finally {
      setCerrando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Detalle del Anticipo
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00829a' }} />
          </div>
        ) : anticipo ? (
          <div className="p-5 space-y-5">
            {/* Info principal */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">{anticipo.folio}</p>
                <p className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                  {anticipo.asignado_a.nombre}
                </p>
                <p className="text-sm text-gray-500">{anticipo.asignado_a.email}</p>
                {anticipo.descripcion && (
                  <p className="text-sm text-gray-600 mt-1 italic">{anticipo.descripcion}</p>
                )}
              </div>
              <EstadoBadge estado={anticipo.estado} />
            </div>

            {/* Montos */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center"
                style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-xs text-gray-500 mb-1">Anticipo</p>
                <p className="text-base font-bold" style={{ color: '#0284c7' }}>
                  {fmtMonto(anticipo.monto)}
                </p>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-xs text-gray-500 mb-1">Legalizado</p>
                <p className="text-base font-bold" style={{ color: '#15803d' }}>
                  {fmtMonto(anticipo.monto_legalizado)}
                </p>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{
                  backgroundColor: anticipo.diferencia === 0 ? '#f0fdf4' : '#fff7ed',
                  border: `1px solid ${anticipo.diferencia === 0 ? '#bbf7d0' : '#fed7aa'}`,
                }}>
                <p className="text-xs text-gray-500 mb-1">Diferencia</p>
                <p className="text-base font-bold"
                  style={{ color: anticipo.diferencia === 0 ? '#15803d' : '#c2410c' }}>
                  {fmtMonto(Math.abs(anticipo.diferencia))}
                </p>
              </div>
            </div>

            {/* Paquetes */}
            {anticipo.paquetes.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2"
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  Paquetes de gastos
                </p>
                <div className="space-y-2">
                  {anticipo.paquetes.map((p) => {
                    const conf = ESTADO_PKG[p.estado] ?? { label: p.estado, color: '#6b7280' };
                    return (
                      <div key={p.id}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-gray-100"
                        style={{ backgroundColor: '#f9fafb' }}>
                        <div>
                          <p className="text-xs text-gray-400">{p.folio ?? p.id.slice(0, 8)}</p>
                          <p className="text-sm font-semibold text-gray-700">{p.semana}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold" style={{ color: conf.color }}>
                            {conf.label}
                          </p>
                          <p className="text-sm font-bold text-gray-900">{fmtMonto(p.monto_total)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Metadatos */}
            <p className="text-xs text-gray-400">
              Creado el {fmtFecha(anticipo.created_at)} por {anticipo.creado_por.nombre}
            </p>

            {/* Acción cerrar */}
            {anticipo.estado === 'activo' && (
              <button
                onClick={handleCerrar}
                disabled={cerrando}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(to right, #00829a, #14aab8)',
                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                  boxShadow: '0 4px 12px rgba(0,130,154,0.25)',
                }}
              >
                {cerrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Cerrar anticipo
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Modal crear anticipo
// ============================================================

function CrearAnticipoModal({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: () => void;
}) {
  const [usuarios, setUsuarios] = useState<UserDetail[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assigned_to_user_id: '',
    monto: '',
    descripcion: '',
    semana: SEMANAS_OPCIONES[2]?.value ?? '',
  });

  useEffect(() => {
    getUsers(0, 200)
      .then((r) => setUsuarios(r.items.filter((u) => u.is_active)))
      .catch(() => toast.error('Error al cargar usuarios'))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.assigned_to_user_id) { toast.error('Selecciona un colaborador'); return; }
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (!form.semana) { toast.error('Selecciona una semana'); return; }

    setSaving(true);
    try {
      await createAnticipo({
        assigned_to_user_id: form.assigned_to_user_id,
        monto,
        descripcion: form.descripcion.trim() || undefined,
        semana: form.semana,
      });
      toast.success('Anticipo creado correctamente. El colaborador verá el paquete en su sesión.');
      onCreado();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear el anticipo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Nuevo Anticipo
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Colaborador */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Colaborador *
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando usuarios...
              </div>
            ) : (
              <select
                value={form.assigned_to_user_id}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to_user_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00829a]"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              >
                <option value="">— Selecciona un colaborador —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.area ? `· ${u.area}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Monto del anticipo (COP) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00829a]"
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
              />
            </div>
          </div>

          {/* Semana */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Semana del paquete *
            </label>
            <select
              value={form.semana}
              onChange={(e) => setForm((f) => ({ ...f, semana: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00829a]"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            >
              {SEMANAS_OPCIONES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Descripción (opcional)
            </label>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Viaje a Cali, semana del evento..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#00829a]"
              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(to right, #00829a, #14aab8)',
                fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                boxShadow: '0 4px 12px rgba(0,130,154,0.25)',
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              Crear anticipo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Vista principal AnticiposView
// ============================================================

export function AnticiposView() {
  const [anticipos, setAnticipos] = useState<AnticipoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'cerrado'>('todos');
  const [showCrear, setShowCrear] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const estado = filtroEstado === 'todos' ? undefined : filtroEstado;
      const res = await listAnticipos({ limit: 200, estado });
      setAnticipos(res.anticipos);
    } catch {
      toast.error('Error al cargar los anticipos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900"
            style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            Anticipos
          </h2>
          <p className="text-sm text-gray-400 mt-0.5"
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            Anticipos entregados a colaboradores para legalización de gastos
          </p>
        </div>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(to right, #00829a, #14aab8)',
            fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
            boxShadow: '0 4px 12px rgba(0,130,154,0.25)',
          }}
        >
          <Plus className="w-4 h-4" />
          Nuevo anticipo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {(['todos', 'activo', 'cerrado'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroEstado(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: filtroEstado === f ? '#e0f5f7' : '#f3f4f6',
              color: filtroEstado === f ? '#00829a' : '#6b7280',
              border: filtroEstado === f ? '1px solid #14aab8' : '1px solid transparent',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#00829a' }} />
        </div>
      ) : anticipos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#f0f9ff' }}>
            <Banknote className="w-7 h-7" style={{ color: '#00829a' }} />
          </div>
          <p className="text-sm font-semibold text-gray-500"
            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            No hay anticipos registrados
          </p>
          <button
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(to right, #00829a, #14aab8)' }}
          >
            <Plus className="w-4 h-4" /> Crear el primero
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {anticipos.map((a) => (
            <AnticipoCard
              key={a.id}
              anticipo={a}
              onClick={() => setSelectedId(a.id)}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {showCrear && (
        <CrearAnticipoModal
          onClose={() => setShowCrear(false)}
          onCreado={() => { setShowCrear(false); cargar(); }}
        />
      )}

      {selectedId && (
        <DetalleModal
          anticipoId={selectedId}
          onClose={() => setSelectedId(null)}
          onCerrado={() => { setSelectedId(null); cargar(); }}
        />
      )}
    </div>
  );
}
