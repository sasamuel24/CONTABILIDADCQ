import { useState, useEffect } from 'react';
import { X, FileText, Calendar, DollarSign, Building2, CheckCircle, Clock, AlertCircle, Download, Eye } from 'lucide-react';
import type { FacturaListItem, FileMiniOut } from '../lib/api';
import { getFacturaFilesByDocType, downloadFileById } from '../lib/api';
import { FilePreviewModal } from './FilePreviewModal';

interface CentroDocumentalFacturaDetailProps {
  factura: FacturaListItem;
  onClose: () => void;
}

interface ProcessStep {
  name: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

export function CentroDocumentalFacturaDetail({ factura, onClose }: CentroDocumentalFacturaDetailProps) {
  const [archivosOC, setArchivosOC] = useState<FileMiniOut[]>([]);
  const [archivoAprobacion, setArchivoAprobacion] = useState<FileMiniOut | null>(null);
  const [archivoInventario, setArchivoInventario] = useState<FileMiniOut | null>(null);
  const [soportePago, setSoportePago] = useState<FileMiniOut[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);

  // Estados del proceso
  const getProcessSteps = (): ProcessStep[] => {
    const estado = factura.estado;
    const steps: ProcessStep[] = [
      { name: 'Recibida', status: 'completed', date: factura.fecha_emision || undefined },
      { name: 'Asignada', status: 'pending' },
      { name: 'En Curso', status: 'pending' },
      { name: 'Revisión Contabilidad', status: 'pending' },
      { name: 'Aprobada Tesorería', status: 'pending' },
      { name: 'Cerrada', status: 'pending' },
    ];

    const estadoIndex = {
      'Recibida': 0,
      'Pendiente': 0,
      'Asignada': 1,
      'En Curso': 2,
      'En Revisión Contabilidad': 3,
      'Aprobada Tesorería': 4,
      'Cerrada': 5,
      'Rechazada': -1,
    };

    const currentIndex = estadoIndex[estado as keyof typeof estadoIndex] ?? 0;

    if (estado === 'Rechazada') {
      return steps.map((step, i) => ({
        ...step,
        status: i === 0 ? 'completed' : 'pending',
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

        const [oc, aprobacion, inventario, pago] = await Promise.all([
          getFacturaFilesByDocType(factura.id, 'OC,OS,OCT,ECT,OCC,EDO'),
          getFacturaFilesByDocType(factura.id, 'APROBACION_GERENCIA'),
          getFacturaFilesByDocType(factura.id, 'PEC,EC,PCE,PED'),
          getFacturaFilesByDocType(factura.id, 'FACTURA_PDF,SOPORTE_PAGO'),
        ]);

        setArchivosOC(oc);
        setArchivoAprobacion(aprobacion[0] || null);
        setArchivoInventario(inventario[0] || null);
        setSoportePago(pago);
      } catch (error) {
        console.error('Error cargando archivos:', error);
      } finally {
        setLoadingArchivos(false);
      }
    };

    cargarArchivos();
  }, [factura.id]);

  const handlePreviewFile = (file: FileMiniOut) => {
    setPreviewFile(file);
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

  const getStatusColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'Recibida': 'bg-blue-100 text-blue-700 border-blue-300',
      'Pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Asignada': 'bg-purple-100 text-purple-700 border-purple-300',
      'En Curso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'En Revisión Contabilidad': 'bg-orange-100 text-orange-700 border-orange-300',
      'Aprobada Tesorería': 'bg-teal-100 text-teal-700 border-teal-300',
      'Cerrada': 'bg-green-100 text-green-700 border-green-300',
      'Rechazada': 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-6xl bg-white shadow-2xl rounded-lg border border-gray-200 my-8" onClick={(e) => e.stopPropagation()}>
            
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
                            ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
                    
                    {/* Soporte de Pago */}
                    <div>
                      <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        Soporte de Pago
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
                            {archivoAprobacion ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          {archivoAprobacion ? (
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

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                onClick={onClose}
                style={{
                  fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                  backgroundColor: '#00829a',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14aab8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00829a'}
                className="px-6 py-2 text-white rounded-lg flex items-center gap-2"
              >
                Cerrar
                <X className="w-4 h-4" />
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
    </>
  );
}
