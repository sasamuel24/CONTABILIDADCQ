import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt: string;
}

/**
 * Imagen con zoom (slider + botones) y scroll independiente del viewport.
 * Úsalo dentro de un contenedor con height definida (flex-1, h-full, etc.)
 * y overflow-hidden.
 */
export function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [zoom, setZoom] = useState(1);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);

  const zoomPct = Math.round(zoom * 100);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!baseSize) {
      setBaseSize({
        w: e.currentTarget.offsetWidth,
        h: e.currentTarget.offsetHeight,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Barra de zoom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 14px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
          style={{
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Reducir zoom"
        >
          <ZoomOut style={{ width: 14, height: 14, color: '#374151' }} />
        </button>

        <input
          type="range"
          min="0.25"
          max="4"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          style={{ width: 110, accentColor: '#00829a', cursor: 'pointer' }}
          title="Zoom"
        />

        <button
          onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
          style={{
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Aumentar zoom"
        >
          <ZoomIn style={{ width: 14, height: 14, color: '#374151' }} />
        </button>

        <button
          onClick={() => setZoom(1)}
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            color: zoom !== 1 ? '#00829a' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            minWidth: 52,
            justifyContent: 'center',
          }}
          title="Restablecer zoom"
        >
          <RotateCcw style={{ width: 11, height: 11 }} />
          {zoomPct}%
        </button>
      </div>

      {/*
       * Contenedor scrollable independiente del viewport.
       * overflow:auto genera las barras de scroll dentro del modal.
       * El inner div crece con el zoom forzando el scroll.
       */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#f1f5f9',
          position: 'relative',
        }}
      >
        <div
          style={{
            minWidth: '100%',
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <img
            src={src}
            alt={alt}
            onLoad={handleImgLoad}
            style={{
              display: 'block',
              flexShrink: 0,
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              borderRadius: 4,
              ...(baseSize
                ? {
                    width: `${baseSize.w * zoom}px`,
                    height: `${baseSize.h * zoom}px`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }
                : {
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                  }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
