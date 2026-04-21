import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Users, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Building2, RefreshCw, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDashboardMetrics, getUsers, getAreas, getFacturas,
  DashboardMetrics, UserListItem, Area, FacturaListItem,
} from '../lib/api';

interface AreaStats {
  nombre: string;
  count: number;
}

export function AdminDashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [m, u, a, f] = await Promise.all([
        getDashboardMetrics(),
        getUsers(0, 200),
        getAreas(),
        getFacturas(0, 1000),
      ]);
      setMetrics(m);
      setUsuarios(u.items);
      setAreas(a);
      setFacturas(f.items);
    } catch {
      toast.error('Error al cargar datos del panel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const activos = usuarios.filter(u => u.is_active).length;
  const inactivos = usuarios.length - activos;

  // Stats by area
  const areaStats: AreaStats[] = areas.map(a => ({
    nombre: a.nombre,
    count: facturas.filter(f => f.area === a.nombre).length,
  })).filter(a => a.count > 0).sort((a, b) => b.count - a.count);

  // Stats by role
  const rolCounts: Record<string, number> = {};
  usuarios.forEach(u => { rolCounts[u.role] = (rolCounts[u.role] || 0) + 1; });

  const ROL_LABELS: Record<string, string> = {
    admin: 'Administrador', fact: 'Radicación', responsable: 'Responsable',
    contabilidad: 'Contabilidad', tesoreria: 'Tesorería', tes: 'Tesorería',
    gerencia: 'Gerencia', tecnico: 'Técnico Mant.', mant: 'Mantenimiento',
    direccion: 'Dirección',
  };

  // Recent facturas
  const recientes = [...facturas]
    .sort((a, b) => new Date(b.fecha_emision ?? '').getTime() - new Date(a.fecha_emision ?? '').getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,130,154,0.1)' }}>
            <TrendingUp size={26} style={{ color: '#00829a' }} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Panel de Administración
            </h2>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Resumen general del sistema
            </p>
          </div>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          icon={<FileText size={22} />}
          label="Facturas Recibidas"
          value={metrics?.recibidas ?? 0}
          color="#00829a"
          bgColor="rgba(0,130,154,0.08)"
        />
        <MetricCard
          icon={<ArrowUpRight size={22} />}
          label="Asignadas"
          value={metrics?.asignadas ?? 0}
          color="#1d4ed8"
          bgColor="rgba(29,78,216,0.08)"
        />
        <MetricCard
          icon={<CheckCircle2 size={22} />}
          label="Pagadas"
          value={metrics?.cerradas ?? 0}
          color="#15803d"
          bgColor="rgba(21,128,61,0.08)"
        />
        <MetricCard
          icon={<Clock size={22} />}
          label="Pendientes"
          value={metrics?.pendientes ?? 0}
          color="#d97706"
          bgColor="rgba(217,119,6,0.08)"
        />
      </div>

      {/* Second row: Users summary + Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Users Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
              <Users size={18} style={{ color: '#7c3aed' }} />
            </div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Usuarios
            </h3>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-gray-900">{usuarios.length}</span>
            <span className="text-sm text-gray-400">registrados</span>
          </div>

          <div className="flex gap-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-600">{activos} activos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-sm text-gray-600">{inactivos} inactivos</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {Object.entries(rolCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([rol, count]) => (
                <div key={rol} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{ROL_LABELS[rol] ?? rol}</span>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Areas with most facturas */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,130,154,0.08)' }}>
              <Building2 size={18} style={{ color: '#00829a' }} />
            </div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
              Facturas por Área
            </h3>
          </div>

          {areaStats.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Sin datos de áreas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {areaStats.slice(0, 8).map(a => {
                const maxCount = areaStats[0]?.count || 1;
                const pct = Math.round((a.count / maxCount) * 100);
                return (
                  <div key={a.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 truncate max-w-[200px]">{a.nombre}</span>
                      <span className="text-sm font-semibold text-gray-700">{a.count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: '#00829a' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent facturas table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,130,154,0.08)' }}>
            <FileText size={18} style={{ color: '#00829a' }} />
          </div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
            Facturas Recientes
          </h3>
        </div>

        {recientes.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto mb-4 text-gray-200" />
            <p className="text-sm text-gray-400">No hay facturas recientes</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['Nro. Factura', 'Proveedor', 'Área', 'Total', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="text-left px-6 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-widest"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recientes.map((f, i) => (
                <tr key={f.id}
                  className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                  style={{ backgroundColor: i % 2 !== 0 ? '#fafbfc' : 'white' }}>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800">{f.numero_factura}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{f.proveedor}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{f.area}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                    ${f.total.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <EstadoBadge estado={f.estado} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {f.fecha_emision
                      ? new Date(f.fecha_emision).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ icon, label, value, color, bgColor }: {
  icon: React.ReactNode; label: string; value: number; color: string; bgColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-start gap-4"
      style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: bgColor, color }}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-400 mb-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-900">{value.toLocaleString('es-CO')}</p>
      </div>
    </div>
  );
}

/* ── Estado Badge ── */
function EstadoBadge({ estado }: { estado: string }) {
  const lower = estado.toLowerCase();
  let bg = '#f3f4f6'; let text = '#374151'; let border = '#e5e7eb';

  if (lower.includes('recib') || lower.includes('nueva')) {
    bg = '#dbeafe'; text = '#1d4ed8'; border = '#bfdbfe';
  } else if (lower.includes('asignad')) {
    bg = '#ccfbf1'; text = '#0f766e'; border = '#99f6e4';
  } else if (lower.includes('cerrad') || lower.includes('pagad') || lower.includes('archiv')) {
    bg = '#dcfce7'; text = '#15803d'; border = '#bbf7d0';
  } else if (lower.includes('devuel') || lower.includes('rechaz')) {
    bg = '#ffe4e6'; text = '#be123c'; border = '#fecdd3';
  } else if (lower.includes('pendi') || lower.includes('revis')) {
    bg = '#fef3c7'; text = '#92400e'; border = '#fde68a';
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bg, color: text, border: `1px solid ${border}` }}>
      {estado}
    </span>
  );
}
