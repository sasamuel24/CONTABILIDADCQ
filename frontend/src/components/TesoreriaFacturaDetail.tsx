import { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Trash2, Download, FileText } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion } from '../lib/api';
import { getFacturaFilesByDocType, getCentrosCosto, getCentrosOperacion, uploadFacturaFile, updateFacturaEstado, API_BASE_URL } from '../lib/api';

interface TesoreriaFacturaDetailProps {
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

export function TesoreriaFacturaDetail({ factura, onClose }: TesoreriaFacturaDetailProps) {
  // Estados para archivos previos
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

  // Estados para documentos de Tesorería (obligatorios)
  const [archivoPEC, setArchivoPEC] = useState<string>('');
  const [archivoEC, setArchivoEC] = useState<string>('');
  const [archivoPCE, setArchivoPCE] = useState<string>('');
  
  // Estados para archivos de Tesorería subidos
  const [archivoPECExistente, setArchivoPECExistente] = useState<FileMiniOut | null>(null);
  const [archivoECExistente, setArchivoECExistente] = useState<FileMiniOut | null>(null);
  const [archivoPCEExistente, setArchivoPCEExistente] = useState<FileMiniOut | null>(null);
  
  // Estados de loading para uploads de Tesorería
  const [uploadingPEC, setUploadingPEC] = useState(false);
  const [uploadingEC, setUploadingEC] = useState(false);
  const [uploadingPCE, setUploadingPCE] = useState(false);

  // Estados de validación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mostrarValidacion, setMostrarValidacion] = useState(false);
  const [procesando, setProcesando] = useState(false);

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

  // Cargar archivos de Tesorería existentes
  useEffect(() => {
    const cargarArchivosTesoreria = async () => {
      try {
        const [archivosPEC, archivosEC, archivosPCE] = await Promise.all([
          getFacturaFilesByDocType(factura.id, 'PEC'),
          getFacturaFilesByDocType(factura.id, 'EC'),
          getFacturaFilesByDocType(factura.id, 'PCE')
        ]);
        
        if (archivosPEC.length > 0) {
          setArchivoPECExistente(archivosPEC[0]);
          setArchivoPEC(archivosPEC[0].filename);
        }
        if (archivosEC.length > 0) {
          setArchivoECExistente(archivosEC[0]);
          setArchivoEC(archivosEC[0].filename);
        }
        if (archivosPCE.length > 0) {
          setArchivoPCEExistente(archivosPCE[0]);
          setArchivoPCE(archivosPCE[0].filename);
        }
      } catch (error) {
        console.error('Error cargando archivos de Tesorería:', error);
      }
    };

    cargarArchivosTesoreria();
  }, [factura.id]);

  const handleFileUpload = async (tipo: 'pec' | 'ec' | 'pce') => {
    // Crear input file temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) return;
      
      // Validar que sea PDF
      if (file.type !== 'application/pdf') {
        const nuevosErrores = { ...errores };
        nuevosErrores[tipo] = 'Solo se permiten archivos PDF';
        setErrores(nuevosErrores);
        return;
      }
      
      // Determinar doc_type y setters
      let docType = '';
      let setLoading: (loading: boolean) => void = () => {};
      let setArchivo: (nombre: string) => void = () => {};
      let setArchivoExistente: (archivo: FileMiniOut) => void = () => {};
      
      switch (tipo) {
        case 'pec':
          docType = 'PEC';
          setLoading = setUploadingPEC;
          setArchivo = setArchivoPEC;
          setArchivoExistente = setArchivoPECExistente;
          break;
        case 'ec':
          docType = 'EC';
          setLoading = setUploadingEC;
          setArchivo = setArchivoEC;
          setArchivoExistente = setArchivoECExistente;
          break;
        case 'pce':
          docType = 'PCE';
          setLoading = setUploadingPCE;
          setArchivo = setArchivoPCE;
          setArchivoExistente = setArchivoPCEExistente;
          break;
        default:
          return;
      }
      
      try {
        setLoading(true);
        
        // Subir archivo al backend
        const response = await uploadFacturaFile(factura.id, docType, file);
        
        // Actualizar estado con el nombre del archivo subido
        setArchivo(response.filename);
        
        // Actualizar archivo existente en estado
        setArchivoExistente({
          id: response.file_id,
          filename: response.filename,
          content_type: response.content_type,
          // size_bytes: response.size_bytes,
          doc_type: response.doc_type,
          uploaded_at: response.created_at,
          download_url: response.download_url
        });
        
        // Limpiar error si existía
        const nuevosErrores = { ...errores };
        delete nuevosErrores[tipo];
        setErrores(nuevosErrores);
        
        console.log('Archivo subido exitosamente:', response);
        
      } catch (error: any) {
        console.error('Error al subir archivo:', error);
        
        // Mostrar error al usuario
        const nuevosErrores = { ...errores };
        nuevosErrores[tipo] = error.message || 'Error al subir el archivo';
        setErrores(nuevosErrores);
        
        alert(`Error al subir archivo: ${error.message || 'Error desconocido'}`);
      } finally {
        setLoading(false);
      }
    };
    
    input.click();
  };

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!archivoPECExistente && !archivoPEC) {
      nuevosErrores.pec = 'El documento PEC es obligatorio';
    }
    if (!archivoECExistente && !archivoEC) {
      nuevosErrores.ec = 'El documento EC es obligatorio';
    }
    if (!archivoPCEExistente && !archivoPCE) {
      nuevosErrores.pce = 'El documento PCE es obligatorio';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleFinalizar = async () => {
    setMostrarValidacion(true);
    
    if (!validarFormulario()) {
      alert('❌ Por favor cargue todos los documentos obligatorios de Tesorería');
      return;
    }

    try {
      setProcesando(true);
      
      // Actualizar estado a "Cerrada" (id: 5)
      await updateFacturaEstado(factura.id, 5);
      
      alert('✅ Factura cerrada exitosamente\n\nLa factura ha sido finalizada y cerrada.\nDocumentos de Tesorería registrados:\n• PEC: ' + archivoPEC + '\n• EC: ' + archivoEC + '\n• PCE: ' + archivoPCE);
      onClose();
    } catch (error: any) {
      console.error('Error finalizando factura:', error);
      alert(`❌ Error al finalizar factura: ${error.message || 'Error desconocido'}`);
    } finally {
      setProcesando(false);
    }
  };

  const getIntervaloLabel = (value: string) => {
    return INTERVALOS_ENTREGA.find(i => i.value === value)?.label || value;
  };

  const handleDownloadFile = (storageProvider: string, storagePath: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/facturas/${factura.id}/files/download?key=${storagePath}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVerDocumento = (archivo: FileMiniOut) => {
    // Si hay download_url de S3, usarla directamente
    if (archivo.download_url) {
      window.open(archivo.download_url, '_blank');
      return;
    }
    
    // Fallback: descargar a través del backend
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE_URL}/files/${archivo.id}/download`;
    
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
                  <h3 className="text-white mb-2 text-xl font-semibold">Detalle de Factura - Tesorería</h3>
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
            <div className="p-6 space-y-6">
              
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

              {/* Adjuntos previos (solo lectura) */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Documentos Adjuntos Previos</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {loadingArchivos ? (
                    <div className="text-sm text-gray-500">Cargando archivos...</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 text-sm font-medium">OC / OS:</span>
                        {archivoOCExistente ? (
                          <button
                            onClick={() => handleVerDocumento(archivoOCExistente)}
                            className="text-green-600 text-sm flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {archivoOCExistente.filename}
                          </button>
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
                          <button
                            onClick={() => handleVerDocumento(archivoAprobacionExistente)}
                            className="text-green-600 text-sm flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {archivoAprobacionExistente.filename}
                          </button>
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
                          <button
                            onClick={() => handleVerDocumento(archivoInventarioExistente)}
                            className="text-green-600 text-sm flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {archivoInventarioExistente.filename}
                          </button>
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
              {requiereInventario && (
                <div>
                  <h4 className="text-gray-900 font-semibold mb-3">Inventarios</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Tipo de Ingreso:</span>
                      <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                        {tipoIngreso === 'tienda' ? 'Tienda' : tipoIngreso === 'almacen' ? 'Almacén / Inventarios' : 'No especificado'}
                      </span>
                    </div>

                    {tipoIngreso === 'tienda' && (
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
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
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
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
                  </div>
                </div>
              )}

              {/* Novedad */}
              {tieneNovedad && (
                <div>
                  <h4 className="text-gray-900 font-semibold mb-3">Producto Incorrecto / Novedad</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
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
                </div>
              )}

              {/* Anticipo e Intervalo */}
              <div>
                <h4 className="text-gray-900 font-semibold mb-3">Anticipo e Intervalo de Entrega</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  {tieneAnticipo && (
                    <div>
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

                  <div>
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

              {/* Documentos de Tesorería (OBLIGATORIOS) */}
              <div className="border-t-2 border-blue-200 pt-6">
                <h4 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Documentos de Tesorería
                </h4>
                
                <div className="space-y-4">
                  {/* PEC */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      PEC (Planilla de Egresos de Caja)
                      <span className="text-red-600 text-xs">*obligatorio</span>
                    </label>
                    
                    {!archivoPECExistente ? (
                      <button
                        onClick={() => handleFileUpload('pec')}
                        disabled={uploadingPEC}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                          uploadingPEC
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPEC ? 'Subiendo...' : 'Subir PEC (PDF)'}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg p-3">
                        <button
                          onClick={() => handleVerDocumento(archivoPECExistente)}
                          className="text-green-700 text-sm flex items-center gap-2 hover:underline"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {archivoPECExistente.filename}
                        </button>
                      </div>
                    )}
                    
                    {mostrarValidacion && errores.pec && (
                      <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errores.pec}
                      </p>
                    )}
                  </div>

                  {/* EC */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      EC (Egreso de Caja)
                      <span className="text-red-600 text-xs">*obligatorio</span>
                    </label>
                    
                    {!archivoECExistente ? (
                      <button
                        onClick={() => handleFileUpload('ec')}
                        disabled={uploadingEC}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                          uploadingEC
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingEC ? 'Subiendo...' : 'Subir EC (PDF)'}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg p-3">
                        <button
                          onClick={() => handleVerDocumento(archivoECExistente)}
                          className="text-green-700 text-sm flex items-center gap-2 hover:underline"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {archivoECExistente.filename}
                        </button>
                      </div>
                    )}
                    
                    {mostrarValidacion && errores.ec && (
                      <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errores.ec}
                      </p>
                    )}
                  </div>

                  {/* PCE */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      PCE (Presupuesto de Caja y Egresos)
                      <span className="text-red-600 text-xs">*obligatorio</span>
                    </label>
                    
                    {!archivoPCEExistente ? (
                      <button
                        onClick={() => handleFileUpload('pce')}
                        disabled={uploadingPCE}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                          uploadingPCE
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPCE ? 'Subiendo...' : 'Subir PCE (PDF)'}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg p-3">
                        <button
                          onClick={() => handleVerDocumento(archivoPCEExistente)}
                          className="text-green-700 text-sm flex items-center gap-2 hover:underline"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {archivoPCEExistente.filename}
                        </button>
                      </div>
                    )}
                    
                    {mostrarValidacion && errores.pce && (
                      <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errores.pce}
                      </p>
                    )}
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
                onClick={handleFinalizar}
                disabled={procesando}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  !procesando
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {procesando ? 'Procesando...' : 'Finalizar y Cerrar Factura'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
