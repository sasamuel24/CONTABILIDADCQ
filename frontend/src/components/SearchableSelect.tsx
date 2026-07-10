import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

const FONT = "'Neutra Text', 'Montserrat', sans-serif";

// Altura estimada del dropdown (buscador + lista) para decidir si abre hacia arriba
const ALTO_PANEL = 300;

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Renderiza el dropdown en document.body con position:fixed.
   *  Necesario cuando un ancestro tiene overflow-hidden (p. ej. las tarjetas de gasto). */
  portal?: boolean;
}

// Búsqueda insensible a tildes: "logistica" encuentra "LOGÍSTICA"
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  className = '',
  disabled = false,
  portal = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => normalizar(o.label).includes(normalizar(query.trim())))
    : options;

  const recalcular = () => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const arriba = r.bottom + ALTO_PANEL > window.innerHeight && r.top > ALTO_PANEL;
    setRect({ top: arriba ? r.top : r.bottom, left: r.left, width: r.width, arriba });
  };

  // Cerrar al hacer clic/tocar fuera (incluye el panel del portal)
  useEffect(() => {
    function onClickOutside(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('touchstart', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('touchstart', onClickOutside);
    };
  }, []);

  // Enfocar el input al abrir; en modo portal, seguir al trigger en scroll/resize
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (!portal) return;
    const onMove = () => recalcular();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, portal]);

  function handleToggle() {
    if (disabled) return;
    if (!open && portal) recalcular();
    setOpen(v => !v);
    setQuery('');
  }

  function handleSelect(opt: Option) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  const dropdown = (
    <div
      ref={panelRef}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
      style={{
        maxHeight: '260px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
        ...(portal && rect
          ? {
              position: 'fixed',
              zIndex: 9999,
              left: rect.left,
              width: rect.width,
              ...(rect.arriba
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.top + 4 }),
            }
          : { position: 'absolute', zIndex: 50, marginTop: 4, width: '100%' }),
      }}
    >
      {/* Buscador */}
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQuery(''); }
            if (e.key === 'Enter') { e.preventDefault(); if (filtered.length > 0) handleSelect(filtered[0]); }
          }}
          placeholder="Buscar..."
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00829a]/30"
          style={{ fontFamily: FONT, fontSize: 14 }}
        />
      </div>

      {/* Lista */}
      <div className="overflow-y-auto" style={{ maxHeight: '200px', WebkitOverflowScrolling: 'touch' }}>
        {filtered.length === 0 ? (
          <div
            className="px-4 py-3 text-sm text-gray-400 text-center"
            style={{ fontFamily: FONT }}
          >
            Sin resultados para "{query}"
          </div>
        ) : (
          filtered.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{
                fontFamily: FONT,
                padding: '10px 14px',
                backgroundColor: opt.value === value ? 'rgba(20,170,184,0.1)' : undefined,
                color: opt.value === value ? '#00829a' : '#374151',
                fontWeight: opt.value === value ? 600 : undefined,
                overflowWrap: 'anywhere',
              }}
              onMouseEnter={e => {
                if (opt.value !== value)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={e => {
                if (opt.value !== value)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
              }}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-left transition-shadow"
        style={{
          fontFamily: FONT,
          minHeight: 42,
          boxShadow: open ? '0 0 0 2px rgba(20,170,184,0.5)' : undefined,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          className={selected ? 'text-gray-900' : 'text-gray-400'}
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              aria-label="Limpiar selección"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className="w-4 h-4 text-gray-400 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : undefined }}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (portal ? (rect && createPortal(dropdown, document.body)) : dropdown)}
    </div>
  );
}
