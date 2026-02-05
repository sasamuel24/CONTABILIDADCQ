import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Download, FileText, Eye } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion, DistribucionCCCO, UnidadNegocio, CuentaAuxiliar } from '../lib/api';
import { getFacturaFilesByDocType, getCentrosCosto, getCentrosOperacion, asignarFactura, devolverAResponsable, API_BASE_URL, getDistribucionCCCO, getUnidadesNegocio, getCuentasAuxiliares, downloadFileById } from '../lib/api';
import { FilePreviewModal } from './FilePreviewModal';
import { ConfirmModal } from './ConfirmModal';
import { ComentariosFactura } from './ComentariosFactura';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  const [procesando, setProcesando] = useState(false);
  
  // Estados para modal de devolución
  const [mostrarModalDevolucion, setMostrarModalDevolucion] = useState(false);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [enviandoDevolucion, setEnviandoDevolucion] = useState(false);
  
  // Estados para archivos
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
  
  // Calcular checklist de auditoría
  const calcularChecklist = (): ChecklistItem[] => {
    const checks: ChecklistItem[] = [
      {
        label: 'OC/OS adjunta',
        isValid: archivosOCExistentes.length > 0,
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
      
      setConfirmModalConfig({
        title: 'Factura Aprobada',
        message: 'La factura ha sido aprobada exitosamente y enviada a Tesorería para su procesamiento.',
        type: 'success',
        onConfirm: () => onClose()
      });
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error aprobando factura:', error);
      setConfirmModalConfig({
        title: 'Error al Aprobar',
        message: `No se pudo aprobar la factura.\n\n${error.message || 'Error desconocido'}`,
        type: 'error'
      });
      setShowConfirmModal(true);
    } finally {
      setProcesando(false);
    }
  };

  const handleDevolverAResponsable = async () => {
    if (motivoDevolucion.trim().length < 10) {
      setConfirmModalConfig({
        title: 'Motivo Insuficiente',
        message: 'El motivo de devolución debe tener al menos 10 caracteres para mayor claridad.',
        type: 'warning'
      });
      setShowConfirmModal(true);
      return;
    }

    try {
      setEnviandoDevolucion(true);
      await devolverAResponsable(factura.id, motivoDevolucion.trim());
      setMostrarModalDevolucion(false);
      setMotivoDevolucion('');
      setConfirmModalConfig({
        title: 'Factura Devuelta',
        message: 'La factura ha sido devuelta al Responsable de Área con el motivo especificado.',
        type: 'success',
        onConfirm: () => onClose()
      });
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error devolviendo factura:', error);
      setConfirmModalConfig({
        title: 'Error al Devolver',
        message: `No se pudo devolver la factura.\n\n${error.message || 'Error desconocido'}`,
        type: 'error'
      });
      setShowConfirmModal(true);
    } finally {
      setEnviandoDevolucion(false);
    }
  };

  const getIntervaloLabel = (value: string) => {
    return INTERVALOS_ENTREGA.find(i => i.value === value)?.label || value;
  };

  const handleVerDocumento = (fileId: string) => {
    const token = localStorage.getItem('access_token');
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
        const downloadUrl = `${API_BASE_URL}/facturas/${factura.id}/files/download?key=${encodeURIComponent(storagePath)}`;
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
                  <div className="flex items-center gap-3 mb-2">
                    <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-white text-xl font-semibold">Detalle de Factura</h3>
                    <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderColor: 'rgba(255, 255, 255, 0.3)'}} className="px-3 py-1 text-white text-xs font-medium rounded-full border">
                      MODO AUDITORÍA
                    </span>
                  </div>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[calc(90vh-280px)]">
              
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

              {/* Adjuntos del Responsable */}
              <div>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Documentos Adjuntos</h4>
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
                                      className="p-1.5 rounded-lg transition-colors"
                                      style={{color: '#00829a'}}
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
                                      className="p-1.5 rounded-lg transition-colors"
                                      style={{color: '#00829a'}}
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
                                  className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Vista previa"
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </button>
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
              <div>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Inventarios</h4>
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
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Producto Incorrecto / Novedad</h4>
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

              {/* Anticipo */}
              <div>
                <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">Anticipo</h4>
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
                onClick={() => setMostrarModalDevolucion(true)}
                disabled={procesando}
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  backgroundColor: procesando ? '#f3f4f6' : 'transparent',
                  borderColor: procesando ? '#d1d5db' : '#dc2626',
                  color: procesando ? '#9ca3af' : '#dc2626',
                  borderWidth: '2px',
                  transition: 'all 0.2s',
                  cursor: procesando ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!procesando) {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!procesando) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                className="px-6 py-2 rounded-lg"
              >
                Devolver a Responsable
              </button>
              <button
                onClick={handleAprobar}
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
            <div style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}} className="p-6 border-b border-gray-200 rounded-t-lg">
              <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-semibold text-white">Devolver a Responsable</h3>
              <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif', opacity: 0.9}} className="text-sm text-white mt-1">
                La factura será devuelta al área responsable para correcciones
              </p>
            </div>
            
            <div className="p-6">
              <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de devolución <span className="text-red-600">*</span>
              </label>
              <textarea
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                rows={4}
                style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                placeholder="Describa el motivo de la devolución (mínimo 10 caracteres)..."
                disabled={enviandoDevolucion}
              />
              <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500 mt-1">
                {motivoDevolucion.length}/1000 caracteres (mínimo 10)
              </p>
              {motivoDevolucion.length > 0 && motivoDevolucion.length < 10 && (
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-red-600 mt-1">
                  ⚠️ El motivo debe tener al menos 10 caracteres
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setMostrarModalDevolucion(false);
                  setMotivoDevolucion('');
                }}
                disabled={enviandoDevolucion}
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !enviandoDevolucion && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseLeave={(e) => !enviandoDevolucion && (e.currentTarget.style.backgroundColor = 'white')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              {motivoDevolucion.trim().length >= 10 && (
                <button
                  onClick={handleDevolverAResponsable}
                  disabled={enviandoDevolucion}
                  style={{
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    backgroundColor: enviandoDevolucion ? '#f3f4f6' : '#dc2626',
                    color: enviandoDevolucion ? '#9ca3af' : 'white',
                    transition: 'all 0.2s',
                    cursor: enviandoDevolucion ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!enviandoDevolucion) {
                      e.currentTarget.style.backgroundColor = '#b91c1c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!enviandoDevolucion) {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    }
                  }}
                  onFocus={(e) => {
                    if (!enviandoDevolucion) {
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.5)';
                    }
                  }}
                  onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                  className="px-4 py-2 rounded-lg font-medium"
                >
                  {enviandoDevolucion ? 'Devolviendo...' : 'Confirmar Devolución'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
