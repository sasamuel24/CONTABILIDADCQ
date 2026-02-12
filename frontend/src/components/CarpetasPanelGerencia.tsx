import { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FileText
} from 'lucide-react';
import { 
  getCarpetasTesoreria, 
  API_BASE_URL,
  type CarpetaTesoreria 
} from '../lib/api';

interface CarpetasPanelGerenciaProps {
  onSelectCarpeta: (carpeta: CarpetaTesoreria | null) => void;
  selectedCarpeta: CarpetaTesoreria | null;
}

export function CarpetasPanelGerencia({ onSelectCarpeta, selectedCarpeta }: CarpetasPanelGerenciaProps) {
  const [carpetas, setCarpetas] = useState<CarpetaTesoreria[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCarpetas();
  }, []);

  const loadCarpetas = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCarpetasTesoreria();
      setCarpetas(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar carpetas';
      setError(message);
      console.error('Error loading carpetas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleViewPdf = async (carpetaId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const url = `${API_BASE_URL}/carpetas-tesoreria/${carpetaId}/archivo-egreso-download`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al descargar el archivo');
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al abrir el archivo PDF';
      alert(message);
    }
  };

  const renderCarpeta = (carpeta: CarpetaTesoreria, level: number = 0) => {
    const isExpanded = expandedFolders.has(carpeta.id);
    const hasChildren = carpeta.children && carpeta.children.length > 0;
    const isSelected = selectedCarpeta?.id === carpeta.id;
    const facturaCount = carpeta.facturas?.length || 0;

    return (
      <div key={carpeta.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors ${
            isSelected ? 'border-l-4' : ''
          }`}
          style={{
            paddingLeft: `${level * 20 + 12}px`,
            backgroundColor: isSelected ? '#e0f5f7' : 'transparent',
            borderLeftColor: isSelected ? '#00829a' : 'transparent'
          }}
          onClick={() => onSelectCarpeta(carpeta)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(carpeta.id);
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {isExpanded ? (
            <FolderOpen className="w-4 h-4" style={{color: '#00829a'}} />
          ) : (
            <Folder className="w-4 h-4" style={{color: '#00829a'}} />
          )}

          <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-gray-900 flex-1">{carpeta.nombre}</span>
          
          {carpeta.archivo_egreso_url && (
            <span 
              className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-green-100"
              title="Ver archivo PDF adjunto"
              onClick={(e) => {
                e.stopPropagation();
                handleViewPdf(carpeta.id);
              }}
            >
              <FileText className="w-3 h-3" />
              PDF
            </span>
          )}
          
          {facturaCount > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {facturaCount}
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {carpeta.children.map((child) => renderCarpeta(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{borderColor: '#00829a'}}></div>
          <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-600">Cargando carpetas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadCarpetas}
          className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header - Solo lectura, sin botón "Nueva" */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="font-semibold text-gray-900">Carpetas de Programación</h3>
        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200" style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}>
          Solo lectura
        </span>
      </div>

      {/* Lista de carpetas */}
      <div className="max-h-[600px] overflow-y-auto">
        {carpetas.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm text-gray-600">No hay carpetas</p>
            <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500 mt-1">Aún no se han creado carpetas de programación</p>
          </div>
        ) : (
          <div className="group">
            {carpetas.map((carpeta) => renderCarpeta(carpeta))}
          </div>
        )}
      </div>
    </div>
  );
}
