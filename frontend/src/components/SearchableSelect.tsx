import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const FONT = "'Neutra Text', 'Montserrat', sans-serif";

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
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Enfocar el input al abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-left transition-shadow"
        style={{
          fontFamily: FONT,
          boxShadow: open ? '0 0 0 2px rgba(20,170,184,0.5)' : undefined,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
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
      {open && (
        <div
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{ maxHeight: '260px', display: 'flex', flexDirection: 'column' }}
        >
          {/* Buscador */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00829a]/30"
                style={{ fontFamily: FONT }}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
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
                    backgroundColor: opt.value === value ? 'rgba(20,170,184,0.1)' : undefined,
                    color: opt.value === value ? '#00829a' : '#374151',
                    fontWeight: opt.value === value ? 600 : undefined,
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
      )}
    </div>
  );
}
