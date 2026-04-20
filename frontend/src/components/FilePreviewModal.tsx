import { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

interface ImgSize { w: number; h: number; }

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
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState<ImgSize | null>(null);

  const isTemporaryId = fileId === '00000000-0000-0000-0000-000000000000';
  const baseUrl = isTemporaryId && storagePath && facturaId
    ? `${API_BASE_URL}/facturas/${facturaId}/files/download?key=${encodeURIComponent(storagePath)}&inline=true`
    : `${API_BASE_URL}/files/${fileId}/preview`;

  const isPDF = contentType === 'application/pdf'
    || /\.pdf$/i.test(filename);
  const isImage = contentType?.startsWith('image/')
    || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(filename);

  const previewUrl = isPDF
    ? `${baseUrl}#zoom=page-width&view=FitH`
    : baseUrl;

  const zoomPct = Math.round(zoom * 100);

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
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0 gap-4"
          style={{ height: '56px' }}
        >
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 min-w-0">
            {filename}
          </h3>

          {(isPDF || isImage) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Reducir zoom"
              >
                <ZoomOut className="w-4 h-4 text-gray-600" />
              </button>

              <input
                type="range"
                min="0.25"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-28 accent-teal-600"
                title={`Zoom: ${zoomPct}%`}
              />

              <button
                onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4 text-gray-600" />
              </button>

              <button
                onClick={() => setZoom(1)}
                className="text-xs text-gray-500 hover:text-teal-600 w-12 text-center transition-colors"
                title="Restablecer zoom"
              >
                {zoomPct}%
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden" style={{ padding: 0 }}>
          {isPDF ? (
            <div className="w-full h-full overflow-auto" style={{ background: '#525659' }}>
              <div style={{
                width: zoom === 1 ? '100%' : `${zoom * 100}%`,
                height: zoom === 1 ? '100%' : `${zoom * 100}%`,
                minWidth: '100%',
                minHeight: '100%',
              }}>
                <iframe
                  src={previewUrl}
                  className="border-0"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                  title={filename}
                />
              </div>
            </div>
          ) : isImage ? (
            <div
              className="w-full h-full overflow-auto bg-gray-50"
              style={{ display: 'grid', placeItems: zoom <= 1 ? 'center' : 'start' }}
            >
              <img
                src={baseUrl}
                alt={filename}
                onLoad={(e) => setImgSize({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })}
                style={{
                  display: 'block',
                  width:    imgSize ? `${imgSize.w * zoom}px` : 'auto',
                  height:   imgSize ? `${imgSize.h * zoom}px` : 'auto',
                  maxWidth:  zoom <= 1 ? '100%' : 'none',
                  maxHeight: zoom <= 1 ? '100%' : 'none',
                  margin: zoom <= 1 ? 'auto' : '16px',
                  transition: 'width 0.15s ease, height 0.15s ease',
                }}
              />
            </div>
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
