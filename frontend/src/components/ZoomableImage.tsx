import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt: string;
}

/**
 * Imagen con zoom (slider + botones), scroll independiente del viewport y
 * paneo con arrastre del mouse. Úsalo dentro de un contenedor con height
 * definida (flex-1, h-full, etc.) y overflow-hidden.
 */
export function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [zoom, setZoom] = useState(1);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const zoomPct = Math.round(zoom * 100);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!baseSize) {
      setBaseSize({
        w: e.currentTarget.offsetWidth,
        h: e.currentTarget.offsetHeight,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    setDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      const d = dragRef.current;
      if (!el || !d) return;
      el.scrollLeft = d.sl - (e.clientX - d.x);
      el.scrollTop = d.st - (e.clientY - d.y);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

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

        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
          Arrastra la imagen para moverte
        </span>
      </div>

      {/*
       * Contenedor scrollable independiente del viewport, con paneo por arrastre.
       * El inner div usa width:fit-content + margin:auto en la imagen: centra
       * cuando la imagen cabe y, cuando desborda por el zoom, TODO el contenido
       * queda alcanzable con scroll (justify-content:center dejaría el desborde
       * izquierdo/superior fuera del alcance del scroll).
       */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#f1f5f9',
          position: 'relative',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 'fit-content',
            minWidth: '100%',
            minHeight: '100%',
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <img
            src={src}
            alt={alt}
            onLoad={handleImgLoad}
            draggable={false}
            style={{
              display: 'block',
              flexShrink: 0,
              margin: 'auto',
              userSelect: 'none',
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
