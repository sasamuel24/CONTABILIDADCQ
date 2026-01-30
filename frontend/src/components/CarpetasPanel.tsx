import { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Edit2, 
  Trash2, 
  FileText,
  X,
  Check
} from 'lucide-react';
import { 
  getCarpetas, 
  createCarpeta, 
  updateCarpeta, 
  deleteCarpeta,
  type Carpeta 
} from '../lib/api';

interface CarpetasPanelProps {
  onSelectCarpeta: (carpeta: Carpeta | null) => void;
  selectedCarpeta: Carpeta | null;
}

export function CarpetasPanel({ onSelectCarpeta, selectedCarpeta }: CarpetasPanelProps) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentForNew, setParentForNew] = useState<string | null>(null);

  useEffect(() => {
    loadCarpetas();
  }, []);

  const loadCarpetas = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCarpetas();
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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createCarpeta({
        nombre: newFolderName.trim(),
        parent_id: parentForNew,
      });
      setNewFolderName('');
      setParentForNew(null);
      setIsCreating(false);
      await loadCarpetas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear carpeta';
      alert(message);
    }
  };

  const handleUpdateFolder = async (carpetaId: string, newName: string) => {
    if (!newName.trim()) return;

    try {
      await updateCarpeta(carpetaId, { nombre: newName.trim() });
      setEditingId(null);
      await loadCarpetas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar carpeta';
      alert(message);
    }
  };

  const handleDeleteFolder = async (carpetaId: string, carpetaNombre: string) => {
    if (!confirm(`¿Eliminar la carpeta "${carpetaNombre}" y todas sus subcarpetas?`)) {
      return;
    }

    try {
      await deleteCarpeta(carpetaId);
      if (selectedCarpeta?.id === carpetaId) {
        onSelectCarpeta(null);
      }
      await loadCarpetas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar carpeta';
      alert(message);
    }
  };

  const renderCarpeta = (carpeta: Carpeta, level: number = 0) => {
    const isExpanded = expandedFolders.has(carpeta.id);
    const hasChildren = carpeta.children && carpeta.children.length > 0;
    const isSelected = selectedCarpeta?.id === carpeta.id;
    const isEditing = editingId === carpeta.id;
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
        >
          {hasChildren && (
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
          )}
          
          {!hasChildren && <div className="w-5" />}
          
          <div
            className="flex-1 flex items-center gap-2"
            onClick={() => onSelectCarpeta(carpeta)}
          >
            {isExpanded ? (
              <FolderOpen className="w-4 h-4" style={{color: '#00829a'}} />
            ) : (
              <Folder className="w-4 h-4" style={{color: '#00829a'}} />
            )}
            
            {isEditing ? (
              <input
                type="text"
                defaultValue={carpeta.nombre}
                autoFocus
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    handleUpdateFolder(carpeta.id, e.target.value);
                  } else {
                    setEditingId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-2 py-0.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <>
                <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-gray-900">{carpeta.nombre}</span>
                {facturaCount > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {facturaCount}
                  </span>
                )}
              </>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setParentForNew(carpeta.id);
                  setIsCreating(true);
                }}
                className="p-1 hover:bg-gray-200 rounded"
                title="Crear subcarpeta"
              >
                <FolderPlus className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(carpeta.id);
                }}
                className="p-1 hover:bg-gray-200 rounded"
                title="Renombrar"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(carpeta.id, carpeta.nombre);
                }}
                className="p-1 hover:bg-red-100 rounded"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
              </button>
            </div>
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="font-semibold text-gray-900">Carpetas</h3>
        <button
          onClick={() => {
            setParentForNew(null);
            setIsCreating(true);
          }}
          style={{
            fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
            backgroundColor: '#00829a',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14aab8'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00829a'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg"
        >
          <FolderPlus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Formulario de creación */}
      {isCreating && (
        <div style={{backgroundColor: '#e0f5f7'}} className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4" style={{color: '#00829a'}} />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFolderName('');
                  setParentForNew(null);
                }
              }}
              style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              style={{
                backgroundColor: !newFolderName.trim() ? '#9ca3af' : '#00829a',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (newFolderName.trim()) {
                  e.currentTarget.style.backgroundColor = '#14aab8';
                }
              }}
              onMouseLeave={(e) => {
                if (newFolderName.trim()) {
                  e.currentTarget.style.backgroundColor = '#00829a';
                }
              }}
              className="p-1.5 text-white rounded"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewFolderName('');
                setParentForNew(null);
              }}
              className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {parentForNew && (
            <p className="text-xs text-gray-600 mt-1 ml-6">
              Subcarpeta de: {carpetas.find(c => c.id === parentForNew)?.nombre}
            </p>
          )}
        </div>
      )}

      {/* Opción "Todas las facturas" */}
      <div
        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors border-l-4"
        style={{
          backgroundColor: !selectedCarpeta ? '#e0f5f7' : 'transparent',
          borderLeftColor: !selectedCarpeta ? '#00829a' : 'transparent'
        }}
        onClick={() => onSelectCarpeta(null)}
      >
        <FileText className="w-4 h-4 text-gray-600" />
        <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-gray-900">Todas las facturas</span>
      </div>

      {/* Lista de carpetas */}
      <div className="max-h-[600px] overflow-y-auto">
        {carpetas.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm text-gray-600">No hay carpetas</p>
            <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500 mt-1">Crea una carpeta para organizar tus facturas</p>
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
