import React, { useState, useEffect } from 'react';
import { X, Folder, Check, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import {
  getCarpetasTesoreria,
  asignarFacturasACarpetaTesoreriaMasivo,
  type CarpetaTesoreria,
  type FacturaListItem,
} from '../lib/api';

interface AsignarCarpetaTesoreriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  facturas: FacturaListItem[];
  onSuccess: () => void;
}

export function AsignarCarpetaTesoreriaModal({ isOpen, onClose, facturas, onSuccess }: AsignarCarpetaTesoreriaModalProps) {
  const [carpetas, setCarpetas] = useState<CarpetaTesoreria[]>([]);
  const [selectedCarpetaId, setSelectedCarpetaId] = useState<string>('');
  const [selectedCarpetaNombre, setSelectedCarpetaNombre] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noArchivadas, setNoArchivadas] = useState<{ numero: string; motivo: string }[]>([]);
  const [archivadasOk, setArchivadasOk] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadCarpetas();
      setSelectedCarpetaId('');
      setSelectedCarpetaNombre('');
      setExpandedFolders(new Set());
      setErrorMsg(null);
      setNoArchivadas([]);
      setArchivadasOk(0);
    }
  }, [isOpen]);

  const loadCarpetas = async () => {
    try {
      setIsLoading(true);
      const data = await getCarpetasTesoreria();
      setCarpetas(data);
    } catch (err) {
      console.error('Error loading carpetas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarpetaId) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const ids = facturas.map(f => f.id);
      const resultado = await asignarFacturasACarpetaTesoreriaMasivo(ids, selectedCarpetaId);

      if (resultado.no_archivadas.length > 0) {
        // No cerramos el modal: la usuaria necesita ver CUÁLES quedaron por fuera.
        // Antes solo se decía cuántas fallaron y se perdía la selección.
        const numeroPorId = new Map(facturas.map(f => [f.id, f.numero_factura]));
        setNoArchivadas(
          resultado.no_archivadas.map(na => ({
            numero: numeroPorId.get(na.factura_id) || na.factura_id,
            motivo: na.motivo,
          }))
        );
        setArchivadasOk(resultado.archivadas);
        return;
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al asignar carpeta';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleSelectCarpeta = (carpeta: CarpetaTesoreria) => {
    setSelectedCarpetaId(carpeta.id);
    setSelectedCarpetaNombre(carpeta.nombre);
  };

  const renderCarpeta = (carpeta: CarpetaTesoreria, level: number = 0): React.ReactElement => {
    const isExpanded = expandedFolders.has(carpeta.id);
    const hasChildren = carpeta.children && carpeta.children.length > 0;
    const isSelected = selectedCarpetaId === carpeta.id;

    return (
      <div key={carpeta.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-md ${
            isSelected ? 'bg-teal-50 border-l-4 border-teal-500' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(carpeta.id);
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div
            className="flex-1 flex items-center gap-2"
            onClick={() => handleSelectCarpeta(carpeta)}
          >
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-teal-600" />
            ) : (
              <Folder className="w-4 h-4 text-teal-600" />
            )}
            <span className="text-sm font-medium text-gray-900">{carpeta.nombre}</span>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {carpeta.children.map((child) => renderCarpeta(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const esMasivo = facturas.length > 1;

  return (
    <>
      <div
        className="fixed inset-0 z-50 backdrop-blur-lg"
        style={{ backgroundColor: 'rgba(55, 65, 81, 0.75)' }}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div
            className="w-full max-w-2xl bg-white shadow-2xl rounded-lg border border-gray-200 relative"
            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-600 to-teal-500 rounded-t-lg">
              <h2 style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} className="text-lg font-bold text-white">
                {esMasivo ? `Archivar ${facturas.length} facturas` : 'Asignar a Carpeta'}
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6">
              {errorMsg && (
                <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50">
                  <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm font-medium text-red-800">
                    No se pudo archivar
                  </p>
                  <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-red-700 mt-1">
                    {errorMsg}
                  </p>
                  <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-red-600 mt-2">
                    Ninguna factura cambió: la selección sigue intacta, puedes reintentar.
                  </p>
                </div>
              )}

              {noArchivadas.length > 0 && (
                <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm font-medium text-amber-900">
                    Se archivaron {archivadasOk} de {facturas.length}. Estas {noArchivadas.length} quedaron por fuera:
                  </p>
                  <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {noArchivadas.map(na => (
                      <li
                        key={na.numero}
                        style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                        className="text-sm text-amber-800"
                      >
                        <span className="font-mono font-medium">{na.numero}</span> — {na.motivo}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={onSuccess}
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                    className="mt-3 px-4 py-2 text-sm rounded-lg border border-amber-300 text-amber-900 bg-white hover:bg-amber-100 transition-colors"
                  >
                    Entendido, actualizar lista
                  </button>
                </div>
              )}

              {/* Info de la(s) factura(s) */}
              <div className="mb-4 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
                {esMasivo ? (
                  <>
                    <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm text-gray-600 font-medium mb-1">
                      Facturas seleccionadas:
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} className="text-lg font-bold text-gray-900">
                      {facturas.length} facturas
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-500 mt-1">
                      {facturas.map(f => f.numero_factura).join(', ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm text-gray-600 font-medium mb-1">
                      Factura:
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} className="font-mono text-lg font-bold text-gray-900">
                      {facturas[0].numero_factura}
                    </p>
                    <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-sm text-gray-700 mt-1">
                      {facturas[0].proveedor}
                    </p>
                  </>
                )}
              </div>

              {/* Selector de carpeta */}
              <div className="mb-6">
                <label style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="block text-sm font-medium text-gray-700 mb-3">
                  Seleccionar Carpeta
                </label>

                {selectedCarpetaNombre && (
                  <div className="mb-3 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2">
                    <Folder className="w-4 h-4 text-teal-600" />
                    <span style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm font-medium text-teal-900">
                      Carpeta seleccionada: {selectedCarpetaNombre}
                    </span>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto bg-white">
                    {carpetas.length === 0 ? (
                      <div className="p-8 text-center">
                        <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} className="text-sm text-gray-600">No hay carpetas disponibles</p>
                        <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-xs text-gray-500 mt-1">Crea una carpeta primero</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {carpetas.map((carpeta) => renderCarpeta(carpeta))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedCarpetaId || isSubmitting}
                  style={{
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    backgroundColor: !selectedCarpetaId || isSubmitting ? '#9ca3af' : '#0d9488',
                    cursor: !selectedCarpetaId || isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:hover:bg-gray-400 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Archivando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{esMasivo ? `Archivar ${facturas.length} facturas` : 'Asignar'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
