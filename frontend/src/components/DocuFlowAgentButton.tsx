import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Clock, Zap, Search, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BTN_H = 48;
const PANEL_H = 420;
const PANEL_W = 360;

export function DocuFlowAgentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: 24,
    y: window.innerHeight - BTN_H - 24,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragged = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const { user } = useAuth();

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      dragged.current = false;
      origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isDragging) return;
      const dx = e.clientX - origin.current.mx;
      const dy = e.clientY - origin.current.my;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - BTN_H, origin.current.px + dx)),
        y: Math.max(0, Math.min(window.innerHeight - BTN_H, origin.current.py + dy)),
      });
    },
    [isDragging],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    if (!dragged.current) setIsOpen((prev) => !prev);
  }, []);

  if (!user) return null;

  // Panel va arriba si hay espacio, sino abajo
  const panelAbove = pos.y > PANEL_H + 16;
  const panelTop = panelAbove ? pos.y - PANEL_H - 8 : pos.y + BTN_H + 8;
  const panelLeft = Math.max(8, Math.min(pos.x, window.innerWidth - PANEL_W - 8));

  return createPortal(
    <>
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          left: panelLeft,
          top: panelTop,
          width: PANEL_W,
          zIndex: 99998,
          borderRadius: 18,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
          backgroundColor: '#ffffff',
          fontFamily: '"Montserrat", system-ui, sans-serif',
        }}
      >
        {/* Header del panel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 16px 14px',
            background: 'linear-gradient(135deg, #14aab8 0%, #0d8a96 100%)',
            color: 'white',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>DocuFlow Agent AI</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Asistente inteligente</div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0fdfd, #e0f7fa)',
              border: '2px solid #b2ebf2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              position: 'relative',
            }}
          >
            <Clock size={28} color="#14aab8" />
            <div
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: '#14aab8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={11} color="white" />
            </div>
          </div>

          <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
            ¡Próximamente!
          </h3>

          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Una IA que te permitirá consultar rápido y al instante{' '}
            <strong style={{ color: '#14aab8' }}>facturas, procesos</strong> y mucho más.
            <br />
            <br />
            <span style={{ fontWeight: 600, color: '#374151' }}>Estamos trabajando en ello.</span>
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            {[
              { icon: <Search size={12} />, label: 'Buscar facturas' },
              { icon: <FileText size={12} />, label: 'Consultar procesos' },
              { icon: <Zap size={12} />, label: 'Respuestas al instante' },
              { icon: <Sparkles size={12} />, label: 'IA avanzada' },
            ].map((chip) => (
              <span
                key={chip.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 999,
                  backgroundColor: '#f0fdfd',
                  border: '1px solid #b2ebf2',
                  fontSize: 11,
                  color: '#0d8a96',
                  fontWeight: 600,
                }}
              >
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>

          <div style={{ height: 4, borderRadius: 999, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: '65%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #14aab8, #0d8a96)',
                animation: 'pulse-bar 2s ease-in-out infinite',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: '#9ca3af' }}>En desarrollo…</p>
        </div>
      </div>

      {/* Botón flotante — colapsa a círculo cuando está cerrado */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label={isOpen ? 'Cerrar DocuFlow Agent AI' : 'Abrir DocuFlow Agent AI'}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 99999,
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isOpen ? 8 : 0,
          // Ancho: pill cuando abierto, círculo cuando cerrado
          width: isOpen ? 'auto' : BTN_H,
          height: BTN_H,
          minWidth: BTN_H,
          padding: isOpen ? '0 18px' : 0,
          borderRadius: 999,
          border: 'none',
          background: isOpen
            ? 'linear-gradient(135deg, #0d8a96, #0a7380)'
            : 'linear-gradient(135deg, #14aab8, #0d8a96)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: '"Montserrat", system-ui, sans-serif',
          boxShadow: isDragging
            ? '0 8px 30px rgba(20,170,184,0.5)'
            : '0 4px 20px rgba(20,170,184,0.4)',
          transition: isDragging
            ? 'box-shadow 0.15s ease'
            : 'width 0.2s ease, padding 0.2s ease, background 0.2s ease, box-shadow 0.15s ease',
          userSelect: 'none',
          touchAction: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'flex',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          {isOpen ? <X size={18} /> : <Sparkles size={20} />}
        </span>
        {isOpen && <span>Cerrar</span>}
      </button>

      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>,
    document.body,
  );
}
