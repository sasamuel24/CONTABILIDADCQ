import { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Trash2, Download, FileText, Eye } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion, DistribucionCCCO, UnidadNegocio, CuentaAuxiliar } from '../lib/api';
import { getFacturaFilesByDocType, getCentrosCosto, getCentrosOperacion, uploadFacturaFile, updateFacturaEstado, API_BASE_URL, getDistribucionCCCO, getUnidadesNegocio, getCuentasAuxiliares, downloadFileById } from '../lib/api';
import { FilePreviewModal } from './FilePreviewModal';
import { ConfirmModal } from './ConfirmModal';
import { ComentariosFactura } from './ComentariosFactura';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  // Estados para archivos previos
  const [archivosOCExistentes, setArchivosOCExistentes] = useState<FileMiniOut[]>([]);
  const [archivoAprobacionExistente, setArchivoAprobacionExistente] = useState<FileMiniOut | null>(null);
  const [archivoInventarioExistente, setArchivoInventarioExistente] = useState<FileMiniOut | null>(null);
  const [soportePagoFiles, setSoportePagoFiles] = useState<FileMiniOut[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);

  // Estados para centros
  const [centroCosto, setCentroCosto] = useState<CentroCosto | null>(null);
  const [centroOperacion, setCentroOperacion] = useState<CentroOperacion | null>(null);
  const [loadingCentros, setLoadingCentros] = useState(true);

  // Estados para unidad de negocio y cuenta auxiliar
  const [unidadNegocio, setUnidadNegocio] = useState<string>('');
  const [cuentaAuxiliar, setCuentaAuxiliar] = useState<string>('');

  // Estados para distribución CC/CO
  const [distribuciones, setDistribuciones] = useState<DistribucionCCCO[]>([]);
  const [loadingDistribucion, setLoadingDistribucion] = useState(true);
  const [unidadesNegocio, setUnidadesNegocio] = useState<UnidadNegocio[]>([]);
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);
  const [centrosCostoCompletos, setCentrosCostoCompletos] = useState<CentroCosto[]>([]);
  const [centrosOperacionCompletos, setCentrosOperacionCompletos] = useState<CentroOperacion[]>([]);

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

  // Estados para documentos de Tesorería (al menos uno obligatorio)
  const [archivoPEC, setArchivoPEC] = useState<string>('');
  const [archivoEC, setArchivoEC] = useState<string>('');
  const [archivoPCE, setArchivoPCE] = useState<string>('');
  const [archivoPED, setArchivoPED] = useState<string>('');
  
  // Estados para archivos de Tesorería subidos
  const [archivoPECExistente, setArchivoPECExistente] = useState<FileMiniOut | null>(null);
  const [archivoECExistente, setArchivoECExistente] = useState<FileMiniOut | null>(null);
  const [archivoPCEExistente, setArchivoPCEExistente] = useState<FileMiniOut | null>(null);
  const [archivoPEDExistente, setArchivoPEDExistente] = useState<FileMiniOut | null>(null);
  
  // Estados de loading para uploads de Tesorería
  const [uploadingPEC, setUploadingPEC] = useState(false);
  const [uploadingEC, setUploadingEC] = useState(false);
  const [uploadingPCE, setUploadingPCE] = useState(false);
  const [uploadingPED, setUploadingPED] = useState(false);

  // Estados de validación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mostrarValidacion, setMostrarValidacion] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Estado para dropdown de tipo de documento
  const [tipoDocumentoSeleccionado, setTipoDocumentoSeleccionado] = useState<string>('');

  // Estados para vista previa
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);
  
  // Estados para modales de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({ title: '', message: '', type: 'info' });

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
        
        setArchivosOCExistentes(archivosOC);
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

  // Cargar unidad de negocio y cuenta auxiliar
  useEffect(() => {
    setUnidadNegocio(factura.unidad_negocio || '');
    setCuentaAuxiliar(factura.cuenta_auxiliar || '');
  }, [factura]);

  // Cargar distribución CC/CO y catálogos
  useEffect(() => {
    const cargarDistribucionYCatalogos = async () => {
      try {
        setLoadingDistribucion(true);
        
        const [dist, cc, un, ca] = await Promise.all([
          getDistribucionCCCO(factura.id),
          getCentrosCosto(true),
          getUnidadesNegocio(true),
          getCuentasAuxiliares(true)
        ]);
        
        setDistribuciones(dist);
        setCentrosCostoCompletos(cc);
        setUnidadesNegocio(un);
        setCuentasAuxiliares(ca);
        
        // Cargar todos los COs
        const allCOs: CentroOperacion[] = [];
        for (const centro of cc) {
          const cos = await getCentrosOperacion(centro.id, true);
          allCOs.push(...cos);
        }
        setCentrosOperacionCompletos(allCOs);
      } catch (error) {
        console.error('Error cargando distribución:', error);
      } finally {
        setLoadingDistribucion(false);
      }
    };

    cargarDistribucionYCatalogos();
  }, [factura.id]);

  // Cargar archivos de Tesorería existentes
  useEffect(() => {
    const cargarArchivosTesoreria = async () => {
      try {
        const [archivosPEC, archivosEC, archivosPCE, archivosPED] = await Promise.all([
          getFacturaFilesByDocType(factura.id, 'PEC'),
          getFacturaFilesByDocType(factura.id, 'EC'),
          getFacturaFilesByDocType(factura.id, 'PCE'),
          getFacturaFilesByDocType(factura.id, 'PED')
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
        if (archivosPED.length > 0) {
          setArchivoPEDExistente(archivosPED[0]);
          setArchivoPED(archivosPED[0].filename);
        }
      } catch (error) {
        console.error('Error cargando archivos de Tesorería:', error);
      }
    };

    cargarArchivosTesoreria();
  }, [factura.id]);

  const handleFileUpload = async (tipo: 'pec' | 'ec' | 'pce' | 'ped') => {
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
        case 'ped':
          docType = 'PED';
          setLoading = setUploadingPED;
          setArchivo = setArchivoPED;
          setArchivoExistente = setArchivoPEDExistente;
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

    // Validar que al menos uno de los documentos esté cargado
    const tieneAlMenosUnDocumento = 
      archivoPECExistente || archivoPEC ||
      archivoECExistente || archivoEC ||
      archivoPCEExistente || archivoPCE ||
      archivoPEDExistente || archivoPED;

    if (!tieneAlMenosUnDocumento) {
      nuevosErrores.general = 'Debe cargar al menos uno de los documentos de Tesorería (PEC, EC, PCE o PED)';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleFinalizar = async () => {
    setMostrarValidacion(true);
    
    if (!validarFormulario()) {
      setConfirmModalConfig({
        title: 'Documentos Pendientes',
        message: 'Debe cargar al menos uno de los documentos de Tesorería (PEC, EC, PCE o PED) antes de finalizar.',
        type: 'warning'
      });
      setShowConfirmModal(true);
      return;
    }

    try {
      setProcesando(true);
      
      // Actualizar estado a "Cerrada" (id: 5)
      await updateFacturaEstado(factura.id, 5);
      
      // Construir mensaje con documentos cargados
      const documentosCargados = [];
      if (archivoPEC || archivoPECExistente) documentosCargados.push(`• PEC: ${archivoPEC || archivoPECExistente?.filename}`);
      if (archivoEC || archivoECExistente) documentosCargados.push(`• EC: ${archivoEC || archivoECExistente?.filename}`);
      if (archivoPCE || archivoPCEExistente) documentosCargados.push(`• PCE: ${archivoPCE || archivoPCEExistente?.filename}`);
      if (archivoPED || archivoPEDExistente) documentosCargados.push(`• PED: ${archivoPED || archivoPEDExistente?.filename}`);
      
      setConfirmModalConfig({
        title: 'Factura Cerrada',
        message: `La factura ha sido finalizada y cerrada exitosamente.\n\nDocumentos de Tesorería registrados:\n${documentosCargados.join('\n')}`,
        type: 'success',
        onConfirm: () => onClose()
      });
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error finalizando factura:', error);
      setConfirmModalConfig({
        title: 'Error al Finalizar',
        message: `No se pudo finalizar la factura.\n\n${error.message || 'Error desconocido'}`,
        type: 'error'
      });
      setShowConfirmModal(true);
    } finally {
      setProcesando(false);
    }
  };

  const getIntervaloLabel = (value: string) => {
    return INTERVALOS_ENTREGA.find(i => i.value === value)?.label || value;
  };

  const handleDownloadFile = (storageProvider: string, storagePath: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/api/v1/facturas/${factura.id}/files/download?key=${storagePath}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewFile = (file: FileMiniOut) => {
    setPreviewFile(file);
  };

  const handleDownloadById = async (file: FileMiniOut) => {
    try {
      const blob = await downloadFileById(file.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      alert('Error al descargar el archivo');
    }
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
            <div style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}} className="text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mt-2">
                  <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-white mb-2 text-xl font-semibold">Detalle de Factura - Tesorería</h3>
                </div>
                <button 
                  onClick={onClose}
                  style={{transition: 'background-color 0.2s'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  className="p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="font-mono text-white text-lg">{factura.numero_factura}</span>
                <span className="text-white" style={{opacity: 0.7}}>•</span>
                <span className={`px-3 py-1 rounded-full border text-sm ${statusConfig[factura.estado]?.bgColor || 'bg-gray-100 border-gray-200'} ${statusConfig[factura.estado]?.color || 'text-gray-700'}`}>
                  {factura.estado}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Información de la Factura */}
              <div>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Información de la Factura</h4>
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
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Documentos Adjuntos Previos</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {loadingArchivos ? (
                    <div className="text-sm text-gray-500">Cargando archivos...</div>
                  ) : (
                    <>
                      <div>
                        <span className="text-gray-700 text-sm font-medium mb-2 block">OC / OS:</span>
                        {archivosOCExistentes.length > 0 ? (
                          <div className="space-y-2">
                            {archivosOCExistentes.map((archivo, index) => (
                              <div key={archivo.id} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200">
                                <div className="text-green-600 text-sm flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="font-medium">OC/OS {index + 1}:</span>
                                  <span>{archivo.filename}</span>
                                </div>
                                {archivo.storage_path && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handlePreviewFile(archivo)}
                                      style={{color: '#00829a'}}
                                      className="p-1.5 rounded-lg transition-colors"
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      title="Vista previa"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadFile(
                                        archivo.storage_provider || 's3',
                                        archivo.storage_path || '',
                                        archivo.filename
                                      )}
                                      style={{color: '#00829a'}}
                                      className="p-1.5 rounded-lg transition-colors"
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      title="Descargar archivo"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
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
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handlePreviewFile(archivoAprobacionExistente)}
                                  style={{color: '#00829a'}}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Vista previa"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(
                                    archivoAprobacionExistente.storage_provider || 's3',
                                    archivoAprobacionExistente.storage_path || '',
                                    archivoAprobacionExistente.filename
                                  )}
                                  style={{color: '#00829a'}}
                                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="Descargar archivo"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
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
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handlePreviewFile(archivoInventarioExistente)}
                                  style={{color: '#00829a'}}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Vista previa"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadFile(
                                    archivoInventarioExistente.storage_provider || 's3',
                                    archivoInventarioExistente.storage_path || '',
                                    archivoInventarioExistente.filename
                                  )}
                                  style={{color: '#00829a'}}
                                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="Descargar archivo"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
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
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Soporte de Pago</h4>
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewFile(file)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
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

              {/* Distribución CC/CO */}
              <div>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Distribución de Centros de Costo / Operación</h4>
                {loadingDistribucion ? (
                  <div className="text-sm text-gray-500">Cargando distribución...</div>
                ) : distribuciones.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Centro de Costo</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Centro de Operación</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Unidad de Negocio</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Cuenta Auxiliar</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700">Porcentaje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {distribuciones.map((dist, index) => {
                            const cc = centrosCostoCompletos.find(c => c.id === dist.centro_costo_id);
                            const co = centrosOperacionCompletos.find(c => c.id === dist.centro_operacion_id);
                            const un = dist.unidad_negocio_id ? unidadesNegocio.find(u => u.id === dist.unidad_negocio_id) : null;
                            const ca = dist.cuenta_auxiliar_id ? cuentasAuxiliares.find(c => c.id === dist.cuenta_auxiliar_id) : null;
                            
                            return (
                              <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="py-2 px-3 text-gray-900">
                                  {cc ? cc.nombre : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-gray-900">
                                  {co ? co.nombre : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-gray-700">
                                  {un ? `${un.codigo} - ${un.descripcion}` : '-'}
                                </td>
                                <td className="py-2 px-3 text-gray-700">
                                  {ca ? `${ca.codigo} - ${ca.descripcion}` : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-gray-900">
                                  {dist.porcentaje.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-300 bg-gray-100">
                            <td colSpan={4} className="py-2 px-3 text-right font-semibold text-gray-900">Total:</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">
                              {distribuciones.reduce((sum, d) => sum + d.porcentaje, 0).toFixed(2)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{backgroundColor: '#e0f5f7', borderColor: '#00829a'}} className="border rounded-lg p-4 text-center">
                    <p style={{color: '#00829a', fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm">No hay distribución configurada para esta factura</p>
                  </div>
                )}
              </div>

              {/* Inventarios */}
              {requiereInventario && (
                <div>
                  <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Inventarios</h4>
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
                  <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Producto Incorrecto / Novedad</h4>
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

              {/* Documentos de Tesorería (AL MENOS UNO OBLIGATORIO) */}
              <div className="border-t-2 pt-6" style={{borderColor: '#14aab8'}}>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5" style={{color: '#00829a'}} />
                  Documentos de Tesorería
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="text-red-600 font-medium">*</span> Debe cargar al menos uno de los siguientes documentos
                </p>
                
                {mostrarValidacion && errores.general && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errores.general}
                    </p>
                  </div>
                )}
                
                {/* Dropdown para seleccionar tipo de documento */}
                <div className="mb-4">
                  <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccione el tipo de documento a cargar
                  </label>
                  <select
                    value={tipoDocumentoSeleccionado}
                    onChange={(e) => setTipoDocumentoSeleccionado(e.target.value)}
                    style={{
                      fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                      borderColor: '#00829a',
                      borderWidth: '2px'
                    }}
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0, 130, 154, 0.2)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    className="w-full px-4 py-2 rounded-lg bg-white"
                  >
                    <option value="">-- Seleccione una opción --</option>
                    <option value="pec">PEC (Planilla de Egresos de Caja)</option>
                    <option value="ec">EC (Egreso de Caja)</option>
                    <option value="pce">PCE (Presupuesto de Caja y Egresos)</option>
                    <option value="ped">PED (Presupuesto de Egresos y Desembolsos)</option>
                  </select>
                </div>

                {/* Botón de carga según selección */}
                {tipoDocumentoSeleccionado && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    {tipoDocumentoSeleccionado === 'pec' && !archivoPECExistente && (
                      <button
                        onClick={() => handleFileUpload('pec')}
                        disabled={uploadingPEC}
                        style={{
                          fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                          backgroundColor: uploadingPEC ? '#f3f4f6' : 'transparent',
                          borderColor: uploadingPEC ? '#d1d5db' : '#00829a',
                          borderWidth: '2px',
                          color: uploadingPEC ? '#9ca3af' : '#00829a',
                          transition: 'all 0.2s',
                          cursor: uploadingPEC ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!uploadingPEC) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!uploadingPEC) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPEC ? 'Subiendo...' : 'Subir PEC (PDF)'}
                      </button>
                    )}
                    {tipoDocumentoSeleccionado === 'ec' && !archivoECExistente && (
                      <button
                        onClick={() => handleFileUpload('ec')}
                        disabled={uploadingEC}
                        style={{
                          fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                          backgroundColor: uploadingEC ? '#f3f4f6' : 'transparent',
                          borderColor: uploadingEC ? '#d1d5db' : '#00829a',
                          borderWidth: '2px',
                          color: uploadingEC ? '#9ca3af' : '#00829a',
                          transition: 'all 0.2s',
                          cursor: uploadingEC ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!uploadingEC) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!uploadingEC) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingEC ? 'Subiendo...' : 'Subir EC (PDF)'}
                      </button>
                    )}
                    {tipoDocumentoSeleccionado === 'pce' && !archivoPCEExistente && (
                      <button
                        onClick={() => handleFileUpload('pce')}
                        disabled={uploadingPCE}
                        style={{
                          fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                          backgroundColor: uploadingPCE ? '#f3f4f6' : 'transparent',
                          borderColor: uploadingPCE ? '#d1d5db' : '#00829a',
                          borderWidth: '2px',
                          color: uploadingPCE ? '#9ca3af' : '#00829a',
                          transition: 'all 0.2s',
                          cursor: uploadingPCE ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!uploadingPCE) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!uploadingPCE) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPCE ? 'Subiendo...' : 'Subir PCE (PDF)'}
                      </button>
                    )}
                    {tipoDocumentoSeleccionado === 'ped' && !archivoPEDExistente && (
                      <button
                        onClick={() => handleFileUpload('ped')}
                        disabled={uploadingPED}
                        style={{
                          fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                          backgroundColor: uploadingPED ? '#f3f4f6' : 'transparent',
                          borderColor: uploadingPED ? '#d1d5db' : '#00829a',
                          borderWidth: '2px',
                          color: uploadingPED ? '#9ca3af' : '#00829a',
                          transition: 'all 0.2s',
                          cursor: uploadingPED ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!uploadingPED) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!uploadingPED) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPED ? 'Subiendo...' : 'Subir PED (PDF)'}
                      </button>
                    )}
                  </div>
                )}

                {/* Documentos ya cargados */}
                <div className="space-y-3">
                  {archivoPECExistente && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">PEC (Planilla de Egresos de Caja)</span>
                        <div className="flex items-center gap-2">
                          <div className="text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {archivoPECExistente.filename}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewFile(archivoPECExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadById(archivoPECExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {archivoECExistente && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">EC (Egreso de Caja)</span>
                        <div className="flex items-center gap-2">
                          <div className="text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {archivoECExistente.filename}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewFile(archivoECExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadById(archivoECExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {archivoPCEExistente && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">PCE (Presupuesto de Caja y Egresos)</span>
                        <div className="flex items-center gap-2">
                          <div className="text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {archivoPCEExistente.filename}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewFile(archivoPCEExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadById(archivoPCEExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {archivoPEDExistente && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">PED (Presupuesto de Egresos y Desembolsos)</span>
                        <div className="flex items-center gap-2">
                          <div className="text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {archivoPEDExistente.filename}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handlePreviewFile(archivoPEDExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadById(archivoPEDExistente)}
                              style={{color: '#00829a'}}
                              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Sección de Comentarios */}
            <div className="p-6 border-t border-gray-200 bg-white">
              {user && (
                <ComentariosFactura 
                  facturaId={factura.id} 
                  currentUserId={user.id}
                />
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={onClose}
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg"
              >
                Cerrar
              </button>
              <button
                onClick={handleFinalizar}
                disabled={procesando}
                style={{
                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                  backgroundColor: procesando ? '#f3f4f6' : '#00829a',
                  color: procesando ? '#9ca3af' : 'white',
                  transition: 'all 0.2s',
                  cursor: procesando ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!procesando) {
                    e.currentTarget.style.backgroundColor = '#14aab8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!procesando) {
                    e.currentTarget.style.backgroundColor = '#00829a';
                  }
                }}
                onFocus={(e) => {
                  if (!procesando) {
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)';
                  }
                }}
                onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                className="px-6 py-2 rounded-lg font-medium"
              >
                {procesando ? 'Procesando...' : 'Finalizar y Cerrar Factura'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de vista previa */}
      {previewFile && (
        <FilePreviewModal
          fileId={previewFile.id}
          filename={previewFile.filename}
          contentType={previewFile.content_type}
          storagePath={previewFile.storage_path}
          facturaId={factura.id}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownloadById(previewFile)}
        />
      )}
      
      {/* Modal de confirmación moderno */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        type={confirmModalConfig.type}
        showCancel={confirmModalConfig.showCancel}
      />
    </>
  );
}
