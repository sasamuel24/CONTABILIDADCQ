import React, { useState, useEffect } from 'react';
import { X, Folder, Check } from 'lucide-react';
import { getCarpetas, asignarFacturaACarpeta, type Carpeta, type FacturaListItem } from '../lib/api';

interface AsignarCarpetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  factura: FacturaListItem;
  onSuccess: () => void;
}

export function AsignarCarpetaModal({ isOpen, onClose, factura, onSuccess }: AsignarCarpetaModalProps) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [selectedCarpetaId, setSelectedCarpetaId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCarpetas();
    }
  }, [isOpen]);

  const loadCarpetas = async () => {
    try {
      setIsLoading(true);
      const data = await getCarpetas();
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
      await asignarFacturaACarpeta(factura.id, { carpeta_id: selectedCarpetaId });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al asignar carpeta';
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCarpetaOption = (carpeta: Carpeta, level: number = 0): React.ReactElement[] => {
    const indent = '　'.repeat(level); // Espacio japonés para indentación
    const elements: React.ReactElement[] = [
      <option key={carpeta.id} value={carpeta.id}>
        {indent}{carpeta.nombre}
      </option>
    ];

    if (carpeta.children && carpeta.children.length > 0) {
      carpeta.children.forEach(child => {
        elements.push(...renderCarpetaOption(child, level + 1));
      });
    }

    return elements;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Asignar a Carpeta</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Info de la factura */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Factura:</p>
            <p className="font-mono font-medium text-gray-900">{factura.numero_factura}</p>
            <p className="text-sm text-gray-700 mt-1">{factura.proveedor}</p>
          </div>

          {/* Selector de carpeta */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Carpeta
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedCarpetaId}
                  onChange={(e) => setSelectedCarpetaId(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona una carpeta...</option>
                  {carpetas.map(carpeta => renderCarpetaOption(carpeta))}
                </select>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedCarpetaId || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Asignando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Asignar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
