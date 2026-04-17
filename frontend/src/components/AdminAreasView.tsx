import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Search, RefreshCw, Pencil, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAreas, createArea, updateArea, deleteArea,
  AreaDetail, AreaCreatePayload,
} from '../lib/api';

const inputCls = 'w-full rounded-xl px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white transition-all';

// ── Modal base ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest"
        style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Modal Crear/Editar Área ──
function ModalArea({ area, onClose, onGuardado }: {
  area: AreaDetail | null; onClose: () => void; onGuardado: () => void;
}) {
  const isEdit = !!area;
  const [code, setCode] = useState(area?.code ?? '');
  const [nombre, setNombre] = useState(area?.nombre ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim() || !nombre.trim()) {
      toast.error('Completa todos los campos'); return;
    }
    setSaving(true);
    try {
      if (isEdit && area) {
        await updateArea(area.id, { code: code.trim(), nombre: nombre.trim() });
        toast.success('Área actualizada correctamente');
      } else {
        await createArea({ code: code.trim(), nombre: nombre.trim() });
        toast.success('Área creada correctamente');
      }
      onGuardado();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? 'Editar área' : 'Crear nueva área'} onClose={onClose}>
      <Field label="Código">
        <input className={inputCls} value={code} onChange={e => setCode(e.target.value)}
          placeholder="Ej. MANT" />
      </Field>
      <Field label="Nombre">
        <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Mantenimiento" />
      </Field>
      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white mt-1 disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: '#00829a' }}>
        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear área'}
      </button>
    </Modal>
  );
}

// ── Modal Confirmar Eliminación ──
function ModalEliminar({ area, onClose, onEliminado }: {
  area: AreaDetail; onClose: () => void; onEliminado: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteArea(area.id);
      toast.success(`Área "${area.nombre}" eliminada`);
      onEliminado();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se puede eliminar esta área');
    } finally { setDeleting(false); }
  };

  return (
    <Modal title="Eliminar área" onClose={onClose}>
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-5">
        <Trash2 size={20} className="text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 leading-relaxed">
          ¿Estás seguro de eliminar el área <strong>{area.nombre}</strong> ({area.code})?
          Esta acción no se puede deshacer. Si tiene registros asociados, no podrá eliminarse.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-all">
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  );
}

// ── Vista principal ──
export function AdminAreasView() {
  const [areas, setAreas] = useState<AreaDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [modalCrearEditar, setModalCrearEditar] = useState<AreaDetail | null | false>(false);
  const [modalEliminar, setModalEliminar] = useState<AreaDetail | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAreas();
      setAreas(data);
    } catch {
      toast.error('Error al cargar áreas');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = areas.filter(a =>
    !busqueda ||
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.code.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,130,154,0.1)' }}>
            <Building2 size={26} style={{ color: '#00829a' }} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Gestión de Áreas
            </h2>
            <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              {areas.length} áreas registradas
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={cargar}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={15} /> Actualizar
          </button>
          <button onClick={() => setModalCrearEditar(null)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#00829a' }}>
            <Plus size={16} /> Crear área
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            placeholder="Buscar por nombre o código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,130,154,0.07)' }}>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Cargando áreas...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-24 text-center">
            <Building2 size={40} className="mx-auto mb-4 text-gray-200" />
            <p className="text-sm text-gray-400">No se encontraron áreas</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {[
                  { label: 'Código', w: '20%' },
                  { label: 'Nombre', w: '50%' },
                  { label: 'ID', w: '15%' },
                  { label: 'Acciones', w: '15%' },
                ].map(h => (
                  <th key={h.label} style={{ width: h.w, fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                    className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a, i) => (
                <tr key={a.id}
                  className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                  style={{ backgroundColor: i % 2 !== 0 ? '#fafbfc' : 'white' }}>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 font-mono">
                      {a.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-gray-800">{a.nombre}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-400 font-mono">{a.id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <button title="Editar área" onClick={() => setModalCrearEditar(a)}
                        className="p-2.5 rounded-xl hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors border border-transparent hover:border-teal-100">
                        <Pencil size={15} />
                      </button>
                      <button title="Eliminar área" onClick={() => setModalEliminar(a)}
                        className="p-2.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modalCrearEditar !== false && (
        <ModalArea
          area={modalCrearEditar}
          onClose={() => setModalCrearEditar(false)}
          onGuardado={cargar}
        />
      )}
      {modalEliminar && (
        <ModalEliminar
          area={modalEliminar}
          onClose={() => setModalEliminar(null)}
          onEliminado={cargar}
        />
      )}
    </div>
  );
}
