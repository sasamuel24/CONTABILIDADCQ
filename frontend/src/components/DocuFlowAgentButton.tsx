import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Clock, Zap, Search, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DocuFlowAgentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;

  return createPortal(
    <>
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '24px',
          width: '360px',
          zIndex: 99998,
          borderRadius: '18px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          backgroundColor: '#ffffff',
          fontFamily: '"Montserrat", system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
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

        {/* Coming soon body */}
        <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
          {/* Ícono animado */}
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

          <h3
            style={{
              margin: '0 0 10px',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.3,
            }}
          >
            ¡Próximamente!
          </h3>

          <p
            style={{
              margin: '0 0 20px',
              fontSize: 13,
              color: '#6b7280',
              lineHeight: 1.6,
            }}
          >
            Una IA que te permitirá consultar rápido y al instante{' '}
            <strong style={{ color: '#14aab8' }}>facturas, procesos</strong> y mucho más.
            <br />
            <br />
            <span style={{ fontWeight: 600, color: '#374151' }}>Estamos trabajando en ello.</span>
          </p>

          {/* Feature chips */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '20px',
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
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '999px',
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

          {/* Progress bar decorativa */}
          <div
            style={{
              height: 4,
              borderRadius: '999px',
              backgroundColor: '#f3f4f6',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '65%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #14aab8, #0d8a96)',
                animation: 'pulse-bar 2s ease-in-out infinite',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: '#9ca3af' }}>En desarrollo…</p>
        </div>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Cerrar DocuFlow Agent AI' : 'Abrir DocuFlow Agent AI'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          borderRadius: '999px',
          border: 'none',
          cursor: 'pointer',
          background: isOpen
            ? 'linear-gradient(135deg, #0d8a96, #0a7380)'
            : 'linear-gradient(135deg, #14aab8, #0d8a96)',
          color: 'white',
          fontFamily: 'inherit',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(20,170,184,0.4)',
          transition: 'all 0.2s ease',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        <span
          style={{
            display: 'flex',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {isOpen ? <X size={18} /> : <Sparkles size={18} />}
        </span>
        <span>{isOpen ? 'Cerrar' : 'DocuFlow Agent AI'}</span>
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
