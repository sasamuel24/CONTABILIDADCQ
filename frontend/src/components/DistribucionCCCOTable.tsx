import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, AlertCircle, ChevronDown, Search } from 'lucide-react';
import type {
  CentroCosto,
  CentroOperacion,
  UnidadNegocio,
  CuentaAuxiliar,
  DistribucionCCCO
} from '../lib/api';

interface SearchableSelectOption {
  id: string;
  label: string;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  hasError,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.id === value);
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 260;
      const top = spaceBelow >= dropdownHeight
        ? rect.bottom + 4
        : rect.top - dropdownHeight - 4;
      setDropdownStyle({
        position: 'fixed',
        top,
        left: rect.left,
        width: Math.max(rect.width, 240),
        zIndex: 9999,
      });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between px-2 py-1 text-sm border rounded focus:outline-none bg-white text-left ${
          hasError ? 'border-red-500' : 'border-gray-300'
        }`}
        style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif", boxShadow: open ? '0 0 0 2px rgba(20, 170, 184, 0.5)' : '' }}
      >
        <span className={selected ? 'text-gray-900 truncate' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...dropdownStyle,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '260px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb' }}>
              <Search className="w-3.5 h-3.5 text-gray-400" style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar..."
                style={{ flex: 1, fontSize: '13px', background: 'transparent', outline: 'none', color: '#374151', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
              />
            </div>
          </div>
          <ul style={{ overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, padding: '4px 0', margin: 0, listStyle: 'none' }}>
            <li
              onClick={() => handleSelect('')}
              style={{ padding: '6px 12px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {placeholder}
            </li>
            {filtered.length === 0 ? (
              <li style={{ padding: '8px 12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>Sin resultados</li>
            ) : (
              filtered.map(o => (
                <li
                  key={o.id}
                  onClick={() => handleSelect(o.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                    background: o.id === value ? '#f0fdfa' : 'transparent',
                    color: o.id === value ? '#0f766e' : '#374151',
                    fontWeight: o.id === value ? 500 : 400,
                  }}
                  onMouseEnter={e => { if (o.id !== value) e.currentTarget.style.background = '#f0fdfa'; }}
                  onMouseLeave={e => { if (o.id !== value) e.currentTarget.style.background = 'transparent'; }}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}

interface DistribucionRow {
  tempId: string;
  centro_costo_id: string;
  centro_operacion_id: string;
  unidad_negocio_id: string;
  cuenta_auxiliar_id: string;
  porcentaje: string;
}

type DistribucionParaGuardar = Omit<DistribucionCCCO, 'id' | 'factura_id' | 'created_at' | 'updated_at'>;

export type DistribucionCCCOTableHandle = {
  /**
   * Valida las filas actuales (marcando errores en la UI) y devuelve las
   * distribuciones listas para enviar. Permite que el botón global de
   * "Guardar Cambios" persista la distribución sin un clic separado.
   */
  obtenerDistribucionesValidas: () =>
    | { ok: true; distribuciones: DistribucionParaGuardar[] }
    | { ok: false; error: string };
};

interface Props {
  facturaId: string;
  distribuciones: DistribucionCCCO[];
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  unidadesNegocio: UnidadNegocio[];
  cuentasAuxiliares: CuentaAuxiliar[];
  onSave: (distribuciones: DistribucionParaGuardar[]) => Promise<void>;
  saving: boolean;
  requerida?: boolean;
}

export const DistribucionCCCOTable = forwardRef<DistribucionCCCOTableHandle, Props>(function DistribucionCCCOTable({
  facturaId,
  distribuciones,
  centrosCosto,
  centrosOperacion,
  unidadesNegocio,
  cuentasAuxiliares,
  onSave,
  saving,
  requerida = true
}, ref) {
  const [rows, setRows] = useState<DistribucionRow[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Debug: ver qué datos están llegando
  useEffect(() => {
    console.log('📊 Datos recibidos en DistribucionCCCOTable:', {
      centrosCosto: centrosCosto.length,
      centrosOperacion: centrosOperacion.length,
      unidadesNegocio: unidadesNegocio.length,
      cuentasAuxiliares: cuentasAuxiliares.length
    });
  }, [centrosCosto, centrosOperacion, unidadesNegocio, cuentasAuxiliares]);

  // Cargar distribuciones existentes al montar
  useEffect(() => {
    if (distribuciones.length > 0) {
      const rowsFromApi: DistribucionRow[] = distribuciones.map(d => ({
        tempId: d.id || crypto.randomUUID(),
        centro_costo_id: d.centro_costo_id,
        centro_operacion_id: d.centro_operacion_id,
        unidad_negocio_id: d.unidad_negocio_id || '',
        cuenta_auxiliar_id: d.cuenta_auxiliar_id || '',
        porcentaje: d.porcentaje.toString()
      }));
      setRows(rowsFromApi);
    } else {
      // Iniciar con una fila vacía
      agregarFila();
    }
  }, [distribuciones]);

  const agregarFila = () => {
    const nuevaFila: DistribucionRow = {
      tempId: crypto.randomUUID(),
      centro_costo_id: '',
      centro_operacion_id: '',
      unidad_negocio_id: '',
      cuenta_auxiliar_id: '',
      porcentaje: ''
    };
    setRows([...rows, nuevaFila]);
  };

  const eliminarFila = (tempId: string) => {
    if (rows.length === 1) {
      // No permitir eliminar la última fila, mejor limpiarla
      setRows([{
        tempId: crypto.randomUUID(),
        centro_costo_id: '',
        centro_operacion_id: '',
        unidad_negocio_id: '',
        cuenta_auxiliar_id: '',
        porcentaje: ''
      }]);
    } else {
      setRows(rows.filter(r => r.tempId !== tempId));
    }
  };

  const actualizarFila = (tempId: string, campo: keyof DistribucionRow, valor: string) => {
    setRows(rows.map(r => {
      if (r.tempId === tempId) {
        return { ...r, [campo]: valor };
      }
      return r;
    }));
  };

  // Valida las filas actuales y construye el payload. No toca la UI ni la red.
  const construirDistribuciones = (): {
    errores: Record<string, string>;
    distribuciones: DistribucionParaGuardar[] | null;
  } => {
    const nuevosErrores: Record<string, string> = {};

    // Validar que todas las filas tengan CC y CO
    rows.forEach((row) => {
      if (!row.centro_costo_id) {
        nuevosErrores[`${row.tempId}_cc`] = 'Requerido';
      }
      if (!row.centro_operacion_id) {
        nuevosErrores[`${row.tempId}_co`] = 'Requerido';
      }
      if (!row.porcentaje || parseFloat(row.porcentaje) <= 0) {
        nuevosErrores[`${row.tempId}_porcentaje`] = 'Debe ser mayor a 0';
      }
    });

    // Validar que los porcentajes sumen 100
    const totalPorcentaje = rows.reduce((sum, row) => {
      const p = parseFloat(row.porcentaje);
      return sum + (isNaN(p) ? 0 : p);
    }, 0);

    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      nuevosErrores.total = `Los porcentajes deben sumar 100%. Total actual: ${totalPorcentaje.toFixed(2)}%`;
    }

    if (Object.keys(nuevosErrores).length > 0) {
      return { errores: nuevosErrores, distribuciones: null };
    }

    // Convertir a formato API
    const distribucionesParaEnviar = rows.map(row => ({
      centro_costo_id: row.centro_costo_id,
      centro_operacion_id: row.centro_operacion_id,
      unidad_negocio_id: row.unidad_negocio_id || null,
      cuenta_auxiliar_id: row.cuenta_auxiliar_id || null,
      porcentaje: parseFloat(row.porcentaje)
    }));

    return { errores: {}, distribuciones: distribucionesParaEnviar };
  };

  const validarYGuardar = async () => {
    const { errores: nuevosErrores, distribuciones: data } = construirDistribuciones();
    setErrores(nuevosErrores);

    if (!data) {
      return;
    }

    await onSave(data);
    setErrores({});
  };

  // Permite que el botón global "Guardar Cambios" del responsable persista la
  // distribución sin depender de un clic separado en "Guardar Distribución".
  useImperativeHandle(ref, () => ({
    obtenerDistribucionesValidas: () => {
      const { errores: nuevosErrores, distribuciones: data } = construirDistribuciones();
      setErrores(nuevosErrores);

      if (!data) {
        const mensaje = nuevosErrores.total
          || 'Hay filas de distribución incompletas: CC, CO y % son obligatorios';
        return { ok: false as const, error: mensaje };
      }

      return { ok: true as const, distribuciones: data };
    }
  }), [rows]);

  const totalPorcentaje = rows.reduce((sum, row) => {
    const p = parseFloat(row.porcentaje);
    return sum + (isNaN(p) ? 0 : p);
  }, 0);

  const totalValido = Math.abs(totalPorcentaje - 100) < 0.01;

  return (
    <div className={`space-y-4 ${!requerida ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-gray-900 font-semibold text-lg" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Distribución CC/CO</h4>
        {requerida ? (
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: totalValido && totalPorcentaje > 0 ? 'rgba(20, 170, 184, 0.1)' : '#fef3c7',
              color: totalValido && totalPorcentaje > 0 ? '#00829a' : '#92400e',
              fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
            }}
          >
            Total: {totalPorcentaje.toFixed(2)}%
          </span>
        ) : (
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
          >
            No requerida
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
        Divide esta factura en múltiples clasificaciones contables con porcentajes. Los porcentajes deben sumar 100%.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>CO <span className="text-red-500">*</span></th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>CC <span className="text-red-500">*</span></th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                UN <span className="font-normal text-gray-400 text-xs">(Opcional)</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                CA <span className="font-normal text-gray-400 text-xs">(Opcional)</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>% <span className="text-red-500">*</span></th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-16" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              return (
                <tr key={row.tempId} className="border-b border-gray-100 hover:bg-gray-50">
                  {/* Centro de Operación */}
                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={row.centro_operacion_id}
                      onChange={(val) => actualizarFila(row.tempId, 'centro_operacion_id', val)}
                      options={centrosOperacion.map(co => ({ id: co.id, label: `${co.codigo} - ${co.nombre}` }))}
                      placeholder="Seleccionar"
                      hasError={!!errores[`${row.tempId}_co`]}
                    />
                  </td>

                  {/* Centro de Costo */}
                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={row.centro_costo_id}
                      onChange={(val) => actualizarFila(row.tempId, 'centro_costo_id', val)}
                      options={centrosCosto.map(cc => ({ id: cc.id, label: `${cc.codigo} - ${cc.nombre}` }))}
                      placeholder="Seleccionar"
                      hasError={!!errores[`${row.tempId}_cc`]}
                    />
                  </td>

                  {/* Unidad de Negocio */}
                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={row.unidad_negocio_id}
                      onChange={(val) => actualizarFila(row.tempId, 'unidad_negocio_id', val)}
                      options={unidadesNegocio.map(un => ({ id: un.id, label: un.codigo }))}
                      placeholder="Opcional"
                    />
                  </td>

                  {/* Cuenta Auxiliar */}
                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={row.cuenta_auxiliar_id}
                      onChange={(val) => actualizarFila(row.tempId, 'cuenta_auxiliar_id', val)}
                      options={cuentasAuxiliares.map(ca => ({ id: ca.id, label: ca.codigo }))}
                      placeholder="Opcional"
                    />
                  </td>

                  {/* Porcentaje */}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={row.porcentaje}
                      onChange={(e) => actualizarFila(row.tempId, 'porcentaje', e.target.value)}
                      className={`w-full px-2 py-1 text-sm border rounded focus:outline-none ${
                        errores[`${row.tempId}_porcentaje`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                      onBlur={(e) => e.target.style.boxShadow = ''}
                      placeholder="0.00"
                    />
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => eliminarFila(row.tempId)}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Errores */}
      {errores.total && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errores.total}</p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={agregarFila}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors"
          style={{
            borderColor: '#d1d5db',
            color: '#374151',
            fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.1)';
            e.currentTarget.style.borderColor = '#00829a';
            e.currentTarget.style.color = '#00829a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.color = '#374151';
          }}
        >
          <Plus className="w-4 h-4" />
          Agregar línea
        </button>

        <button
          onClick={validarYGuardar}
          disabled={saving || rows.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all"
          style={{
            backgroundColor: saving || rows.length === 0 ? '#9ca3af' : '#00829a',
            color: 'white',
            cursor: saving || rows.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => {
            if (!saving && rows.length > 0) {
              e.currentTarget.style.backgroundColor = '#14aab8';
            }
          }}
          onMouseLeave={(e) => {
            if (!saving && rows.length > 0) {
              e.currentTarget.style.backgroundColor = '#00829a';
            }
          }}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              Guardando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Guardar Distribución
            </>
          )}
        </button>
      </div>
    </div>
  );
});
