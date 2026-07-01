import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderInput, User as UserIcon, AlertTriangle, Search, Check, Building2, ArrowRight } from 'lucide-react';
import {
  asignarFactura,
  getAreas,
  getUsersByArea,
  type AreaDetail,
  type FacturaListItem,
  type UserListItem,
} from '../lib/api';

interface ReasignarAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  factura: FacturaListItem;
  onSuccess: (data: { area_id: string; area_nombre: string; responsable_nombre: string }) => void;
}

export function ReasignarAreaModal({ isOpen, onClose, factura, onSuccess }: ReasignarAreaModalProps) {
  const [areas, setAreas] = useState<AreaDetail[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');

  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedAreaNombre, setSelectedAreaNombre] = useState<string>('');
  const [responsables, setResponsables] = useState<UserListItem[]>([]);
  const [loadingResponsables, setLoadingResponsables] = useState(false);
  const [selectedResponsableId, setSelectedResponsableId] = useState<string>('');
  const [selectedResponsableNombre, setSelectedResponsableNombre] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAreaId('');
    setSelectedAreaNombre('');
    setSelectedResponsableId('');
    setSelectedResponsableNombre('');
    setResponsables([]);
    setAreaQuery('');
    setError(null);
    void cargarAreas();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedAreaId) {
      setResponsables([]);
      return;
    }
    void cargarResponsables(selectedAreaId);
  }, [selectedAreaId]);

  const cargarAreas = async () => {
    try {
      setLoadingAreas(true);
      const data = await getAreas();
      setAreas(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cargando áreas';
      setError(msg);
    } finally {
      setLoadingAreas(false);
    }
  };

  const cargarResponsables = async (areaId: string) => {
    try {
      setLoadingResponsables(true);
      setError(null);
      const data = await getUsersByArea(areaId, { onlyActive: true });
      setResponsables(data);
      // Pre-seleccionar al primer responsable disponible (ordenado por rol).
      // Si hay un usuario con rol 'responsable', se prefiere; si no, el primero del listado.
      if (data.length > 0) {
        const score = (u: UserListItem) => {
          const r = (u.role || '').toLowerCase();
          if (r === 'responsable') return 0;
          if (r === 'tecnico' || r === 'mant') return 1;
          if (r === 'user') return 2;
          return 3;
        };
        const ordenados = [...data].sort((a, b) => score(a) - score(b) || a.nombre.localeCompare(b.nombre));
        const primero = ordenados[0];
        setSelectedResponsableId(primero.id);
        setSelectedResponsableNombre(primero.nombre);
      } else {
        setSelectedResponsableId('');
        setSelectedResponsableNombre('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cargando responsables';
      setError(msg);
      setResponsables([]);
    } finally {
      setLoadingResponsables(false);
    }
  };

  const handleSelectArea = (area: AreaDetail) => {
    setSelectedAreaId(area.id);
    setSelectedAreaNombre(area.nombre);
    setSelectedResponsableId('');
    setSelectedResponsableNombre('');
  };

  const handleSelectResponsable = (u: UserListItem) => {
    setSelectedResponsableId(u.id);
    setSelectedResponsableNombre(u.nombre);
  };

  const puedeEnviar = Boolean(selectedAreaId) && Boolean(selectedResponsableId) && !submitting;

  const handleSubmit = async () => {
    if (!puedeEnviar) return;
    try {
      setSubmitting(true);
      setError(null);
      const resp = await asignarFactura(factura.id, {
        area_id: selectedAreaId,
        responsable_user_id: selectedResponsableId,
      });
      onSuccess({
        area_id: selectedAreaId,
        area_nombre: resp.area,
        responsable_nombre: resp.responsable.nombre,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reasignar';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const areasFiltradas = useMemo(() => {
    const q = areaQuery.trim().toLowerCase();
    const base = areas.filter(a => a.id !== factura.area_id);
    if (!q) return base;
    return base.filter(a =>
      a.nombre.toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q),
    );
  }, [areas, areaQuery, factura.area_id]);

  const responsablesOrdenados = useMemo(() => {
    const score = (u: UserListItem) => {
      const r = (u.role || '').toLowerCase();
      if (r === 'responsable') return 0;
      if (r === 'tecnico' || r === 'mant') return 1;
      if (r === 'user') return 2;
      return 3;
    };
    return [...responsables].sort((a, b) => score(a) - score(b) || a.nombre.localeCompare(b.nombre));
  }, [responsables]);

  if (!isOpen) return null;

  const modal = (
    <>
      <div
        className="fixed inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(17, 24, 39, 0.55)', zIndex: 100000 }}
        onClick={onClose}
      />
      <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 100001 }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to right, #00829a, #14aab8)' }}
              className="text-white px-6 py-4 rounded-t-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <FolderInput className="w-5 h-5" />
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                    Reasignar a otra área
                  </h3>
                  <p className="text-sm text-white/90">
                    Factura {factura.numero_factura} · Área actual: {factura.area || '—'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Selecciona la nueva área y el responsable que debe gestionar esta factura. El
                  responsable actual perderá el acceso.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    1. Nueva área responsable
                  </label>
                  {selectedAreaNombre && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                      <Check className="w-3 h-3" /> {selectedAreaNombre}
                    </span>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={areaQuery}
                    onChange={e => setAreaQuery(e.target.value)}
                    placeholder="Buscar área..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {loadingAreas ? (
                    <div className="p-4 text-center text-sm text-gray-500">Cargando áreas…</div>
                  ) : areasFiltradas.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">Sin coincidencias</div>
                  ) : (
                    areasFiltradas.map(area => {
                      const seleccionada = selectedAreaId === area.id;
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => handleSelectArea(area)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            seleccionada
                              ? 'bg-cyan-50 text-cyan-900 font-semibold'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                          style={seleccionada ? { boxShadow: 'inset 3px 0 0 #00829a' } : undefined}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className={`w-4 h-4 flex-shrink-0 ${seleccionada ? 'text-cyan-700' : 'text-gray-400'}`} />
                            <span className="truncate">{area.nombre}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {area.code && (
                              <span className="text-xs text-gray-400">{area.code}</span>
                            )}
                            {seleccionada && <Check className="w-4 h-4 text-cyan-700" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    2. Responsable que recibirá la factura
                  </label>
                  {selectedResponsableNombre && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      <Check className="w-3 h-3" /> {selectedResponsableNombre}
                    </span>
                  )}
                </div>
                {!selectedAreaId ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 text-center">
                    Selecciona primero un área para ver sus responsables.
                  </div>
                ) : loadingResponsables ? (
                  <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">
                    Cargando responsables…
                  </div>
                ) : responsablesOrdenados.length === 0 ? (
                  <div className="border border-dashed border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-700 text-center">
                    El área seleccionada no tiene usuarios activos. Pide al administrador crear un
                    responsable antes de reasignar.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {responsablesOrdenados.map(u => {
                      const seleccionado = selectedResponsableId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectResponsable(u)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                            seleccionado
                              ? 'bg-cyan-50 text-cyan-900 font-semibold'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                          style={seleccionado ? { boxShadow: 'inset 3px 0 0 #00829a' } : undefined}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${seleccionado ? 'bg-cyan-200' : 'bg-cyan-100'}`}>
                              <UserIcon className="w-4 h-4 text-cyan-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{u.nombre}</p>
                              <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 flex-shrink-0">
                              {u.role}
                            </span>
                            {seleccionado && <Check className="w-4 h-4 text-cyan-700 flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(selectedAreaNombre || selectedResponsableNombre) && (
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-3">
                  <p className="text-xs uppercase tracking-wide text-cyan-700 mb-1">Resumen de la reasignación</p>
                  <div className="flex items-center gap-2 text-sm text-gray-800 flex-wrap">
                    <span className="font-mono font-semibold">{factura.numero_factura}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{selectedAreaNombre || '— área —'}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{selectedResponsableNombre || '— responsable —'}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {puedeEnviar
                  ? 'Listo para reasignar.'
                  : !selectedAreaId
                  ? 'Selecciona un área para continuar.'
                  : !selectedResponsableId
                  ? 'Selecciona un responsable del área.'
                  : ''}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!puedeEnviar}
                  style={{ backgroundColor: !puedeEnviar ? '#9ca3af' : '#00829a' }}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 disabled:cursor-not-allowed"
                >
                  <FolderInput className="w-4 h-4" />
                  {submitting ? 'Reasignando…' : 'Reasignar factura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
