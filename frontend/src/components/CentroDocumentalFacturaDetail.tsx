import { useState, useEffect } from 'react';
import { X, FileText, Calendar, DollarSign, Building2, CheckCircle, Clock, AlertCircle, Download, Eye, Trash2, History, FolderInput, ArrowRight, Mail, Send, RotateCcw, User as UserIcon } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, HistorialFactura, HistorialEvento } from '../lib/api';
import { getFacturaFilesByDocType, downloadFileById, deleteFactura, getHistorialFactura, getUserRoleCode } from '../lib/api';
import { FilePreviewModal } from './FilePreviewModal';
import { ComentariosFactura } from './ComentariosFactura';
import { useAuth } from '../contexts/AuthContext';
import { ReasignarAreaModal } from './ReasignarAreaModal';
import { toast } from 'sonner';

interface CentroDocumentalFacturaDetailProps {
  factura: FacturaListItem;
  onClose: () => void;
  onDelete?: (facturaId: string) => void;
  onReasignada?: (facturaId: string, areaNombre: string) => void;
}

interface ProcessStep {
  name: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

export function CentroDocumentalFacturaDetail({ factura, onClose, onDelete, onReasignada }: CentroDocumentalFacturaDetailProps) {
  const { user } = useAuth();
  const userRole = getUserRoleCode(user).toLowerCase();
  const esDirector = userRole === 'direccion' || userRole === 'admin';
  const ESTADOS_ASIGNADA = new Set(['Asignada', 'Asignada a responsable', 'En Curso']);
  const puedeReasignar = esDirector && ESTADOS_ASIGNADA.has(factura.estado);

  const [archivosOC, setArchivosOC] = useState<FileMiniOut[]>([]);
  const [archivoAprobacion, setArchivoAprobacion] = useState<FileMiniOut | null>(null);
  const [archivoInventario, setArchivoInventario] = useState<FileMiniOut | null>(null);
  const [soportePago, setSoportePago] = useState<FileMiniOut[]>([]);
  const [facturaPrincipal, setFacturaPrincipal] = useState<FileMiniOut | null>(null);
  const [loadingArchivos, setLoadingArchivos] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [historial, setHistorial] = useState<HistorialFactura | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [showReasignarModal, setShowReasignarModal] = useState(false);

  // Estados del proceso
  const getProcessSteps = (): ProcessStep[] => {
    const estado = factura.estado;
    const steps: ProcessStep[] = [
      { name: 'Recibida', status: 'completed', date: factura.fecha_emision || undefined },
      { name: 'Asignada', status: 'pending' },
      { name: 'Revisión Contabilidad', status: 'pending' },
      { name: 'Aprobada Tesorería', status: 'pending' },
      { name: 'Pagada', status: 'pending' },
    ];

    const estadoIndex = {
      'Recibida': 0,
      'Pendiente': 0,
      'Asignada': 1,
      'Asignada a responsable': 1,
      'En Revisión Contabilidad': 2,
      'Pendiente en contabilidad': 2,
      'Aprobada Tesorería': 3,
      'Pendiente en Tesoreria': 3,
      'Pendiente en tesoreria': 3,
      'Pagada': 4,
      'Rechazada': -1,
    };

    const currentIndex = estadoIndex[estado as keyof typeof estadoIndex] ?? 0;

    if (estado === 'Rechazada') {
      return steps.map((step, i) => ({
        ...step,
        status: i === 0 ? 'completed' : 'pending',
      }));
    }

    // Si está cerrada, todas las etapas están completadas
    if (estado === 'Pagada') {
      return steps.map((step) => ({
        ...step,
        status: 'completed' as const,
      }));
    }

    return steps.map((step, i) => {
      if (i < currentIndex) return { ...step, status: 'completed' as const };
      if (i === currentIndex) return { ...step, status: 'current' as const };
      return { ...step, status: 'pending' as const };
    });
  };

  const processSteps = getProcessSteps();

  // Cargar archivos
  useEffect(() => {
    const cargarArchivos = async () => {
      try {
        setLoadingArchivos(true);

        // Intentar cargar desde la API primero
        try {
          const [oc, aprobacion, inventario, pago, facturaPdf] = await Promise.all([
            getFacturaFilesByDocType(factura.id, 'OC'),
            getFacturaFilesByDocType(factura.id, 'APROBACION_GERENCIA'),
            getFacturaFilesByDocType(factura.id, 'PEC'),
            getFacturaFilesByDocType(factura.id, 'SOPORTE_PAGO'),
            getFacturaFilesByDocType(factura.id, 'FACTURA_PDF'),
          ]);

          console.log('Archivos cargados desde API:');
          console.log('- OC/OS:', oc);
          console.log('- Aprobación:', aprobacion);
          console.log('- Inventario:', inventario);
          console.log('- Soporte Pago:', pago);
          console.log('- Factura PDF:', facturaPdf);

          setArchivosOC(oc);
          setArchivoAprobacion(aprobacion[0] || null);
          setArchivoInventario(inventario[0] || null);
          setSoportePago(pago);
          setFacturaPrincipal(facturaPdf[0] || null);
        } catch (apiError) {
          console.error('Error cargando desde API, intentando con factura.files:', apiError);
          
          // Fallback: usar factura.files si la API falla
          const tiposOC = ['OC', 'OS', 'OCT', 'ECT', 'OCC', 'EDO'];
          const tiposInventario = ['PEC', 'EC', 'PCE', 'PED'];
          const tiposPago = ['SOPORTE_PAGO'];

          const oc = factura.files.filter(f => f.doc_type && tiposOC.includes(f.doc_type));
          const aprobacion = factura.files.filter(f => f.doc_type === 'APROBACION_GERENCIA');
          const inventario = factura.files.filter(f => f.doc_type && tiposInventario.includes(f.doc_type));
          const pago = factura.files.filter(f => f.doc_type && tiposPago.includes(f.doc_type));
          const facturaPdf = factura.files.find(f => f.doc_type === 'FACTURA_PDF') || null;

          setArchivosOC(oc);
          setArchivoAprobacion(aprobacion[0] || null);
          setArchivoInventario(inventario[0] || null);
          setSoportePago(pago);
          setFacturaPrincipal(facturaPdf);
        }
      } catch (error) {
        console.error('Error general cargando archivos:', error);
        setArchivosOC([]);
        setArchivoAprobacion(null);
        setArchivoInventario(null);
        setSoportePago([]);
        setFacturaPrincipal(null);
      } finally {
        setLoadingArchivos(false);
      }
    };

    cargarArchivos();
  }, [factura.id]);

  useEffect(() => {
    let cancelled = false;
    const cargarHistorial = async () => {
      try {
        setLoadingHistorial(true);
        setHistorialError(null);
        const data = await getHistorialFactura(factura.id);
        if (!cancelled) setHistorial(data);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error cargando historial';
          setHistorialError(msg);
        }
      } finally {
        if (!cancelled) setLoadingHistorial(false);
      }
    };
    cargarHistorial();
    return () => {
      cancelled = true;
    };
  }, [factura.id]);

  const handlePreviewFile = (file: FileMiniOut) => {
    setPreviewFile(file);
  };

  const handleReasignarSuccess = (data: { area_id: string; area_nombre: string; responsable_nombre: string }) => {
    toast.success(`Factura reasignada a ${data.area_nombre} (${data.responsable_nombre})`);
    onReasignada?.(factura.id, data.area_nombre);
    void getHistorialFactura(factura.id).then(setHistorial).catch(() => undefined);
  };

  const eventoTipoStyle = (tipo: string): { icon: JSX.Element; color: string; bg: string } => {
    switch (tipo) {
      case 'recibida':
        return { icon: <FileText className="w-4 h-4" />, color: '#1d4ed8', bg: '#dbeafe' };
      case 'asignacion':
        return { icon: <UserIcon className="w-4 h-4" />, color: '#6d28d9', bg: '#ede9fe' };
      case 'envio_gerencia':
      case 'envio_aprobacion_ops':
      case 'envio_aprobacion_calidad':
        return { icon: <Mail className="w-4 h-4" />, color: '#0369a1', bg: '#e0f2fe' };
      case 'aprobacion_email':
      case 'aprobacion_ops':
      case 'aprobacion_calidad':
        return { icon: <CheckCircle className="w-4 h-4" />, color: '#15803d', bg: '#dcfce7' };
      case 'envio_contabilidad':
      case 'envio_tesoreria':
        return { icon: <Send className="w-4 h-4" />, color: '#0f766e', bg: '#ccfbf1' };
      case 'cierre':
        return { icon: <CheckCircle className="w-4 h-4" />, color: '#047857', bg: '#d1fae5' };
      case 'devolucion':
        return { icon: <RotateCcw className="w-4 h-4" />, color: '#b91c1c', bg: '#fee2e2' };
      default:
        return { icon: <ArrowRight className="w-4 h-4" />, color: '#374151', bg: '#f3f4f6' };
    }
  };

  const formatFechaEvento = (fecha: string | null): string => {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fecha;
    }
  };

  const handleDownloadById = async (file: FileMiniOut) => {
    try {
      const blob = await downloadFileById(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error descargando archivo:', error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFactura(factura.id);
      onDelete?.(factura.id);
      onClose();
    } catch (error) {
      console.error('Error eliminando factura:', error);
      alert('Error al eliminar la factura. Inténtalo de nuevo.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getStatusColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'Recibida': 'bg-blue-100 text-blue-700 border-blue-300',
      'Pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Asignada': 'bg-purple-100 text-purple-700 border-purple-300',
      'En Curso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'En Revisión Contabilidad': 'bg-orange-100 text-orange-700 border-orange-300',
      'Aprobada Tesorería': 'bg-teal-100 text-teal-700 border-teal-300',
      'Pagada': 'bg-green-100 text-green-700 border-green-300',
      'Rechazada': 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <>
      {/* Backdrop con blur elegante */}
      <div 
        className="fixed inset-0 z-50 backdrop-blur-lg" 
        style={{backgroundColor: 'rgba(55, 65, 81, 0.75)'}}
        onClick={onClose} 
      />
      
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div 
            className="w-full max-w-6xl bg-white shadow-2xl rounded-lg border border-gray-200 my-8 relative" 
            style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'}}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}} className="text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-6 h-6" />
                    <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-xl font-semibold">
                      Seguimiento de Factura
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="font-mono text-lg">
                      {factura.numero_factura}
                    </span>
                    <span className={`px-3 py-1 rounded-full border-2 text-sm font-medium ${getStatusColor(factura.estado)}`}>
                      {factura.estado}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="p-6 space-y-6">
                
                {/* Timeline del Proceso */}
                <div>
                  <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-lg font-semibold text-gray-900 mb-4">
                    Proceso de la Factura
                  </h4>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6">
                    <div className="relative">
                      <div className="absolute top-6 left-8 right-8 h-1 bg-gray-200" />
                      <div 
                        className="absolute top-6 left-8 h-1 bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
                        style={{ 
                          width: `${(processSteps.filter(s => s.status === 'completed').length / processSteps.length) * 100}%` 
                        }}
                      />
                      
                      <div className="relative flex justify-between">
                        {processSteps.map((step, index) => (
                          <div key={index} className="flex flex-col items-center" style={{ width: `${100 / processSteps.length}%` }}>
                            <div className={`
                              w-12 h-12 rounded-full flex items-center justify-center mb-2 border-4 transition-all
                              ${step.status === 'completed' ? 'bg-green-500 border-green-200' : 
                                step.status === 'current' ? 'bg-blue-500 border-blue-200 animate-pulse' : 
                                'bg-gray-200 border-gray-100'}
                            `}>
                              {step.status === 'completed' ? (
                                <CheckCircle className="w-6 h-6 text-white" />
                              ) : step.status === 'current' ? (
                                <Clock className="w-6 h-6 text-white" />
                              ) : (
                                <div className="w-3 h-3 bg-gray-400 rounded-full" />
                              )}
                            </div>
                            <span className={`
                              text-xs font-medium text-center px-2
                              ${step.status === 'completed' ? 'text-green-700' : 
                                step.status === 'current' ? 'text-blue-700' : 
                                'text-gray-500'}
                            `}>
                              {step.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historial Completo - vista Director */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <History className="w-5 h-5 text-gray-600" />
                      Historial completo
                    </h4>
                    {puedeReasignar && (
                      <button
                        onClick={() => setShowReasignarModal(true)}
                        style={{
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                          backgroundColor: '#00829a',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#14aab8')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#00829a')}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg"
                        title="Reasignar la factura al área que sí corresponde gestionarla"
                      >
                        <FolderInput className="w-4 h-4" />
                        <span>Reasignar a otra área</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    {loadingHistorial ? (
                      <div className="py-8 text-center text-sm text-gray-500">
                        Cargando historial…
                      </div>
                    ) : historialError ? (
                      <div className="py-6 text-center text-sm text-red-600">
                        {historialError}
                      </div>
                    ) : !historial || historial.eventos.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-500">
                        Sin eventos registrados todavía.
                      </div>
                    ) : (
                      <ol className="space-y-4">
                        {historial.eventos.map((ev: HistorialEvento, idx: number) => {
                          const style = eventoTipoStyle(ev.tipo);
                          const esUltimo = idx === historial.eventos.length - 1;
                          return (
                            <li key={`${ev.tipo}-${idx}`} className="flex gap-4">
                              {/* Columna del icono + línea conectora */}
                              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 36 }}>
                                <div
                                  className="flex items-center justify-center w-9 h-9 rounded-full shadow-sm"
                                  style={{ backgroundColor: style.bg, color: style.color, border: `2px solid ${style.color}` }}
                                >
                                  {style.icon}
                                </div>
                                {!esUltimo && (
                                  <div className="flex-1 w-px bg-gray-200 mt-1" style={{ minHeight: 16 }} />
                                )}
                              </div>

                              {/* Columna de contenido */}
                              <div className="flex-1 min-w-0 pb-2">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                                    {ev.titulo}
                                  </p>
                                  <span className="text-xs text-gray-500 whitespace-nowrap sm:ml-3">
                                    {formatFechaEvento(ev.fecha)}
                                  </span>
                                </div>
                                {ev.descripcion && (
                                  <p className="text-sm text-gray-600 mt-1 leading-snug">
                                    {ev.descripcion}
                                  </p>
                                )}
                                {(ev.area_nombre || ev.responsable_nombre) && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {ev.area_nombre && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                                        <Building2 className="w-3 h-3" />
                                        {ev.area_nombre}
                                      </span>
                                    )}
                                    {ev.responsable_nombre && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                        <UserIcon className="w-3 h-3" />
                                        {ev.responsable_nombre}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>

                  {puedeReasignar && (
                    <p className="mt-2 text-xs text-gray-500">
                      Como dirección puedes redirigir esta factura al área correcta mientras se
                      encuentre asignada. La nueva área la recibirá en su bandeja y el responsable
                      anterior perderá el acceso.
                    </p>
                  )}
                </div>

                {/* Grid de 2 columnas */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* Columna Izquierda - Información */}
                  <div className="space-y-6">
                    
                    {/* Información General */}
                    <div>
                      <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-600" />
                        Información General
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Proveedor</span>
                          <span className="text-sm text-gray-900 font-medium">{factura.proveedor}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Área</span>
                          <span className="text-sm text-gray-900 font-medium">{factura.area}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Fecha de Emisión</span>
                          <span className="text-sm text-gray-900 font-medium flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            }) : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-sm font-semibold text-gray-700">Total a Pagar</span>
                          <span className="text-lg font-bold text-gray-900 flex items-center gap-1">
                            <DollarSign className="w-5 h-5" />
                            ${factura.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carpeta Asignada */}
                    {factura.carpeta && (
                      <div>
                        <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">
                          Archivado
                        </h4>
                        <div style={{backgroundColor: '#e0f5f7', borderColor: '#00829a'}} className="border-2 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle style={{color: '#00829a'}} className="w-5 h-5" />
                            <div>
                              <p style={{color: '#00829a'}} className="text-sm font-medium">Archivado en:</p>
                              <p style={{color: '#00829a'}} className="text-base font-semibold">{factura.carpeta.nombre}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Información Adicional */}
                    {(factura.requiere_entrada_inventarios || factura.presenta_novedad || factura.tiene_anticipo) && (
                      <div>
                        <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">
                          Información Adicional
                        </h4>
                        <div className="space-y-2">
                          {factura.requiere_entrada_inventarios && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-blue-900">Requiere entrada a inventarios</span>
                            </div>
                          )}
                          {factura.presenta_novedad && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-orange-600" />
                              <span className="text-sm text-orange-900">Presenta novedad</span>
                            </div>
                          )}
                          {factura.tiene_anticipo && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-900">Tiene anticipo</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Columna Derecha - Documentos */}
                  <div className="space-y-6">
                    
                    {/* Factura Principal */}
                    <div>
                      <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        Factura Principal
                      </h4>
                      {loadingArchivos ? (
                        <div className="bg-gray-50 rounded-lg p-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      ) : facturaPrincipal ? (
                        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 hover:bg-blue-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-blue-900 font-semibold truncate">{facturaPrincipal.filename}</p>
                                <p className="text-xs text-blue-700 mt-1">Documento principal de la factura</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <button
                                onClick={() => handlePreviewFile(facturaPrincipal)}
                                style={{
                                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                                  backgroundColor: '#2563eb',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-white rounded-lg"
                                title="Vista previa"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Ver</span>
                              </button>
                              <button
                                onClick={() => handleDownloadById(facturaPrincipal)}
                                className="p-2 hover:bg-blue-200 rounded-lg transition-colors"
                                title="Descargar"
                              >
                                <Download className="w-5 h-5 text-blue-700" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-red-300 bg-red-50 rounded-lg p-8 text-center">
                          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-red-700">Factura principal no cargada</p>
                          <p className="text-xs text-red-600 mt-1">Por favor, sube el PDF de la factura</p>
                        </div>
                      )}
                    </div>

                    {/* Factura Radicada */}
                    <div>
                      <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        Factura Radicada
                      </h4>
                      {loadingArchivos ? (
                        <div className="bg-gray-50 rounded-lg p-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      ) : soportePago.length > 0 ? (
                        <div className="space-y-2">
                          {soportePago.map((file) => (
                            <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900 font-medium truncate">{file.filename}</p>
                                    <p className="text-xs text-gray-500">{file.doc_type}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => handlePreviewFile(file)}
                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Vista previa"
                                  >
                                    <Eye className="w-4 h-4 text-blue-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadById(file)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Descargar"
                                  >
                                    <Download className="w-4 h-4 text-green-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Sin archivos</p>
                        </div>
                      )}
                    </div>

                    {/* Documentos Adjuntos */}
                    <div>
                      <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3">
                        Documentos Adjuntos
                      </h4>
                      <div className="space-y-3">
                        
                        {/* OC/OS */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">OC / OS</span>
                            {archivosOC.length > 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          {archivosOC.length > 0 ? (
                            <div className="space-y-1">
                              {archivosOC.map((archivo) => (
                                <div key={archivo.id} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                  <span className="text-gray-700 truncate flex-1">{archivo.filename}</span>
                                  <div className="flex gap-1 ml-2">
                                    <button
                                      onClick={() => handlePreviewFile(archivo)}
                                      className="p-1 hover:bg-blue-50 rounded"
                                    >
                                      <Eye className="w-3 h-3 text-blue-600" />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadById(archivo)}
                                      className="p-1 hover:bg-gray-100 rounded"
                                    >
                                      <Download className="w-3 h-3 text-gray-600" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">No adjuntado</span>
                          )}
                        </div>

                        {/* Aprobación Gerencia */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Aprobación Gerencia</span>
                            {(factura.fecha_aprobacion_email || archivoAprobacion) ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          {factura.fecha_aprobacion_email ? (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              Aprobado por {factura.aprobado_por_nombre || 'gerencia'} (correo)
                            </div>
                          ) : archivoAprobacion ? (
                            <div className="flex items-center justify-between text-xs bg-white rounded p-2">
                              <span className="text-gray-700 truncate flex-1">{archivoAprobacion.filename}</span>
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => handlePreviewFile(archivoAprobacion)}
                                  className="p-1 hover:bg-blue-50 rounded"
                                >
                                  <Eye className="w-3 h-3 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => handleDownloadById(archivoAprobacion)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Download className="w-3 h-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">No adjuntado</span>
                          )}
                        </div>

                        {/* Inventario */}
                        {factura.requiere_entrada_inventarios && archivoInventario && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Soporte Inventario</span>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex items-center justify-between text-xs bg-white rounded p-2">
                              <span className="text-gray-700 truncate flex-1">{archivoInventario.filename}</span>
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => handlePreviewFile(archivoInventario)}
                                  className="p-1 hover:bg-blue-50 rounded"
                                >
                                  <Eye className="w-3 h-3 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => handleDownloadById(archivoInventario)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Download className="w-3 h-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
            <div style={{borderTop:'1px solid #e5e7eb', padding:'16px 24px', backgroundColor:'#f9fafb', borderRadius:'0 0 8px 8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{display:'flex', alignItems:'center', gap:'8px', padding:'10px 18px', backgroundColor:'#dc2626', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:'Neutra Text Book, Montserrat, sans-serif', fontSize:'14px', fontWeight:'500'}}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#dc2626')}
              >
                <Trash2 style={{width:16, height:16}} />
                Eliminar Factura
              </button>
              <button
                onClick={onClose}
                style={{display:'flex', alignItems:'center', gap:'8px', padding:'10px 24px', backgroundColor:'#00829a', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:'Neutra Text Book, Montserrat, sans-serif', fontSize:'14px'}}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#14aab8')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#00829a')}
              >
                Cerrar
                <X style={{width:16, height:16}} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <>
          <div
            onClick={() => setShowDeleteConfirm(false)}
            style={{position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', zIndex:9999}}
          />
          <div style={{position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}>
            <div
              onClick={e => e.stopPropagation()}
              style={{backgroundColor:'white', borderRadius:'12px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', padding:'24px', maxWidth:'400px', width:'100%'}}
            >
              <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px'}}>
                <div style={{width:40, height:40, backgroundColor:'#fee2e2', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <Trash2 style={{width:20, height:20, color:'#dc2626'}} />
                </div>
                <div>
                  <h3 style={{margin:0, fontFamily:'Neutra Text Demi, Montserrat, sans-serif', fontSize:'16px', fontWeight:600, color:'#111827'}}>
                    Eliminar Factura
                  </h3>
                  <p style={{margin:0, fontSize:'13px', color:'#6b7280'}}>{factura.numero_factura}</p>
                </div>
              </div>
              <p style={{fontSize:'14px', color:'#374151', marginBottom:'24px', lineHeight:1.6}}>
                ¿Estás seguro de que deseas eliminar esta factura? Esta acción no se puede deshacer.
              </p>
              <div style={{display:'flex', gap:'12px'}}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{flex:1, padding:'10px', border:'1px solid #d1d5db', borderRadius:'8px', backgroundColor:'white', color:'#374151', cursor:'pointer', fontFamily:'Neutra Text Book, Montserrat, sans-serif', fontSize:'14px'}}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{flex:1, padding:'10px', border:'none', borderRadius:'8px', backgroundColor: isDeleting ? '#f87171' : '#dc2626', color:'white', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily:'Neutra Text Book, Montserrat, sans-serif', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}
                >
                  <Trash2 style={{width:16, height:16}} />
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </>
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

      {/* Modal de reasignar a otra área (vista Director) */}
      {showReasignarModal && (
        <ReasignarAreaModal
          isOpen={showReasignarModal}
          onClose={() => setShowReasignarModal(false)}
          factura={factura}
          onSuccess={handleReasignarSuccess}
        />
      )}
    </>
  );
}
