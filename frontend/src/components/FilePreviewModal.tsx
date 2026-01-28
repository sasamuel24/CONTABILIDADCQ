import { X } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

interface FilePreviewModalProps {
  fileId: string;
  filename: string;
  contentType: string;
  storagePath?: string;
  facturaId?: string;
  onClose: () => void;
  onDownload: () => void;
}

export function FilePreviewModal({ 
  fileId, 
  filename, 
  contentType,
  storagePath,
  facturaId,
  onClose,
  onDownload
}: FilePreviewModalProps) {
  // Si el ID es el UUID vacío y tenemos storage_path, usar el endpoint de S3
  const isTemporaryId = fileId === '00000000-0000-0000-0000-000000000000';
  const baseUrl = isTemporaryId && storagePath && facturaId
    ? `${API_BASE_URL}/api/v1/facturas/${facturaId}/files/download?key=${encodeURIComponent(storagePath)}&inline=true`
    : `${API_BASE_URL}/api/v1/files/${fileId}/preview`;

  const isPDF = contentType === 'application/pdf';
  
  // URL con zoom optimizado para PDFs
  const previewUrl = isPDF 
    ? `${baseUrl}#zoom=page-width&view=FitH`
    : baseUrl;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white flex flex-col"
        style={{
          width: 'min(1400px, 96vw)',
          height: '95vh',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo - 56px */}
        <div 
          className="flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0"
          style={{ height: '56px' }}
        >
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {filename}
          </h3>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Body - ocupa el resto del espacio */}
        <div className="flex-1 overflow-hidden" style={{ padding: 0 }}>
          {isPDF ? (
            <iframe
              src={previewUrl}
              className="border-0"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
              title={filename}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="text-center p-6">
                <p className="text-gray-600 mb-4">
                  Vista previa no disponible para este tipo de archivo
                </p>
                <button
                  onClick={onDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Descargar archivo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
