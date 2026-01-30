import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import type { 
  CentroCosto, 
  CentroOperacion, 
  UnidadNegocio, 
  CuentaAuxiliar,
  DistribucionCCCO 
} from '../lib/api';

interface DistribucionRow {
  tempId: string;
  centro_costo_id: string;
  centro_operacion_id: string;
  unidad_negocio_id: string;
  cuenta_auxiliar_id: string;
  porcentaje: string;
}

interface Props {
  facturaId: string;
  distribuciones: DistribucionCCCO[];
  centrosCosto: CentroCosto[];
  centrosOperacion: CentroOperacion[];
  unidadesNegocio: UnidadNegocio[];
  cuentasAuxiliares: CuentaAuxiliar[];
  onSave: (distribuciones: Omit<DistribucionCCCO, 'id' | 'factura_id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  saving: boolean;
}

export function DistribucionCCCOTable({
  facturaId,
  distribuciones,
  centrosCosto,
  centrosOperacion,
  unidadesNegocio,
  cuentasAuxiliares,
  onSave,
  saving
}: Props) {
  const [rows, setRows] = useState<DistribucionRow[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [centrosOperacionPorCosto, setCentrosOperacionPorCosto] = useState<Record<string, CentroOperacion[]>>({});

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
        const nuevaFila = { ...r, [campo]: valor };
        
        // Si cambia el centro de costo, resetear centro de operación
        if (campo === 'centro_costo_id') {
          nuevaFila.centro_operacion_id = '';
          
          // Cargar centros de operación para este centro de costo
          if (valor) {
            const cosFiltrados = centrosOperacion.filter(co => co.centro_costo_id === valor);
            setCentrosOperacionPorCosto(prev => ({
              ...prev,
              [tempId]: cosFiltrados
            }));
          }
        }
        
        return nuevaFila;
      }
      return r;
    }));
  };

  const validarYGuardar = async () => {
    const nuevosErrores: Record<string, string> = {};

    // Validar que todas las filas tengan CC y CO
    rows.forEach((row, index) => {
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

    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }

    // Convertir a formato API
    const distribucionesParaEnviar = rows.map(row => ({
      centro_costo_id: row.centro_costo_id,
      centro_operacion_id: row.centro_operacion_id,
      unidad_negocio_id: row.unidad_negocio_id || null,
      cuenta_auxiliar_id: row.cuenta_auxiliar_id || null,
      porcentaje: parseFloat(row.porcentaje)
    }));

    await onSave(distribucionesParaEnviar);
    setErrores({});
  };

  const totalPorcentaje = rows.reduce((sum, row) => {
    const p = parseFloat(row.porcentaje);
    return sum + (isNaN(p) ? 0 : p);
  }, 0);

  const totalValido = Math.abs(totalPorcentaje - 100) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-gray-900 font-semibold text-lg" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Distribución CC/CO</h4>
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
      </div>

      <p className="text-sm text-gray-600" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
        Divide esta factura en múltiples clasificaciones contables con porcentajes. Los porcentajes deben sumar 100%.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>CC</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>CO</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>UN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>CA</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>%</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-16" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const cosDisponibles = centrosOperacionPorCosto[row.tempId] || 
                centrosOperacion.filter(co => co.centro_costo_id === row.centro_costo_id);

              return (
                <tr key={row.tempId} className="border-b border-gray-100 hover:bg-gray-50">
                  {/* Centro de Costo */}
                  <td className="px-3 py-2">
                    <select
                      value={row.centro_costo_id}
                      onChange={(e) => actualizarFila(row.tempId, 'centro_costo_id', e.target.value)}
                      className={`w-full px-2 py-1 text-sm border rounded focus:outline-none ${
                        errores[`${row.tempId}_cc`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                      onBlur={(e) => e.target.style.boxShadow = ''}
                    >
                      <option value="">Seleccionar</option>
                      {centrosCosto.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                      ))}
                    </select>
                  </td>

                  {/* Centro de Operación */}
                  <td className="px-3 py-2">
                    <select
                      value={row.centro_operacion_id}
                      onChange={(e) => actualizarFila(row.tempId, 'centro_operacion_id', e.target.value)}
                      disabled={!row.centro_costo_id}
                      className={`w-full px-2 py-1 text-sm border rounded focus:outline-none ${
                        errores[`${row.tempId}_co`] ? 'border-red-500' : 'border-gray-300'
                      } ${!row.centro_costo_id ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                      onBlur={(e) => e.target.style.boxShadow = ''}
                    >
                      <option value="">Seleccionar</option>
                      {cosDisponibles.map(co => (
                        <option key={co.id} value={co.id}>{co.nombre}</option>
                      ))}
                    </select>
                  </td>

                  {/* Unidad de Negocio */}
                  <td className="px-3 py-2">
                    <select
                      value={row.unidad_negocio_id}
                      onChange={(e) => actualizarFila(row.tempId, 'unidad_negocio_id', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none"
                      style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                      onBlur={(e) => e.target.style.boxShadow = ''}
                    >
                      <option value="">Opcional</option>
                      {unidadesNegocio.map(un => (
                        <option key={un.id} value={un.id}>{un.codigo}</option>
                      ))}
                    </select>
                  </td>

                  {/* Cuenta Auxiliar */}
                  <td className="px-3 py-2">
                    <select
                      value={row.cuenta_auxiliar_id}
                      onChange={(e) => actualizarFila(row.tempId, 'cuenta_auxiliar_id', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none"
                      style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                      onBlur={(e) => e.target.style.boxShadow = ''}
                    >
                      <option value="">Opcional</option>
                      {cuentasAuxiliares.map(ca => (
                        <option key={ca.id} value={ca.id}>{ca.codigo}</option>
                      ))}
                    </select>
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
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all border-2"
          style={{
            backgroundColor: saving || rows.length === 0 ? '#f3f4f6' : 'transparent',
            borderColor: saving || rows.length === 0 ? '#d1d5db' : '#00829a',
            color: saving || rows.length === 0 ? '#9ca3af' : '#00829a',
            cursor: saving || rows.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => {
            if (!saving && rows.length > 0) {
              e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.05)';
              e.currentTarget.style.borderColor = '#14aab8';
            }
          }}
          onMouseLeave={(e) => {
            if (!saving && rows.length > 0) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#00829a';
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
}
