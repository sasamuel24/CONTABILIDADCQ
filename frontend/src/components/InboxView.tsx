import { useState, useEffect } from 'react';
import { Search, FileText, ChevronDown, Filter, Download, X, Eye, AlertCircle } from 'lucide-react';
import { 
  getFacturas, 
  getAreas, 
  updateFactura,
  getFacturaFilesByDocType,
  API_BASE_URL,
  downloadFileById,
  type FacturaListItem,
  type Area,
  type FacturaUpdate,
  type FileMiniOut
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { ResponsableFacturaDetail } from './ResponsableFacturaDetail';
import { ContabilidadFacturaDetail } from './ContabilidadFacturaDetail';
import { TesoreriaFacturaDetail } from './TesoreriaFacturaDetail';
import { FilePreviewModal } from './FilePreviewModal';

interface AreaWithCount extends Area {
  count: number;
}

interface UserOption {
  id: string;
  nombre: string;
}

const statusConfig: Record<string, { color: string; bgColor: string }> = {
  'Recibida': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  'Asignada': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  'En Curso': { color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  'Cerrada': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  'Rechazada': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

export function InboxView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soportePagoFiles, setSoportePagoFiles] = useState<FileMiniOut[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);
  const itemsPerPage = 10;

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      loadInboxData();
    }
  }, [user]);

  const loadInboxData = async () => {
    setIsLoading(true);
    setError(null);
    
    // Validar que el usuario tenga área asignada
    if (!user?.area?.nombre) {
      setError('Tu usuario no tiene un área asignada. Contacta al administrador.');
      setIsLoading(false);
      return;
    }
    
    try {
      const [facturasData, areasData] = await Promise.all([
        getFacturas(0, 1000), // Cargar todas las facturas
        getAreas(),
      ]);
      
      // Filtrar facturas por área del usuario
      const facturasDelArea = facturasData.items.filter(
        f => f.area === user.area?.nombre
      );
      
      setFacturas(facturasDelArea);
      setAreas(areasData);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos del inbox');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAreaChange = async (facturaId: string, newAreaId: string) => {
    try {
      const updated = await updateFactura(facturaId, { area_id: newAreaId });
      setFacturas(facturas.map(f => 
        f.id === facturaId ? { ...f, area: updated.area } : f
      ));
      if (selectedFactura?.id === facturaId) {
        setSelectedFactura({ ...selectedFactura, area: updated.area });
      }
      alert('✅ Área actualizada correctamente');
    } catch (err) {
      console.error('Error al actualizar área:', err);
      alert('Error al actualizar el área de la factura');
    }
  };

  const handleRowClick = (factura: FacturaListItem) => {
    setSelectedFactura(factura);
    setAreaSeleccionada(areas.find(a => a.nombre === factura.area)?.id || '');
    loadSoportePagoFiles(factura.id);
  };

  const loadSoportePagoFiles = async (facturaId: string) => {
    setLoadingFiles(true);
    try {
      const files = await getFacturaFilesByDocType(facturaId, 'FACTURA_PDF');
      setSoportePagoFiles(files);
    } catch (err) {
      console.error('Error al cargar archivos FACTURA_PDF:', err);
      setSoportePagoFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const closeDrawer = () => {
    setSelectedFactura(null);
    setAreaSeleccionada('');
    setSoportePagoFiles([]);
  };

  const handleDownloadFile = (storageProvider: string, storagePath: string, filename: string) => {
    try {
      if (storageProvider === 's3' && selectedFactura) {
        // Usar el filename tal cual (respeta extensión original: .pdf, .png, .jpg, etc.)
        const finalFilename = filename;
        
        // Usar endpoint proxy del backend para archivos S3
        const downloadUrl = `${API_BASE_URL}/api/v1/facturas/${selectedFactura.id}/files/download?key=${encodeURIComponent(storagePath)}`;
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

  const filteredFacturas = facturas.filter(f => {
    const matchesSearch = f.proveedor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.numero_factura.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'Todos' || f.estado === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const statusCounts: Record<string, number> = {
    Todos: facturas.length,
    ...Array.from(new Set(facturas.map(f => f.estado))).reduce((acc, estado) => ({
      ...acc,
      [estado]: facturas.filter(f => f.estado === estado).length
    }), {})
  };

  const totalPages = Math.ceil(filteredFacturas.length / itemsPerPage);
  const currentFacturas = filteredFacturas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-gray-900 mb-2">Bandeja de Facturas</h2>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 text-center animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-gray-600 mb-1">Total Facturas</p>
              <p className="text-gray-900">{facturas.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-gray-600 mb-1">Recibidas</p>
              <p className="text-blue-600">{statusCounts['Recibida'] || 0}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-gray-600 mb-1">Cerradas</p>
              <p className="text-green-600">{statusCounts['Cerrada'] || 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por proveedor o número de factura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Todos ({statusCounts.Todos})</option>
              {Object.entries(statusCounts).filter(([key]) => key !== 'Todos').map(([estado, count]) => (
                <option key={estado} value={estado}>{estado} ({count})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600">
                  <div className="flex items-center gap-1">
                    Proveedor
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-gray-600">
                  <div className="flex items-center gap-1">
                    N° Factura
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-gray-600">
                  <div className="flex items-center gap-1">
                    Area Receptora
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-gray-600">
                  <div className="flex items-center gap-1">
                    Fecha Emisión
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-right px-6 py-3 text-gray-600">
                  <div className="flex items-center justify-end gap-1">
                    Total a Pagar
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-gray-600">Estado</th>
                <th className="text-center px-6 py-3 text-gray-600">PDF</th>
                <th className="text-center px-6 py-3 text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                // Loading skeleton
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div></td>
                  </tr>
                ))
              ) : currentFacturas.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <FileText className="w-12 h-12 mb-3 text-gray-400" />
                      <p className="text-lg font-medium text-gray-700 mb-1">
                        No hay facturas para tu área
                      </p>
                      <p className="text-sm text-gray-500">
                        {user?.area?.nombre && `Área actual: ${user.area.nombre}`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentFacturas.map((factura) => (
                  <tr 
                    key={factura.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer" 
                    onClick={() => handleRowClick(factura)}
                  >
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{factura.proveedor}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700 font-mono">{factura.numero_factura}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{factura.area}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">
                        {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-gray-900">
                        ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full border text-sm ${statusConfig[factura.estado]?.bgColor || 'bg-gray-100 border-gray-200'} ${statusConfig[factura.estado]?.color || 'text-gray-700'}`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {factura.files && factura.files.length > 0 ? (
                        <div className="inline-flex items-center gap-1">
                          <div className="inline-flex items-center justify-center w-8 h-8 bg-red-50 rounded">
                            <FileText className="w-4 h-4 text-red-600" />
                          </div>
                          <span className="text-xs text-gray-500">{factura.files.length}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && filteredFacturas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron facturas
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <div className="text-gray-700">
            Página {currentPage} de {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Drawer para detalles y asignación de factura */}
      {selectedFactura && (
        <>
          {/* Si el usuario es responsable, usar el componente de Responsable */}
          {user?.role === 'responsable' ? (
            <ResponsableFacturaDetail
              factura={selectedFactura}
              onClose={closeDrawer}
            />
          ) : user?.role === 'contabilidad' ? (
            /* Si el usuario es contabilidad, usar el componente de Auditoría */
            <ContabilidadFacturaDetail
              factura={selectedFactura}
              onClose={closeDrawer}
            />
          ) : user?.role === 'tesoreria' ? (
            /* Si el usuario es tesorería, usar el componente de Tesorería */
            <TesoreriaFacturaDetail
              factura={selectedFactura}
              onClose={closeDrawer}
            />
          ) : (
            <>
              {/* Modal original para otros roles */}
              {/* Overlay - Fondo blanco que cubre toda la app */}
              <div className="fixed inset-0 bg-white z-40" />
              
              {/* Drawer Panel - Centrado */}
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <div className="w-full max-w-2xl bg-white shadow-2xl rounded-lg flex flex-col max-h-[90vh] border border-gray-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mt-2">
                  <h3 className="text-white mb-2">Detalle de Factura</h3>
                </div>
                <button 
                  onClick={closeDrawer}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="font-mono text-white">{selectedFactura.numero_factura}</span>
                <span className="text-blue-200">•</span>
                <span className={`px-3 py-1 rounded-full border text-sm ${statusConfig[selectedFactura.estado]?.bgColor || 'bg-gray-100 border-gray-200'} ${statusConfig[selectedFactura.estado]?.color || 'text-gray-700'}`}>
                  {selectedFactura.estado}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Alerta de Devolución (si existe motivo) */}
              {selectedFactura.motivo_devolucion && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-red-900 font-semibold mb-1">Factura Devuelta por Responsable</h4>
                      <p className="text-red-700 text-sm mb-2">
                        Esta factura fue devuelta para correcciones. Por favor revise y corrija antes de reasignar.
                      </p>
                      <div className="bg-white border border-red-200 rounded p-3">
                        <p className="text-xs font-semibold text-red-900 mb-1">MOTIVO DE DEVOLUCIÓN:</p>
                        <p className="text-sm text-gray-800">{selectedFactura.motivo_devolucion}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Información de la Factura */}
              <div>
                <h4 className="text-gray-900 mb-3">Información de la Factura</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Proveedor</span>
                    <span className="text-gray-900">{selectedFactura.proveedor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Área</span>
                    <span className="text-gray-900">{selectedFactura.area}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha de Emisión</span>
                    <span className="text-gray-900">
                      {selectedFactura.fecha_emision ? new Date(selectedFactura.fecha_emision).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      }) : '-'}
                    </span>
                  </div>
                  {selectedFactura.centro_costo && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Centro de Costo</span>
                      <span className="text-gray-900">{selectedFactura.centro_costo}</span>
                    </div>
                  )}
                  {selectedFactura.centro_operacion && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Centro de Operación</span>
                      <span className="text-gray-900">{selectedFactura.centro_operacion}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <span className="text-gray-900">Total a Pagar</span>
                    <span className="text-gray-900">
                      ${selectedFactura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Archivos de Soporte de Pago */}
              <div>
                <h4 className="text-gray-900 mb-3">Soporte de Pago</h4>
                {loadingFiles ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

              {/* Cambiar Área */}
              <div>
                <h4 className="text-gray-900 mb-3">Cambiar Área</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">
                      Área Responsable
                    </label>
                    <select
                      value={areaSeleccionada}
                      onChange={(e) => setAreaSeleccionada(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar área...</option>
                      {areas.map(area => (
                        <option key={area.id} value={area.id}>{area.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => areaSeleccionada && handleAreaChange(selectedFactura.id, areaSeleccionada)}
                    disabled={!areaSeleccionada || areaSeleccionada === areas.find(a => a.nombre === selectedFactura.area)?.id}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Actualizar Área
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <button
                onClick={closeDrawer}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
            </div>
          </div>
            </>
          )}
        </>
      )}

      {/* Modal de vista previa */}
      {previewFile && selectedFactura && (
        <FilePreviewModal
          fileId={previewFile.id}
          filename={previewFile.filename}
          contentType={previewFile.content_type}
          storagePath={previewFile.storage_path}
          facturaId={selectedFactura.id}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownloadById(previewFile)}
        />
      )}
    </div>
  );
}