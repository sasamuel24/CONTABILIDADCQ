import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, RefreshCw, KeyRound, Pencil,
  UserCheck, UserX, X, Eye, EyeOff, ShieldCheck,
  ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getUsers, createUser, updateUser, adminResetPassword, getAreas,
  UserListItem, UserCreatePayload, UserUpdatePayload, Area,
} from '../lib/api';

const ROLES = [
  { code: 'admin',         label: 'Administrador' },
  { code: 'fact',          label: 'Facturación' },
  { code: 'responsable',   label: 'Responsable de Área' },
  { code: 'contabilidad',  label: 'Contabilidad' },
  { code: 'tesoreria',     label: 'Tesorería' },
  { code: 'tes',           label: 'Tesorería (tes)' },
  { code: 'gerencia',      label: 'Gerencia' },
  { code: 'tecnico',       label: 'Técnico de Mantenimiento' },
  { code: 'mant',          label: 'Mantenimiento' },
  { code: 'direccion',     label: 'Dirección' },
];

const ROL_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  admin:        { bg: '#f3e8ff', text: '#7c3aed', border: '#e9d5ff' },
  fact:         { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  responsable:  { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4' },
  contabilidad: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  tesoreria:    { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  tes:          { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  gerencia:     { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
  tecnico:      { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  mant:         { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  direccion:    { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
};

const labelRol = (code: string) => ROLES.find(r => r.code === code)?.label ?? code;

// ─── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            {title}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-8 py-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest"
        style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-xl px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white transition-all';
const selectCls = inputCls;

// ─── Modal Crear ──────────────────────────────────────────────────────────────
function ModalCrear({ areas, onClose, onCreado }: { areas: Area[]; onClose: () => void; onCreado: () => void }) {
  const [form, setForm] = useState<UserCreatePayload>({ nombre: '', email: '', role: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof UserCreatePayload, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre || !form.email || !form.role || !form.password) {
      toast.error('Completa todos los campos obligatorios'); return;
    }
    setSaving(true);
    try {
      await createUser(form);
      toast.success(`Usuario ${form.nombre} creado correctamente`);
      onCreado(); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear usuario');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Crear nuevo usuario" onClose={onClose}>
      <Field label="Nombre completo">
        <input className={inputCls} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Juan Pérez" />
      </Field>
      <Field label="Correo electrónico">
        <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@cafequindio.com" />
      </Field>
      <Field label="Rol">
        <select className={selectCls} value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="">-- Seleccionar rol --</option>
          {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Área (opcional)">
        <select className={selectCls} value={form.area_id ?? ''} onChange={e => set('area_id', e.target.value)}>
          <option value="">-- Sin área --</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </Field>
      <Field label="Contraseña inicial" hint="El usuario deberá cambiarla al ingresar por primera vez.">
        <div className="relative">
          <input className={inputCls + ' pr-12'} type={showPwd ? 'text' : 'password'}
            value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 6 caracteres" />
          <button type="button" onClick={() => setShowPwd(p => !p)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </Field>
      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white mt-1 disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: '#00829a' }}>
        {saving ? 'Creando...' : 'Crear usuario'}
      </button>
    </Modal>
  );
}

// ─── Modal Editar ─────────────────────────────────────────────────────────────
function ModalEditar({ user, areas, onClose, onGuardado }: { user: UserListItem; areas: Area[]; onClose: () => void; onGuardado: () => void }) {
  const [form, setForm] = useState<UserUpdatePayload>({ nombre: user.nombre, email: user.email, role: user.role, area_id: null });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof UserUpdatePayload, v: string | null) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updateUser(user.id, form);
      toast.success('Usuario actualizado correctamente');
      onGuardado(); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Editar usuario`} onClose={onClose}>
      <p className="text-sm text-gray-500 mb-5 -mt-1">{user.email}</p>
      <Field label="Nombre completo">
        <input className={inputCls} value={form.nombre ?? ''} onChange={e => set('nombre', e.target.value)} />
      </Field>
      <Field label="Correo electrónico">
        <input className={inputCls} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
      </Field>
      <Field label="Rol">
        <select className={selectCls} value={form.role ?? ''} onChange={e => set('role', e.target.value)}>
          {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Área">
        <select className={selectCls} value={form.area_id ?? ''} onChange={e => set('area_id', e.target.value || null)}>
          <option value="">-- Sin área --</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </Field>
      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: '#00829a' }}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </Modal>
  );
}

// ─── Modal Resetear Contraseña ────────────────────────────────────────────────
function ModalReset({ user, onClose, onReseteado }: { user: UserListItem; onClose: () => void; onReseteado: () => void }) {
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (pwd.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setSaving(true);
    try {
      await adminResetPassword(user.id, pwd);
      toast.success(`Contraseña de ${user.nombre} reseteada. Deberá cambiarla al ingresar.`);
      onReseteado(); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al resetear');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Resetear contraseña" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-5 -mt-1">{user.nombre} · {user.email}</p>
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
        <ShieldCheck size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 leading-relaxed">
          Se asignará una contraseña temporal. El sistema le pedirá al usuario cambiarla en su próximo ingreso.
        </p>
      </div>
      <Field label="Nueva contraseña temporal">
        <div className="relative">
          <input className={inputCls + ' pr-12'} type={showPwd ? 'text' : 'password'}
            value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          <button type="button" onClick={() => setShowPwd(p => !p)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </Field>
      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: '#d97706' }}>
        {saving ? 'Reseteando...' : 'Resetear contraseña'}
      </button>
    </Modal>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export function AdminUsuariosView() {
  const [usuarios, setUsuarios] = useState<UserListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 10;

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<UserListItem | null>(null);
  const [modalReset, setModalReset] = useState<UserListItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, areasData] = await Promise.all([getUsers(), getAreas()]);
      setUsuarios(resp.items);
      setAreas(areasData);
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [busqueda, filtroRol, filtroEstado]);

  const handleToggleActivo = async (u: UserListItem) => {
    setTogglingId(u.id);
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? `${u.nombre} desactivado` : `${u.nombre} activado`);
      await cargar();
    } catch { toast.error('Error al cambiar estado'); }
    finally { setTogglingId(null); }
  };

  const filtrados = usuarios.filter(u => {
    const textoOk = !busqueda || u.nombre.toLowerCase().includes(busqueda.toLowerCase()) || u.email.toLowerCase().includes(busqueda.toLowerCase());
    const rolOk = !filtroRol || u.role === filtroRol;
    const estadoOk = !filtroEstado || (filtroEstado === 'activo' ? u.is_active : !u.is_active);
    return textoOk && rolOk && estadoOk;
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const activos = usuarios.filter(u => u.is_active).length;

  return (
    <div className="p-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,130,154,0.1)' }}>
            <Users size={26} style={{ color: '#00829a' }} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Gestión de Usuarios
            </h2>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {usuarios.length} usuarios registrados &nbsp;·&nbsp; {activos} activos &nbsp;·&nbsp; {usuarios.length - activos} inactivos
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={cargar}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={15} /> Actualizar
          </button>
          <button onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#00829a' }}>
            <UserPlus size={16} /> Crear usuario
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            placeholder="Buscar por nombre o correo..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white min-w-[180px]"
          value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <select
          className="px-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white min-w-[160px]"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* ── Tabla ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Cargando usuarios...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-24 text-center">
            <Users size={40} className="mx-auto mb-4 text-gray-200" />
            <p className="text-sm text-gray-400">No se encontraron usuarios</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {[
                  { label: 'Usuario', w: '30%' },
                  { label: 'Rol', w: '20%' },
                  { label: 'Área', w: '18%' },
                  { label: 'Estado', w: '10%' },
                  { label: 'Creado', w: '10%' },
                  { label: 'Acciones', w: '12%' },
                ].map(h => (
                  <th key={h.label} style={{ width: h.w }}
                    className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest"
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((u, i) => {
                const badge = ROL_BADGE[u.role] ?? { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
                return (
                  <tr key={u.id}
                    className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                    style={{ backgroundColor: i % 2 !== 0 ? '#fafbfc' : 'white' }}>

                    {/* Usuario */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ backgroundColor: '#00829a' }}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-800 leading-tight">{u.nombre}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                        {labelRol(u.role)}
                      </span>
                    </td>

                    {/* Área */}
                    <td className="px-6 py-5">
                      <span className="text-sm text-gray-600">{u.area ?? <span className="text-gray-300">—</span>}</span>
                    </td>

                    {/* Estado */}
                    <td className="px-6 py-5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                          <span className="w-2 h-2 rounded-full bg-red-400" /> Inactivo
                        </span>
                      )}
                    </td>

                    {/* Creado */}
                    <td className="px-6 py-5">
                      <span className="text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1.5">
                        <button title="Editar usuario" onClick={() => setModalEditar(u)}
                          className="p-2.5 rounded-xl hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors border border-transparent hover:border-teal-100">
                          <Pencil size={15} />
                        </button>
                        <button title="Resetear contraseña" onClick={() => setModalReset(u)}
                          className="p-2.5 rounded-xl hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors border border-transparent hover:border-amber-100">
                          <KeyRound size={15} />
                        </button>
                        <button title={u.is_active ? 'Desactivar' : 'Activar'} onClick={() => handleToggleActivo(u)}
                          disabled={togglingId === u.id}
                          className={`p-2.5 rounded-xl transition-colors border border-transparent disabled:opacity-40 ${u.is_active ? 'hover:bg-red-50 text-gray-400 hover:text-red-500 hover:border-red-100' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 hover:border-emerald-100'}`}>
                          {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Paginación ── */}
        {!loading && filtrados.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              Mostrando <span className="font-semibold text-gray-600">{(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)}</span> de <span className="font-semibold text-gray-600">{filtrados.length}</span> usuarios
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={15} /> Anterior
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPagina(n)}
                    className="w-9 h-9 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: n === paginaActual ? '#00829a' : 'transparent',
                      color: n === paginaActual ? '#fff' : '#6b7280',
                      border: n === paginaActual ? 'none' : '1px solid #e5e7eb',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      {modalCrear && <ModalCrear areas={areas} onClose={() => setModalCrear(false)} onCreado={cargar} />}
      {modalEditar && <ModalEditar user={modalEditar} areas={areas} onClose={() => setModalEditar(null)} onGuardado={cargar} />}
      {modalReset && <ModalReset user={modalReset} onClose={() => setModalReset(null)} onReseteado={cargar} />}
    </div>
  );
}
