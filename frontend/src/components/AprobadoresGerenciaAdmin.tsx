import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, UserCheck, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAprobadoresGerencia,
  crearAprobadorGerencia,
  actualizarAprobadorGerencia,
  toggleAprobadorGerencia,
  eliminarAprobadorGerencia,
  type AprobadorGerencia,
} from '../lib/api';

const EMPTY_FORM = { nombre: '', cargo: '', email: '' };

export function AprobadoresGerenciaAdmin() {
  const [aprobadores, setAprobadores] = useState<AprobadorGerencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal crear / editar
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Confirmación eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAprobadoresGerencia();
      setAprobadores(data);
    } catch {
      toast.error('Error al cargar aprobadores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirCrear = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const abrirEditar = (a: AprobadorGerencia) => {
    setEditingId(a.id);
    setForm({ nombre: a.nombre, cargo: a.cargo, email: a.email });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.cargo.trim() || !form.email.trim()) {
      toast.error('Todos los campos son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await actualizarAprobadorGerencia(editingId, form);
        setAprobadores(prev => prev.map(a => a.id === editingId ? updated : a));
        toast.success('Aprobador actualizado.');
      } else {
        const created = await crearAprobadorGerencia(form);
        setAprobadores(prev => [...prev, created]);
        toast.success('Aprobador creado.');
      }
      setShowModal(false);
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: AprobadorGerencia) => {
    setTogglingId(a.id);
    try {
      const updated = await toggleAprobadorGerencia(a.id);
      setAprobadores(prev => prev.map(x => x.id === a.id ? updated : x));
      toast.success(updated.is_active ? 'Aprobador activado.' : 'Aprobador desactivado.');
    } catch {
      toast.error('Error al cambiar estado.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleEliminar = async (id: string) => {
    setDeletingId(id);
    try {
      await eliminarAprobadorGerencia(id);
      setAprobadores(prev => prev.filter(a => a.id !== id));
      toast.success('Aprobador eliminado.');
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#e0f5f7' }}>
            <UserCheck className="w-5 h-5" style={{ color: '#00829a' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Aprobadores de Gerencia
            </h2>
            <p className="text-xs text-gray-500">Gerentes que aprueban facturas vía correo electrónico</p>
          </div>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ backgroundColor: '#1a3c6e' }}
        >
          <Plus className="w-4 h-4" />
          Agregar aprobador
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : aprobadores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay aprobadores configurados. Agrega el primero.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Cargo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {aprobadores.map(a => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{a.cargo}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{a.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={
                        a.is_active
                          ? { backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                          : { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' }
                      }
                    >
                      {a.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Toggle activo */}
                      <button
                        onClick={() => handleToggle(a)}
                        disabled={togglingId === a.id}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title={a.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {togglingId === a.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : a.is_active ? (
                          <ToggleRight className="w-4 h-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {/* Editar */}
                      <button
                        onClick={() => abrirEditar(a)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                      {/* Eliminar */}
                      <button
                        onClick={() => handleEliminar(a.id)}
                        disabled={deletingId === a.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        {deletingId === a.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                {editingId ? 'Editar aprobador' : 'Nuevo aprobador'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Carlos Muñoz García"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                  placeholder="Ej: Gerente General"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="gerente@caféquindio.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ backgroundColor: '#1a3c6e' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
