import { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  Home, 
  Search, 
  ArrowLeft,
  Eye,
  DollarSign,
  Calendar,
  Building2,
  Loader2,
  AlertCircle,
  FolderTree,
  Hash,
  Clock,
  CheckSquare,
  Square,
  XCircle,
  CheckCircle2,
  Loader2 as Loader2Icon
} from 'lucide-react';
import { 
  getCarpetas, 
  getFacturas,
  updateFacturaEstado,
  type Carpeta, 
  type FacturaListItem 
} from '../lib/api';
import { TesoreriaFacturaDetail } from './TesoreriaFacturaDetail';
import { ConfirmModal } from './ConfirmModal';

const statusConfig: Record<string, { color: string; bgColor: string; border: string }> = {
  'Recibida': { color: '#1d4ed8', bgColor: '#eff6ff', border: '#bfdbfe' },
  'Pendiente': { color: '#a16207', bgColor: '#fefce8', border: '#fde68a' },
  'Asignada': { color: '#7c3aed', bgColor: '#f5f3ff', border: '#c4b5fd' },
  'En Curso': { color: '#4338ca', bgColor: '#eef2ff', border: '#a5b4fc' },
  'Cerrada': { color: '#15803d', bgColor: '#f0fdf4', border: '#86efac' },
  'Rechazada': { color: '#dc2626', bgColor: '#fef2f2', border: '#fca5a5' },
};

// Contar todas las facturas recursivamente en una carpeta y sus subcarpetas
function contarFacturasRecursivo(carpeta: Carpeta): number {
  let count = carpeta.facturas?.length || 0;
  if (carpeta.children) {
    for (const child of carpeta.children) {
      count += contarFacturasRecursivo(child);
    }
  }
  return count;
}

// Encontrar una carpeta por ID en el árbol
function findCarpetaById(carpetas: Carpeta[], id: string): Carpeta | null {
  for (const carpeta of carpetas) {
    if (carpeta.id === id) return carpeta;
    if (carpeta.children) {
      const found = findCarpetaById(carpeta.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Construir la ruta de breadcrumbs hasta una carpeta
function buildBreadcrumbPath(carpetas: Carpeta[], targetId: string): Carpeta[] {
  const path: Carpeta[] = [];
  
  function search(items: Carpeta[], trail: Carpeta[]): boolean {
    for (const item of items) {
      const newTrail = [...trail, item];
      if (item.id === targetId) {
        path.push(...newTrail);
        return true;
      }
      if (item.children && search(item.children, newTrail)) {
        return true;
      }
    }
    return false;
  }
  
  search(carpetas, []);
  return path;
}

export function ExploradorArchivosTesoreria() {
  const [carpetasRaiz, setCarpetasRaiz] = useState<Carpeta[]>([]);
  const [allFacturas, setAllFacturas] = useState<Map<string, FacturaListItem>>(new Map());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [hoveredFactura, setHoveredFactura] = useState<string | null>(null);
  
  // Multi-select
  const [selectedFacturaIds, setSelectedFacturaIds] = useState<Set<string>>(new Set());
  const [isBatchClosing, setIsBatchClosing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({ title: '', message: '', type: 'info' });

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [carpetasData, facturasData] = await Promise.all([
          getCarpetas(),
          getFacturas(0, 10000)
        ]);
        
        setCarpetasRaiz(carpetasData);
        
        // Crear mapa de facturas para lookup rápido
        const facturasMap = new Map<string, FacturaListItem>();
        facturasData.items.forEach(f => facturasMap.set(f.id, f));
        setAllFacturas(facturasMap);
        
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos';
        setError(message);
        console.error('Error loading explorer data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Carpeta actual
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return findCarpetaById(carpetasRaiz, currentFolderId);
  }, [carpetasRaiz, currentFolderId]);

  // Breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    return buildBreadcrumbPath(carpetasRaiz, currentFolderId);
  }, [carpetasRaiz, currentFolderId]);

  // Items visibles en la vista actual
  const visibleFolders = useMemo(() => {
    const folders = currentFolder ? (currentFolder.children || []) : carpetasRaiz;
    if (!searchQuery) return folders;
    return folders.filter(f => 
      f.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentFolder, carpetasRaiz, searchQuery]);

  const visibleFacturas = useMemo(() => {
    const facturaRefs = currentFolder?.facturas || [];
    const facturas = facturaRefs
      .map(ref => allFacturas.get(ref.id))
      .filter((f): f is FacturaListItem => f !== undefined);
    
    if (!searchQuery) return facturas;
    return facturas.filter(f =>
      f.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.proveedor.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentFolder, allFacturas, searchQuery]);

  // Navegación
  const navigateToFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  };

  const navigateToRoot = () => {
    setCurrentFolderId(null);
    setSearchQuery('');
  };

  const navigateBack = () => {
    if (currentFolder?.parent_id) {
      setCurrentFolderId(currentFolder.parent_id);
    } else {
      setCurrentFolderId(null);
    }
    setSearchQuery('');
  };

  const handleFacturaClick = (factura: FacturaListItem) => {
    // Si hay selección activa, toggle en lugar de abrir detalle
    if (selectedFacturaIds.size > 0) {
      toggleSelectFactura(factura.id);
      return;
    }
    setSelectedFactura(factura);
  };

  // Multi-select handlers
  const toggleSelectFactura = (facturaId: string) => {
    setSelectedFacturaIds(prev => {
      const next = new Set(prev);
      if (next.has(facturaId)) {
        next.delete(facturaId);
      } else {
        next.add(facturaId);
      }
      return next;
    });
  };

  const selectAllFacturas = () => {
    if (selectedFacturaIds.size === visibleFacturas.length) {
      setSelectedFacturaIds(new Set());
    } else {
      setSelectedFacturaIds(new Set(visibleFacturas.map(f => f.id)));
    }
  };

  const clearSelection = () => {
    setSelectedFacturaIds(new Set());
  };

  const handleBatchClose = () => {
    const count = selectedFacturaIds.size;
    const nonCerradas = visibleFacturas.filter(
      f => selectedFacturaIds.has(f.id) && f.estado !== 'Cerrada'
    );
    
    if (nonCerradas.length === 0) {
      setConfirmModalConfig({
        title: 'Sin facturas para cerrar',
        message: 'Todas las facturas seleccionadas ya están cerradas.',
        type: 'info'
      });
      setShowConfirmModal(true);
      return;
    }

    setConfirmModalConfig({
      title: 'Cerrar Facturas',
      message: `¿Está seguro de cerrar ${nonCerradas.length} factura${nonCerradas.length !== 1 ? 's' : ''}?\n\nFacturas a cerrar:\n${nonCerradas.map(f => `• ${f.numero_factura} - ${f.proveedor}`).join('\n')}`,
      type: 'warning',
      showCancel: true,
      onConfirm: executeBatchClose
    });
    setShowConfirmModal(true);
  };

  const executeBatchClose = async () => {
    setIsBatchClosing(true);
    setShowConfirmModal(false);
    
    const nonCerradas = visibleFacturas.filter(
      f => selectedFacturaIds.has(f.id) && f.estado !== 'Cerrada'
    );
    
    let exitosas = 0;
    let fallidas = 0;
    
    for (const factura of nonCerradas) {
      try {
        await updateFacturaEstado(factura.id, 5); // 5 = Cerrada
        exitosas++;
      } catch (err) {
        console.error(`Error cerrando factura ${factura.numero_factura}:`, err);
        fallidas++;
      }
    }
    
    // Recargar datos
    try {
      const [carpetasData, facturasData] = await Promise.all([
        getCarpetas(),
        getFacturas(0, 10000)
      ]);
      setCarpetasRaiz(carpetasData);
      const facturasMap = new Map<string, FacturaListItem>();
      facturasData.items.forEach(f => facturasMap.set(f.id, f));
      setAllFacturas(facturasMap);
    } catch (err) {
      console.error('Error reloading:', err);
    }
    
    setSelectedFacturaIds(new Set());
    setIsBatchClosing(false);
    
    if (fallidas > 0) {
      setConfirmModalConfig({
        title: 'Cierre Parcial',
        message: `Se cerraron ${exitosas} factura${exitosas !== 1 ? 's' : ''} exitosamente.\n${fallidas} factura${fallidas !== 1 ? 's' : ''} no pudieron ser cerradas.`,
        type: 'warning'
      });
    } else {
      setConfirmModalConfig({
        title: 'Facturas Cerradas',
        message: `${exitosas} factura${exitosas !== 1 ? 's' : ''} cerrada${exitosas !== 1 ? 's' : ''} exitosamente.`,
        type: 'success'
      });
    }
    setShowConfirmModal(true);
  };

  const handleCloseDetail = () => {
    setSelectedFactura(null);
    // Recargar datos después de cerrar
    const reload = async () => {
      try {
        const [carpetasData, facturasData] = await Promise.all([
          getCarpetas(),
          getFacturas(0, 10000)
        ]);
        setCarpetasRaiz(carpetasData);
        const facturasMap = new Map<string, FacturaListItem>();
        facturasData.items.forEach(f => facturasMap.set(f.id, f));
        setAllFacturas(facturasMap);
      } catch (err) {
        console.error('Error reloading:', err);
      }
    };
    reload();
  };

  // Contar totales
  const totalCarpetas = visibleFolders.length;
  const totalFacturasEnVista = visibleFacturas.length;

  if (selectedFactura) {
    return <TesoreriaFacturaDetail factura={selectedFactura} onClose={handleCloseDetail} />;
  }

  return (
    <><div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#e0f5f7' }}
            >
              <FolderTree className="w-5 h-5" style={{ color: '#00829a' }} />
            </div>
            <div>
              <h2 
                style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }} 
                className="text-xl font-bold text-gray-900"
              >
                Explorador de Archivos
              </h2>
              <p 
                style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} 
                className="text-sm text-gray-500"
              >
                Carpetas asignadas desde Contabilidad
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Folder className="w-4 h-4" />
              <span>{totalCarpetas} carpeta{totalCarpetas !== 1 ? 's' : ''}</span>
            </div>
            {currentFolder && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span>{totalFacturasEnVista} factura{totalFacturasEnVista !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-3">
          {currentFolderId && (
            <button
              onClick={navigateBack}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#00829a' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f5f7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Volver atrás"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <nav className="flex items-center gap-1 flex-wrap">
            <button
              onClick={navigateToRoot}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ 
                fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                color: currentFolderId ? '#00829a' : '#374151',
                backgroundColor: !currentFolderId ? '#e0f5f7' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (currentFolderId) e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                if (currentFolderId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Home className="w-4 h-4" />
              Inicio
            </button>
            
            {breadcrumbPath.map((carpeta, index) => (
              <div key={carpeta.id} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => navigateToFolder(carpeta.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ 
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    color: index === breadcrumbPath.length - 1 ? '#374151' : '#00829a',
                    backgroundColor: index === breadcrumbPath.length - 1 ? '#e0f5f7' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (index !== breadcrumbPath.length - 1) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    if (index !== breadcrumbPath.length - 1) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {index === breadcrumbPath.length - 1 ? (
                    <FolderOpen className="w-4 h-4" style={{ color: '#00829a' }} />
                  ) : (
                    <Folder className="w-4 h-4" />
                  )}
                  {carpeta.nombre}
                </button>
              </div>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={currentFolder 
              ? `Buscar en "${currentFolder.nombre}"...` 
              : 'Buscar carpetas...'
            }
            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none"
            onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(0, 130, 154, 0.3)'}
            onBlur={(e) => e.target.style.boxShadow = 'none'}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: '#00829a' }} />
            <p style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} className="text-gray-500">
              Cargando explorador de archivos...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-700 font-medium mb-1">Error al cargar datos</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Folders List */}
            {visibleFolders.length > 0 && (
              <div className="mb-6">
                {currentFolder && visibleFacturas.length > 0 && (
                  <p 
                    style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} 
                    className="text-xs uppercase tracking-wider text-gray-400 mb-3"
                  >
                    Subcarpetas
                  </p>
                )}
                <div className="space-y-2">
                  {visibleFolders.map(folder => {
                    const totalFacturas = contarFacturasRecursivo(folder);
                    const subfolderCount = folder.children?.length || 0;
                    const isHovered = hoveredFolder === folder.id;
                    
                    return (
                      <button
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id)}
                        onMouseEnter={() => setHoveredFolder(folder.id)}
                        onMouseLeave={() => setHoveredFolder(null)}
                        className="flex items-center w-full px-5 py-4 rounded-xl border transition-all duration-200 text-left"
                        style={{
                          backgroundColor: isHovered ? '#fafcfd' : 'white',
                          borderColor: isHovered ? '#00829a' : '#e5e7eb',
                          boxShadow: isHovered 
                            ? '0 4px 15px -3px rgba(0, 130, 154, 0.1)' 
                            : '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        {/* Folder Icon */}
                        <div className="flex-shrink-0 mr-4">
                          {isHovered ? (
                            <FolderOpen className="w-6 h-6" style={{ color: '#00829a' }} />
                          ) : (
                            <Folder className="w-6 h-6" style={{ color: '#d4a017' }} />
                          )}
                        </div>
                        
                        {/* Folder Info */}
                        <div className="flex-1 min-w-0">
                          <p 
                            style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} 
                            className="text-sm font-semibold text-gray-900 truncate"
                            title={folder.nombre}
                          >
                            {folder.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span 
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#00829a' }} 
                              className="text-xs"
                            >
                              {totalFacturas} Factura{totalFacturas !== 1 ? 's' : ''}
                            </span>
                            {subfolderCount > 0 && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span 
                                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} 
                                  className="text-xs text-gray-400"
                                >
                                  {subfolderCount} Subcarpeta{subfolderCount !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                            <span className="text-gray-300">|</span>
                            <span 
                              style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} 
                              className="text-xs text-gray-400"
                            >
                              Creada {new Date(folder.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 ml-3">
                          <ChevronRight 
                            className="w-5 h-5 transition-transform duration-200" 
                            style={{ 
                              color: isHovered ? '#00829a' : '#d1d5db',
                              transform: isHovered ? 'translateX(2px)' : 'none'
                            }} 
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Facturas in current folder */}
            {visibleFacturas.length > 0 && (
              <div>
                {/* Selection bar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAllFacturas}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                      style={{ 
                        fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                        color: selectedFacturaIds.size === visibleFacturas.length && visibleFacturas.length > 0 ? '#00829a' : '#6b7280',
                        backgroundColor: selectedFacturaIds.size === visibleFacturas.length && visibleFacturas.length > 0 ? '#e0f5f7' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f5f7'}
                      onMouseLeave={(e) => {
                        if (!(selectedFacturaIds.size === visibleFacturas.length && visibleFacturas.length > 0)) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {selectedFacturaIds.size === visibleFacturas.length && visibleFacturas.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      Seleccionar todo
                    </button>
                    <p 
                      style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} 
                      className="text-xs uppercase tracking-wider text-gray-400"
                    >
                      Facturas ({visibleFacturas.length})
                    </p>
                  </div>
                  
                  {/* Batch actions */}
                  {selectedFacturaIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span 
                        style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                        className="text-sm text-gray-500"
                      >
                        {selectedFacturaIds.size} seleccionada{selectedFacturaIds.size !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={clearSelection}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border border-gray-300 text-gray-600"
                        style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleBatchClose}
                        disabled={isBatchClosing}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-white"
                        style={{ 
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                          backgroundColor: isBatchClosing ? '#9ca3af' : '#00829a',
                          cursor: isBatchClosing ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => { if (!isBatchClosing) e.currentTarget.style.backgroundColor = '#14aab8'; }}
                        onMouseLeave={(e) => { if (!isBatchClosing) e.currentTarget.style.backgroundColor = '#00829a'; }}
                      >
                        {isBatchClosing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cerrando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Cerrar Facturas
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {visibleFacturas.map(factura => {
                    const isHovered = hoveredFactura === factura.id;
                    const status = statusConfig[factura.estado] || { color: '#6b7280', bgColor: '#f9fafb', border: '#e5e7eb' };
                    
                    return (
                      <div
                        key={factura.id}
                        onClick={() => handleFacturaClick(factura)}
                        onMouseEnter={() => setHoveredFactura(factura.id)}
                        onMouseLeave={() => setHoveredFactura(null)}
                        className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                        style={{
                          backgroundColor: selectedFacturaIds.has(factura.id) ? '#e0f5f7' : isHovered ? '#fafbfc' : 'white',
                          borderColor: selectedFacturaIds.has(factura.id) ? '#00829a' : isHovered ? '#00829a' : '#e5e7eb',
                          boxShadow: isHovered 
                            ? '0 4px 15px -3px rgba(0, 130, 154, 0.12)' 
                            : '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        {/* Checkbox */}
                        <div 
                          className="flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); toggleSelectFactura(factura.id); }}
                        >
                          {selectedFacturaIds.has(factura.id) ? (
                            <CheckSquare className="w-5 h-5" style={{ color: '#00829a' }} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300" style={{ color: isHovered ? '#9ca3af' : '#d1d5db' }} />
                          )}
                        </div>
                        
                        {/* File Icon */}
                        <div 
                          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: status.bgColor }}
                        >
                          <FileText className="w-5 h-5" style={{ color: status.color }} />
                        </div>
                        
                        {/* Main Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p 
                              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }} 
                              className="text-sm font-semibold text-gray-900 truncate"
                            >
                              {factura.numero_factura}
                            </p>
                            <span 
                              className="px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
                              style={{ 
                                color: status.color, 
                                backgroundColor: status.bgColor, 
                                borderColor: status.border 
                              }}
                            >
                              {factura.estado}
                            </span>
                          </div>
                          <p 
                            style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }} 
                            className="text-sm text-gray-500 truncate"
                          >
                            {factura.proveedor}
                          </p>
                        </div>
                        
                        {/* Details - stacked on the right */}
                        <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                              {factura.area}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                              {factura.fecha_emision 
                                ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', { 
                                    day: '2-digit', month: 'short', year: 'numeric' 
                                  })
                                : '—'
                              }
                            </span>
                          </div>
                          {factura.fecha_vencimiento && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="w-3.5 h-3.5" style={{ color: new Date(factura.fecha_vencimiento) < new Date() ? '#dc2626' : '#f59e0b' }} />
                              <span style={{ 
                                fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                                color: new Date(factura.fecha_vencimiento) < new Date() ? '#dc2626' : '#92400e'
                              }}>
                                Vence: {new Date(factura.fecha_vencimiento).toLocaleDateString('es-ES', { 
                                  day: '2-digit', month: 'short', year: 'numeric' 
                                })}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                            <span 
                              style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                              className="text-sm font-semibold text-gray-900"
                            >
                              ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex-shrink-0">
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                            style={{ 
                              backgroundColor: isHovered ? '#e0f5f7' : 'transparent',
                              color: '#00829a' 
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {visibleFolders.length === 0 && visibleFacturas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#e0f5f7' }}
                >
                  {searchQuery ? (
                    <Search className="w-9 h-9" style={{ color: '#00829a', opacity: 0.5 }} />
                  ) : currentFolder ? (
                    <FolderOpen className="w-9 h-9" style={{ color: '#00829a', opacity: 0.5 }} />
                  ) : (
                    <FolderTree className="w-9 h-9" style={{ color: '#00829a', opacity: 0.5 }} />
                  )}
                </div>
                <p 
                  style={{ fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
                  className="text-gray-500 font-medium mb-1"
                >
                  {searchQuery 
                    ? 'Sin resultados' 
                    : currentFolder 
                      ? 'Carpeta vacía' 
                      : 'No hay carpetas disponibles'
                  }
                </p>
                <p 
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                  className="text-sm text-gray-400"
                >
                  {searchQuery 
                    ? `No se encontraron resultados para "${searchQuery}"` 
                    : currentFolder 
                      ? 'Esta carpeta no contiene subcarpetas ni facturas' 
                      : 'Las carpetas aparecerán aquí cuando Contabilidad asigne facturas'
                  }
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    
    {/* Modal de confirmación */}
    <ConfirmModal
      isOpen={showConfirmModal}
      onClose={() => setShowConfirmModal(false)}
      onConfirm={confirmModalConfig.onConfirm}
      title={confirmModalConfig.title}
      message={confirmModalConfig.message}
      type={confirmModalConfig.type}
      showCancel={confirmModalConfig.showCancel}
    />
  </>);
}
