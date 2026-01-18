import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Download, FileText } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion } from '../lib/api';
import { getFacturaFilesByDocType, getCentrosCosto, getCentrosOperacion, asignarFactura, devolverAResponsable } from '../lib/api';

interface ContabilidadFacturaDetailProps {
  factura: FacturaListItem;
  onClose: () => void;
}

const statusConfig: Record<string, { color: string; bgColor: string }> = {
  'Recibida': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  'Asignada': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  'En Curso': { color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  'Cerrada': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  'Rechazada': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

const INTERVALOS_ENTREGA = [
  { value: '1_SEMANA', label: '1 Semana' },
  { value: '2_SEMANAS', label: '2 Semanas' },
  { value: '3_SEMANAS', label: '3 Semanas' },
  { value: '1_MES', label: '1 Mes' },
];

interface ChecklistItem {
  label: string;
  isValid: boolean;
  required: boolean;
}

export function ContabilidadFacturaDetail({ factura, onClose }: ContabilidadFacturaDetailProps) {
  const [procesando, setProcesando] = useState(false);
  
  // Estados para modal de devolución
  const [mostrarModalDevolucion, setMostrarModalDevolucion] = useState(false);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [enviandoDevolucion, setEnviandoDevolucion] = useState(false);
  
  // Estados para archivos
  const [archivoOCExistente, setArchivoOCExistente] = useState<FileMiniOut | null>(null);
  const [archivoAprobacionExistente, setArchivoAprobacionExistente] = useState<FileMiniOut | null>(null);
  const [archivoInventarioExistente, setArchivoInventarioExistente] = useState<FileMiniOut | null>(null);
  const [soportePagoFiles, setSoportePagoFiles] = useState<FileMiniOut[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);

  // Estados para centros
  const [centroCosto, setCentroCosto] = useState<CentroCosto | null>(null);
  const [centroOperacion, setCentroOperacion] = useState<CentroOperacion | null>(null);
  const [loadingCentros, setLoadingCentros] = useState(true);

  // Estados para inventarios
  const [requiereInventario, setRequiereInventario] = useState(false);
  const [tipoIngreso, setTipoIngreso] = useState<'tienda' | 'almacen' | ''>('');
  const [oct, setOct] = useState('');
  const [ect, setEct] = useState('');
  const [fpcTienda, setFpcTienda] = useState('');
  const [occ, setOcc] = useState('');
  const [edo, setEdo] = useState('');
  const [fpcAlmacen, setFpcAlmacen] = useState('');

  // Estados para novedad
  const [tieneNovedad, setTieneNovedad] = useState(false);
  const [numeroNotaCredito, setNumeroNotaCredito] = useState('');

  // Estados para anticipo
  const [tieneAnticipo, setTieneAnticipo] = useState(false);
  const [porcentajeAnticipo, setPorcentajeAnticipo] = useState('');
  const [intervaloEntrega, setIntervaloEntrega] = useState('');

  // Cargar archivos existentes
  useEffect(() => {
    const cargarArchivos = async () => {
      try {
        setLoadingArchivos(true);
        
        const [archivosOC, archivosAprobacion, archivosInventario, archivosSoportePago] = await Promise.all([
          getFacturaFilesByDocType(factura.id, 'OC'),
          getFacturaFilesByDocType(factura.id, 'APROBACION_GERENCIA'),
          getFacturaFilesByDocType(factura.id, 'SOPORTE_INVENTARIO'),
          getFacturaFilesByDocType(factura.id, 'FACTURA_PDF')
        ]);
        
        if (archivosOC.length > 0) setArchivoOCExistente(archivosOC[0]);
        if (archivosAprobacion.length > 0) setArchivoAprobacionExistente(archivosAprobacion[0]);
        if (archivosInventario.length > 0) setArchivoInventarioExistente(archivosInventario[0]);
        setSoportePagoFiles(archivosSoportePago);
      } catch (error) {
        console.error('Error cargando archivos:', error);
      } finally {
        setLoadingArchivos(false);
      }
    };

    cargarArchivos();
  }, [factura.id]);

  // Cargar centros de costo y operación
  useEffect(() => {
    const cargarCentros = async () => {
      try {
        setLoadingCentros(true);
        
        if (factura.centro_costo_id) {
          const centrosCosto = await getCentrosCosto(true);
          const cc = centrosCosto.find(c => c.id === factura.centro_costo_id);
          if (cc) setCentroCosto(cc);
        }

        if (factura.centro_operacion_id && factura.centro_costo_id) {
          const centrosOp = await getCentrosOperacion(factura.centro_costo_id, true);
          const co = centrosOp.find(c => c.id === factura.centro_operacion_id);
          if (co) setCentroOperacion(co);
        }
      } catch (error) {
        console.error('Error cargando centros:', error);
      } finally {
        setLoadingCentros(false);
      }
    };

    cargarCentros();
  }, [factura.centro_costo_id, factura.centro_operacion_id]);

  // Cargar datos de inventarios
  useEffect(() => {
    setRequiereInventario(factura.requiere_entrada_inventarios);
    setTieneNovedad(factura.presenta_novedad);
    
    if (factura.destino_inventarios) {
      setTipoIngreso(factura.destino_inventarios === 'TIENDA' ? 'tienda' : 'almacen');
    }

    // Cargar códigos de inventarios
    factura.inventarios_codigos.forEach(codigo => {
      switch (codigo.codigo) {
        case 'OCT':
          setOct(codigo.valor);
          break;
        case 'ECT':
          setEct(codigo.valor);
          break;
        case 'FPC':
          if (factura.destino_inventarios === 'TIENDA') {
            setFpcTienda(codigo.valor);
          } else {
            setFpcAlmacen(codigo.valor);
          }
          break;
        case 'OCC':
          setOcc(codigo.valor);
          break;
        case 'EDO':
          setEdo(codigo.valor);
          break;
        case 'NP':
          setNumeroNotaCredito(codigo.valor);
          break;
      }
    });
  }, [factura]);

  // Cargar datos de anticipo
  useEffect(() => {
    setTieneAnticipo(factura.tiene_anticipo);
    if (factura.porcentaje_anticipo !== null) {
      setPorcentajeAnticipo(factura.porcentaje_anticipo.toString());
    }
    if (factura.intervalo_entrega_contabilidad) {
      setIntervaloEntrega(factura.intervalo_entrega_contabilidad);
    }
  }, [factura]);
  
  // Calcular checklist de auditoría
  const calcularChecklist = (): ChecklistItem[] => {
    const checks: ChecklistItem[] = [
      {
        label: 'OC/OS adjunta',
        isValid: !!archivoOCExistente,
        required: true,
      },
      {
        label: 'Aprobación gerencia adjunta',
        isValid: !!archivoAprobacionExistente,
        required: true,
      },
      {
        label: 'Centro de Costo y Operación diligenciado',
        isValid: !!centroCosto && !!centroOperacion,
        required: true,
      },
    ];

    // Check de inventarios (solo si aplica)
    if (requiereInventario) {
      const inventarioCompleto = tipoIngreso === 'tienda'
        ? !!oct && !!ect && !!fpcTienda && !!archivoInventarioExistente
        : !!occ && !!edo && !!fpcAlmacen && !!archivoInventarioExistente;
      
      checks.push({
        label: 'Inventarios completos',
        isValid: inventarioCompleto,
        required: true,
      });
    }

    // Check de novedad (solo si aplica)
    if (tieneNovedad) {
      checks.push({
        label: 'Nota de Crédito NP registrada',
        isValid: !!numeroNotaCredito,
        required: true,
      });
    }

    // Check de anticipo (solo si aplica)
    if (tieneAnticipo) {
      const porcentaje = parseFloat(porcentajeAnticipo);
      checks.push({
        label: 'Anticipo válido',
        isValid: !isNaN(porcentaje) && porcentaje >= 0 && porcentaje <= 100,
        required: true,
      });
    }

    return checks;
  };

  const checklist = calcularChecklist();
  const todasValidacionesPasadas = checklist.every(item => item.isValid);

  const handleAprobar = async () => {
    setProcesando(true);
    
    try {
      // IDs de tesorería
      const TESORERIA_AREA_ID = 'b067adcd-13ff-420f-9389-42bfaa78cf9f';
      const TESORERIA_USER_ID = '6d1d75fd-9db5-42ea-9b90-6d691aae848e';
      
      await asignarFactura(factura.id, {
        area_id: TESORERIA_AREA_ID,
        responsable_user_id: TESORERIA_USER_ID
      });
      
      alert('✅ Factura aprobada y enviada a Tesorería');
      onClose(); // Cerrar modal después de aprobar
    } catch (error: any) {
      console.error('Error aprobando factura:', error);
      alert(`❌ Error al aprobar factura: ${error.message || 'Error desconocido'}`);
    } finally {
      setProcesando(false);
    }
  };

  const handleDevolverAResponsable = async () => {
    if (motivoDevolucion.trim().length < 10) {
      alert('❌ El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      setEnviandoDevolucion(true);
      await devolverAResponsable(factura.id, motivoDevolucion.trim());
      alert('✅ Factura devuelta al Responsable correctamente');
      setMostrarModalDevolucion(false);
      setMotivoDevolucion('');
      onClose(); // Cerrar modal después de devolver
    } catch (error: any) {
      console.error('Error devolviendo factura:', error);
      alert(`❌ Error al devolver factura: ${error.message || 'Error desconocido'}`);
    } finally {
      setEnviandoDevolucion(false);
    }
  };

  const getIntervaloLabel = (value: string) => {
    return INTERVALOS_ENTREGA.find(i => i.value === value)?.label || value;
  };

  const handleVerDocumento = (fileId: string) => {
    const token = localStorage.getItem('access_token');
    const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
    const url = `${API_BASE_URL}/files/${fileId}/download`;
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    })
    .catch(error => {
      console.error('Error al abrir documento:', error);
      alert('Error al abrir el documento');
    });
  };

  const handleDownloadFile = (storageProvider: string, storagePath: string, filename: string) => {
    try {
      if (storageProvider === 's3') {
        // Usar el filename tal cual (respeta extensión original: .pdf, .png, .jpg, etc.)
        const finalFilename = filename;
        
        // Usar endpoint proxy del backend para archivos S3
        const downloadUrl = `http://localhost:8000/api/v1/facturas/${factura.id}/files/download?key=${encodeURIComponent(storagePath)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error al descargar archivo:', err);
      alert('Error al descargar el archivo');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-white z-40" />
      
      {/* Modal centrado */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-white shadow-2xl rounded-lg border border-gray-200 my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mt-2">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white text-xl font-semibold">Detalle de Factura</h3>
                    <span className="px-3 py-1 bg-blue-500 bg-opacity-50 text-white text-xs font-medium rounded-full border border-blue-400">
                      MODO AUDITORÍA
                    </span>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="font-mono text-white text-lg">{factura.numero_factura}</span>
                <span className="text-blue-200">•</span>
                <span className={`px-3 py-1 rounded-full border text-sm ${statusConfig[factura.estado]?.bgColor || 'bg-gray-100 border-gray-200'} ${statusConfig[factura.estado]?.color || 'text-gray-700'}`}>
                  {factura.estado}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[calc(90vh-280px)]">
              
              {/* Información de la Factura */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Información de la Factura</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Proveedor</span>
                    <span className="text-gray-900 font-medium">{factura.proveedor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Área</span>
                    <span className="text-gray-900 font-medium">{factura.area}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha de Emisión</span>
                    <span className="text-gray-900 font-medium">
                      {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      }) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total a Pagar</span>
                    <span className="text-gray-900 font-bold text-lg">
                      ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adjuntos del Responsable */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Documentos Adjuntos</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {loadingArchivos ? (
                    <div className="text-sm text-gray-500">Cargando archivos...</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 text-sm font-medium">OC / OS:</span>
                        {archivoOCExistente ? (
                          <div className="flex items-center gap-2">
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {archivoOCExistente.filename}
                            </div>
                            {archivoOCExistente.storage_path && (
                              <button
                                onClick={() => handleDownloadFile(
                                  archivoOCExistente.storage_provider || 's3',
                                  archivoOCExistente.storage_path || '',
                                  archivoOCExistente.filename
                                )}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Descargar archivo"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            No adjuntado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 text-sm font-medium">Aprobación Gerencia:</span>
                        {archivoAprobacionExistente ? (
                          <div className="flex items-center gap-2">
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {archivoAprobacionExistente.filename}
                            </div>
                            {archivoAprobacionExistente.storage_path && (
                              <button
                                onClick={() => handleDownloadFile(
                                  archivoAprobacionExistente.storage_provider || 's3',
                                  archivoAprobacionExistente.storage_path || '',
                                  archivoAprobacionExistente.filename
                                )}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Descargar archivo"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            No adjuntado
                          </span>
                        )}
                      </div>
                      {requiereInventario && archivoInventarioExistente && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 text-sm font-medium">Soporte Inventario:</span>
                          <div className="flex items-center gap-2">
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {archivoInventarioExistente.filename}
                            </div>
                            {archivoInventarioExistente.storage_path && (
                              <button
                                onClick={() => handleDownloadFile(
                                  archivoInventarioExistente.storage_provider || 's3',
                                  archivoInventarioExistente.storage_path || '',
                                  archivoInventarioExistente.filename
                                )}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Descargar archivo"
                              >
                                <Download className="w-4 h-4 text-blue-600" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Soporte de Pago (Factura PDF) */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Soporte de Pago</h4>
                {loadingArchivos ? (
                  <div className="text-sm text-gray-500">Cargando archivos...</div>
                ) : soportePagoFiles.length > 0 ? (
                  <div className="space-y-2">
                    {soportePagoFiles.map((file) => (
                      <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 truncate">{file.filename}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                {file.doc_type && (
                                  <>
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                      {file.doc_type}
                                    </span>
                                    <span>•</span>
                                  </>
                                )}
                                {file.storage_provider && (
                                  <>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium uppercase">
                                      {file.storage_provider}
                                    </span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>
                                  {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          {file.storage_path ? (
                            <button
                              onClick={() => handleDownloadFile(file.storage_provider || 's3', file.storage_path || '', file.filename)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                            </button>
                          ) : (
                            <button 
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-50 cursor-not-allowed"
                              title="Archivo no disponible"
                            >
                              <Download className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No hay archivos de soporte de pago</p>
                  </div>
                )}
              </div>

              {/* Centro de Costo y Operación */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Centro de Costos / Operación</h4>
                {loadingCentros ? (
                  <div className="text-sm text-gray-500">Cargando centros...</div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Centro de Costo (CC)
                      </label>
                      <input
                        type="text"
                        value={centroCosto?.nombre || 'No asignado'}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Centro de Operación (CO)
                      </label>
                      <input
                        type="text"
                        value={centroOperacion?.nombre || 'No asignado'}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Inventarios */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Inventarios</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">¿Requiere entrada a inventarios?</span>
                    <span className={`px-4 py-1 rounded-lg font-medium text-sm ${
                      requiereInventario 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {requiereInventario ? 'Sí' : 'No'}
                    </span>
                  </div>

                  {requiereInventario && (
                    <>
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Tipo de Ingreso:
                        </p>
                        <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                          {tipoIngreso === 'tienda' ? 'Tienda' : tipoIngreso === 'almacen' ? 'Almacén / Inventarios' : 'No especificado'}
                        </span>
                      </div>

                      {tipoIngreso === 'tienda' && (
                        <div className="grid grid-cols-3 gap-3 pt-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">OCT</label>
                            <input
                              type="text"
                              value={oct}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">ECT</label>
                            <input
                              type="text"
                              value={ect}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">FPC</label>
                            <input
                              type="text"
                              value={fpcTienda}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                        </div>
                      )}

                      {tipoIngreso === 'almacen' && (
                        <div className="grid grid-cols-3 gap-3 pt-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">OCC</label>
                            <input
                              type="text"
                              value={occ}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">EDO</label>
                            <input
                              type="text"
                              value={edo}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">FPC</label>
                            <input
                              type="text"
                              value={fpcAlmacen}
                              disabled
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Novedad / Nota de Crédito */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Producto Incorrecto / Novedad</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">¿Presenta novedad?</span>
                    <span className={`px-4 py-1 rounded-lg font-medium text-sm ${
                      tieneNovedad 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {tieneNovedad ? 'Sí' : 'No'}
                    </span>
                  </div>
                  
                  {tieneNovedad && (
                    <div className="pt-3 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de Nota Crédito (NP)
                      </label>
                      <input
                        type="text"
                        value={numeroNotaCredito}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Anticipo e Intervalo */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Anticipo e Intervalo de Entrega</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">¿Tiene anticipo?</span>
                    <span className={`px-4 py-1 rounded-lg font-medium text-sm ${
                      tieneAnticipo 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {tieneAnticipo ? 'Sí' : 'No'}
                    </span>
                  </div>

                  {tieneAnticipo && (
                    <div className="pt-3 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Porcentaje de Anticipo
                      </label>
                      <input
                        type="text"
                        value={`${porcentajeAnticipo}%`}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Intervalo de Entrega a Contabilidad
                    </label>
                    <input
                      type="text"
                      value={getIntervaloLabel(intervaloEntrega)}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => setMostrarModalDevolucion(true)}
                disabled={procesando}
                className="px-6 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
              >
                Devolver a Responsable
              </button>
              <button
                onClick={handleAprobar}
                disabled={procesando}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  procesando
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {procesando ? 'Procesando...' : 'Aprobar y Enviar a Tesorería'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Devolución a Responsable */}
      {mostrarModalDevolucion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Devolver a Responsable</h3>
              <p className="text-sm text-gray-600 mt-1">
                La factura será devuelta al área responsable para correcciones
              </p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de devolución <span className="text-red-600">*</span>
              </label>
              <textarea
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                placeholder="Describa el motivo de la devolución (mínimo 10 caracteres)..."
                disabled={enviandoDevolucion}
              />
              <p className="text-xs text-gray-500 mt-1">
                {motivoDevolucion.length}/1000 caracteres (mínimo 10)
              </p>
              {motivoDevolucion.length > 0 && motivoDevolucion.length < 10 && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ El motivo debe tener al menos 10 caracteres
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={() => {
                  setMostrarModalDevolucion(false);
                  setMotivoDevolucion('');
                }}
                disabled={enviandoDevolucion}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDevolverAResponsable}
                disabled={enviandoDevolucion || motivoDevolucion.trim().length < 10}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  enviandoDevolucion || motivoDevolucion.trim().length < 10
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {enviandoDevolucion ? 'Devolviendo...' : 'Confirmar Devolución'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
