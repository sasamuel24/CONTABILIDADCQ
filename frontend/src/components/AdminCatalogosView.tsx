import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCentrosCosto, createCentroCosto, updateCentroCosto, deleteCentroCosto,
  getCentrosOperacion, createCentroOperacion, updateCentroOperacion, deleteCentroOperacion,
  getUnidadesNegocio, createUnidadNegocio, updateUnidadNegocio, deleteUnidadNegocio,
  getCuentasAuxiliares, createCuentaAuxiliar, updateCuentaAuxiliar, deleteCuentaAuxiliar,
  type CentroCosto, type CentroOperacion, type UnidadNegocio, type CuentaAuxiliar,
} from '../lib/api';

type Tab = 'cc' | 'co' | 'un' | 'ca';

const TABS: { key: Tab; label: string }[] = [
  { key: 'cc', label: 'Centros de Costo' },
  { key: 'co', label: 'Centros de Operación' },
  { key: 'un', label: 'Unidades de Negocio' },
  { key: 'ca', label: 'Cuentas Auxiliares' },
];

/* ─────────────────────────────────────────── */
/*  Componentes de utilidad                    */
/* ─────────────────────────────────────────── */

function ActiveBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      activo ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
    }`}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function FieldInput({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00829a]/30 focus:border-[#00829a]"
      />
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Tab: Centros de Costo                      */
/* ─────────────────────────────────────────── */

function TabCentroCosto() {
  const [lista, setLista] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setLista(await getCentrosCosto(false)); } catch { toast.error('Error al cargar'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrear = async () => {
    if (!nuevoNombre.trim()) { toast.warning('Ingrese un nombre'); return; }
    setSaving(true);
    try {
      const nuevo = await createCentroCosto({ nombre: nuevoNombre.trim() });
      setLista(prev => [nuevo, ...prev]);
      setNuevoNombre('');
      toast.success('Centro de Costo creado');
    } catch { toast.error('Error al crear'); } finally { setSaving(false); }
  };

  const handleGuardarEdicion = async (id: string) => {
    if (!editNombre.trim()) { toast.warning('Ingrese un nombre'); return; }
    try {
      const actualizado = await updateCentroCosto(id, { nombre: editNombre.trim() });
      setLista(prev => prev.map(c => c.id === id ? actualizado : c));
      setEditId(null);
      toast.success('Actualizado');
    } catch { toast.error('Error al actualizar'); }
  };

  const handleToggle = async (cc: CentroCosto) => {
    try {
      const actualizado = await updateCentroCosto(cc.id, { activo: !cc.activo });
      setLista(prev => prev.map(c => c.id === cc.id ? actualizado : c));
    } catch { toast.error('Error al cambiar estado'); }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este Centro de Costo?')) return;
    try {
      await deleteCentroCosto(id);
      setLista(prev => prev.filter(c => c.id !== id));
      toast.success('Eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-5">
      {/* Formulario nuevo */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Nuevo Centro de Costo</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <FieldInput label="Nombre" value={nuevoNombre} onChange={setNuevoNombre} placeholder="Ej: Administración" required />
          </div>
          <button
            onClick={handleCrear}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#00829a' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin registros</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(cc => (
                <tr key={cc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {editId === cc.id ? (
                      <input
                        autoFocus
                        value={editNombre}
                        onChange={e => setEditNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleGuardarEdicion(cc.id); if (e.key === 'Escape') setEditId(null); }}
                        className="px-2 py-1 border border-[#00829a] rounded text-sm w-full max-w-xs focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-800 font-medium">{cc.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center"><ActiveBadge activo={cc.activo} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === cc.id ? (
                        <>
                          <button onClick={() => handleGuardarEdicion(cc.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(cc.id); setEditNombre(cc.nombre); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleToggle(cc)} className="p-1.5 rounded hover:bg-gray-100" title={cc.activo ? 'Desactivar' : 'Activar'}>
                            {cc.activo ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </button>
                          <button onClick={() => handleEliminar(cc.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Tab: Centros de Operación                  */
/* ─────────────────────────────────────────── */

function TabCentroOperacion() {
  const [lista, setLista] = useState<CentroOperacion[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCCId, setNuevoCCId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCCId, setEditCCId] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cos, ccs] = await Promise.all([getCentrosOperacion(undefined, false), getCentrosCosto(false)]);
      setLista(cos);
      setCentrosCosto(ccs);
    } catch { toast.error('Error al cargar'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrear = async () => {
    if (!nuevoNombre.trim()) { toast.warning('Ingrese un nombre'); return; }
    if (!nuevoCCId) { toast.warning('Seleccione el Centro de Costo'); return; }
    setSaving(true);
    try {
      const nuevo = await createCentroOperacion({ nombre: nuevoNombre.trim(), centro_costo_id: nuevoCCId });
      setLista(prev => [nuevo, ...prev]);
      setNuevoNombre(''); setNuevoCCId('');
      toast.success('Centro de Operación creado');
    } catch { toast.error('Error al crear'); } finally { setSaving(false); }
  };

  const handleGuardarEdicion = async (id: string) => {
    if (!editNombre.trim()) { toast.warning('Ingrese un nombre'); return; }
    try {
      const actualizado = await updateCentroOperacion(id, { nombre: editNombre.trim(), centro_costo_id: editCCId || undefined });
      setLista(prev => prev.map(c => c.id === id ? actualizado : c));
      setEditId(null);
      toast.success('Actualizado');
    } catch { toast.error('Error al actualizar'); }
  };

  const handleToggle = async (co: CentroOperacion) => {
    try {
      const actualizado = await updateCentroOperacion(co.id, { activo: !co.activo });
      setLista(prev => prev.map(c => c.id === co.id ? actualizado : c));
    } catch { toast.error('Error al cambiar estado'); }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este Centro de Operación?')) return;
    try {
      await deleteCentroOperacion(id);
      setLista(prev => prev.filter(c => c.id !== id));
      toast.success('Eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Nuevo Centro de Operación</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <FieldInput label="Nombre" value={nuevoNombre} onChange={setNuevoNombre} placeholder="Ej: Logística Norte" required />
          </div>
          <div className="flex-1 min-w-[180px] flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Centro de Costo <span className="text-red-500">*</span></label>
            <select
              value={nuevoCCId}
              onChange={e => setNuevoCCId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00829a]/30 focus:border-[#00829a]"
            >
              <option value="">— Seleccionar —</option>
              {centrosCosto.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <button
            onClick={handleCrear}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#00829a' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin registros</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Centro de Costo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(co => (
                <tr key={co.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {editId === co.id ? (
                      <input
                        autoFocus
                        value={editNombre}
                        onChange={e => setEditNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleGuardarEdicion(co.id); if (e.key === 'Escape') setEditId(null); }}
                        className="px-2 py-1 border border-[#00829a] rounded text-sm w-full max-w-xs focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-800 font-medium">{co.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === co.id ? (
                      <select
                        value={editCCId}
                        onChange={e => setEditCCId(e.target.value)}
                        className="px-2 py-1 border border-[#00829a] rounded text-sm focus:outline-none"
                      >
                        {centrosCosto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-xs">{co.centro_costo_nombre ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center"><ActiveBadge activo={co.activo} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === co.id ? (
                        <>
                          <button onClick={() => handleGuardarEdicion(co.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(co.id); setEditNombre(co.nombre); setEditCCId(co.centro_costo_id); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleToggle(co)} className="p-1.5 rounded hover:bg-gray-100" title={co.activo ? 'Desactivar' : 'Activar'}>
                            {co.activo ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </button>
                          <button onClick={() => handleEliminar(co.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Tab genérico: código + descripción         */
/* ─────────────────────────────────────────── */

interface CodigoDescItem {
  id: string; codigo: string; descripcion: string; activa?: boolean; activo?: boolean;
}

function TabCodigoDesc<T extends CodigoDescItem>({
  cargarFn, crearFn, actualizarFn, eliminarFn, toggleField,
}: {
  cargarFn: () => Promise<T[]>;
  crearFn: (d: { codigo: string; descripcion: string }) => Promise<T>;
  actualizarFn: (id: string, d: { codigo?: string; descripcion?: string; activa?: boolean; activo?: boolean }) => Promise<T>;
  eliminarFn: (id: string) => Promise<void>;
  toggleField: 'activa' | 'activo';
}) {
  const [lista, setLista] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setLista(await cargarFn()); } catch { toast.error('Error al cargar'); } finally { setLoading(false); }
  }, [cargarFn]);

  useEffect(() => { cargar(); }, [cargar]);

  const isActive = (item: T) => toggleField === 'activa' ? !!item.activa : !!item.activo;

  const handleCrear = async () => {
    if (!nuevoCodigo.trim() || !nuevaDesc.trim()) { toast.warning('Complete código y descripción'); return; }
    setSaving(true);
    try {
      const nuevo = await crearFn({ codigo: nuevoCodigo.trim(), descripcion: nuevaDesc.trim() });
      setLista(prev => [nuevo, ...prev]);
      setNuevoCodigo(''); setNuevaDesc('');
      toast.success('Creado correctamente');
    } catch { toast.error('Error al crear'); } finally { setSaving(false); }
  };

  const handleGuardarEdicion = async (id: string) => {
    if (!editCodigo.trim() || !editDesc.trim()) { toast.warning('Complete código y descripción'); return; }
    try {
      const actualizado = await actualizarFn(id, { codigo: editCodigo.trim(), descripcion: editDesc.trim() });
      setLista(prev => prev.map(c => c.id === id ? actualizado : c));
      setEditId(null);
      toast.success('Actualizado');
    } catch { toast.error('Error al actualizar'); }
  };

  const handleToggle = async (item: T) => {
    try {
      const actualizado = await actualizarFn(item.id, { [toggleField]: !isActive(item) } as any);
      setLista(prev => prev.map(c => c.id === item.id ? actualizado : c));
    } catch { toast.error('Error al cambiar estado'); }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await eliminarFn(id);
      setLista(prev => prev.filter(c => c.id !== id));
      toast.success('Eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Nuevo registro</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-36">
            <FieldInput label="Código" value={nuevoCodigo} onChange={setNuevoCodigo} placeholder="Ej: UN01" required />
          </div>
          <div className="flex-1 min-w-[180px]">
            <FieldInput label="Descripción" value={nuevaDesc} onChange={setNuevaDesc} placeholder="Ej: Unidad Norte" required />
          </div>
          <button
            onClick={handleCrear}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#00829a' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin registros</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {editId === item.id ? (
                      <input
                        autoFocus
                        value={editCodigo}
                        onChange={e => setEditCodigo(e.target.value)}
                        className="px-2 py-1 border border-[#00829a] rounded text-sm w-full focus:outline-none"
                      />
                    ) : (
                      <span className="font-mono text-gray-800 font-semibold">{item.codigo}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === item.id ? (
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleGuardarEdicion(item.id); if (e.key === 'Escape') setEditId(null); }}
                        className="px-2 py-1 border border-[#00829a] rounded text-sm w-full focus:outline-none"
                      />
                    ) : (
                      <span className="text-gray-600">{item.descripcion}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center"><ActiveBadge activo={isActive(item)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === item.id ? (
                        <>
                          <button onClick={() => handleGuardarEdicion(item.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(item.id); setEditCodigo(item.codigo); setEditDesc(item.descripcion); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleToggle(item)} className="p-1.5 rounded hover:bg-gray-100" title={isActive(item) ? 'Desactivar' : 'Activar'}>
                            {isActive(item) ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </button>
                          <button onClick={() => handleEliminar(item.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Vista principal                            */
/* ─────────────────────────────────────────── */

export function AdminCatalogosView() {
  const [tab, setTab] = useState<Tab>('cc');

  return (
    <div className="p-8">
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
          Catálogos Contables
        </h2>
        <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          Administra los catálogos utilizados en la clasificación de facturas
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? '#00829a' : '#6b7280',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              fontFamily: 'Neutra Text, Montserrat, sans-serif',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>
        {tab === 'cc' && <TabCentroCosto />}
        {tab === 'co' && <TabCentroOperacion />}
        {tab === 'un' && (
          <TabCodigoDesc<UnidadNegocio>
            cargarFn={() => getUnidadesNegocio(false)}
            crearFn={createUnidadNegocio}
            actualizarFn={updateUnidadNegocio}
            eliminarFn={deleteUnidadNegocio}
            toggleField="activa"
          />
        )}
        {tab === 'ca' && (
          <TabCodigoDesc<CuentaAuxiliar>
            cargarFn={() => getCuentasAuxiliares(false)}
            crearFn={createCuentaAuxiliar}
            actualizarFn={updateCuentaAuxiliar}
            eliminarFn={deleteCuentaAuxiliar}
            toggleField="activa"
          />
        )}
      </div>
    </div>
  );
}
