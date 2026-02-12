import React, { useState, useEffect } from 'react';
import { X, Folder, Check, ChevronRight, ChevronDown, FolderOpen, Plus, Edit2, Trash2, FolderPlus } from 'lucide-react';
import { getCarpetas, asignarFacturaACarpeta, createCarpeta, updateCarpeta, deleteCarpeta, type Carpeta, type FacturaListItem, type CarpetaCreate, type CarpetaUpdate } from '../lib/api';

interface AsignarCarpetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  factura: FacturaListItem;
  onSuccess: () => void;
}

export function AsignarCarpetaModal({ isOpen, onClose, factura, onSuccess }: AsignarCarpetaModalProps) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [selectedCarpetaId, setSelectedCarpetaId] = useState<string>('');
  const [selectedCarpetaNombre, setSelectedCarpetaNombre] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para operaciones CRUD de carpetas
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newCarpetaNombre, setNewCarpetaNombre] = useState('');
  const [newCarpetaParentId, setNewCarpetaParentId] = useState<string | null>(null);
  const [editingCarpeta, setEditingCarpeta] = useState<Carpeta | null>(null);
  const [editCarpetaNombre, setEditCarpetaNombre] = useState('');
  const [editCarpetaParentId, setEditCarpetaParentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Carpeta | null>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCarpetas();
      setSelectedCarpetaId('');
      setSelectedCarpetaNombre('');
      setExpandedFolders(new Set());
    }
  }, [isOpen]);

  const loadCarpetas = async () => {
    try {
      setIsLoading(true);
      const data = await getCarpetas();
      setCarpetas(data);
    } catch (err) {
      console.error('Error loading carpetas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarpetaId) return;

    try {
      setIsSubmitting(true);
      await asignarFacturaACarpeta(factura.id, { carpeta_id: selectedCarpetaId });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al asignar carpeta';
      alert(message);
    } finally {
      setIsSubmitting(false);
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

  // Función para buscar una carpeta por ID en la jerarquía
  const findCarpetaById = (carpetas: Carpeta[], id: string): Carpeta | null => {
    for (const carpeta of carpetas) {
      if (carpeta.id === id) return carpeta;
      if (carpeta.children && carpeta.children.length > 0) {
        const found = findCarpetaById(carpeta.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleSelectCarpeta = (carpeta: Carpeta) => {
    setSelectedCarpetaId(carpeta.id);
    setSelectedCarpetaNombre(carpeta.nombre);
  };

  // Operaciones CRUD de carpetas
  const handleCreateCarpeta = async () => {
    if (!newCarpetaNombre.trim()) return;
    
    try {
      setOperationInProgress(true);
      const data: CarpetaCreate = {
        nombre: newCarpetaNombre.trim(),
        parent_id: newCarpetaParentId || undefined
      };
      await createCarpeta(data);
      await loadCarpetas();
      setShowCreateForm(false);
      setNewCarpetaNombre('');
      setNewCarpetaParentId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear carpeta';
      alert(message);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleInitiateEdit = (carpeta: Carpeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCarpeta(carpeta);
    setEditCarpetaNombre(carpeta.nombre);
    setEditCarpetaParentId(carpeta.parent_id);
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleUpdateCarpeta = async () => {
    if (!editingCarpeta || !editCarpetaNombre.trim()) return;
    
    try {
      setOperationInProgress(true);
      const data: CarpetaUpdate = {
        nombre: editCarpetaNombre.trim(),
        parent_id: editCarpetaParentId
      };
      await updateCarpeta(editingCarpeta.id, data);
      await loadCarpetas();
      setShowEditForm(false);
      setEditingCarpeta(null);
      setEditCarpetaNombre('');
      setEditCarpetaParentId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar carpeta';
      alert(message);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleInitiateDelete = (carpeta: Carpeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(carpeta);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      setOperationInProgress(true);
      await deleteCarpeta(confirmDelete.id);
      await loadCarpetas();
      setConfirmDelete(null);
      // Si se eliminó la carpeta seleccionada, limpiar selección
      if (selectedCarpetaId === confirmDelete.id) {
        setSelectedCarpetaId('');
        setSelectedCarpetaNombre('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar carpeta';
      alert(message);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleInitiateCreateSubcarpeta = (parentCarpeta: Carpeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setNewCarpetaParentId(parentCarpeta.id);
    setNewCarpetaNombre('');
    setShowCreateForm(true);
    setShowEditForm(false);
    // Expandir el padre para ver la nueva subcarpeta después de crearla
    const newExpanded = new Set(expandedFolders);
    newExpanded.add(parentCarpeta.id);
    setExpandedFolders(newExpanded);
  };

  // Obtener lista plana de carpetas para el selector de parent
  const getFlatCarpetasList = (carpetasList: Carpeta[], level: number = 0, exclude?: string): Array<{id: string, nombre: string, level: number}> => {
    let result: Array<{id: string, nombre: string, level: number}> = [];
    for (const carpeta of carpetasList) {
      if (exclude && carpeta.id === exclude) continue;
      result.push({ id: carpeta.id, nombre: carpeta.nombre, level });
      if (carpeta.children && carpeta.children.length > 0) {
        result = result.concat(getFlatCarpetasList(carpeta.children, level + 1, exclude));
      }
    }
    return result;
  };

  const renderCarpeta = (carpeta: Carpeta, level: number = 0): React.ReactElement => {
    const isExpanded = expandedFolders.has(carpeta.id);
    const hasChildren = carpeta.children && carpeta.children.length > 0;
    const isSelected = selectedCarpetaId === carpeta.id;

    return (
      <div key={carpeta.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 transition-colors rounded-md group`}
          style={{
            paddingLeft: `${level * 20 + 12}px`,
            backgroundColor: isSelected ? 'rgba(0, 130, 154, 0.1)' : undefined,
            borderLeft: isSelected ? '4px solid #00829a' : undefined
          }}
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
          
          <div
            className="flex-1 flex items-center gap-2 cursor-pointer"
            onClick={() => handleSelectCarpeta(carpeta)}
          >
            {isExpanded ? (
              <FolderOpen className="w-4 h-4" style={{color: '#00829a'}} />
            ) : (
              <Folder className="w-4 h-4" style={{color: '#00829a'}} />
            )}
            
            <span className="text-sm font-medium text-gray-900">{carpeta.nombre}</span>
          </div>

          {/* Botones de acción (solo se muestran al hacer hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleInitiateCreateSubcarpeta(carpeta, e)}
              className="p-1.5 rounded transition-colors"
              title="Crear subcarpeta"
              style={{backgroundColor: 'transparent'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FolderPlus className="w-3.5 h-3.5" style={{color: '#00829a'}} />
            </button>
            <button
              onClick={(e) => handleInitiateEdit(carpeta, e)}
              className="p-1.5 rounded transition-colors"
              title="Editar carpeta"
              style={{backgroundColor: 'transparent'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Edit2 className="w-3.5 h-3.5" style={{color: '#00829a'}} />
            </button>
            <button
              onClick={(e) => handleInitiateDelete(carpeta, e)}
              className="p-1.5 hover:bg-red-100 rounded transition-colors"
              title="Eliminar carpeta"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {carpeta.children.map((child) => renderCarpeta(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

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
            className="w-full max-w-2xl bg-white shadow-2xl rounded-lg border border-gray-200 relative" 
            style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-lg" style={{
              background: 'linear-gradient(to right, #00829a, #14aab8)'
            }}>
              <h2 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-bold text-white">Asignar a Carpeta</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-6">
              {/* Info de la factura */}
              <div className="mb-4 p-4 rounded-lg" style={{
                background: 'linear-gradient(to right, rgba(0, 130, 154, 0.08), rgba(20, 170, 184, 0.08))',
                border: '1px solid #00829a'
              }}>
                <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm text-gray-600 font-medium mb-1">Factura:</p>
                <p style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="font-mono text-lg font-bold text-gray-900">{factura.numero_factura}</p>
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-700 mt-1">{factura.proveedor}</p>
              </div>

              {/* Botón SIEMPRE VISIBLE para crear carpeta */}
              <div className="mb-6">
                <div className="rounded-xl p-1 shadow-lg" style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}}>
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md" style={{background: 'linear-gradient(to bottom right, #00829a, #14aab8)'}}>
                          <FolderPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-base font-bold text-gray-900 mb-0.5">
                            Gestión de Carpetas
                          </p>
                          <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-600">
                            Crea, edita o elimina carpetas para organizar tus facturas
                          </p>
                        </div>
                      </div>
                      {!showCreateForm && !showEditForm ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateForm(true);
                            setShowEditForm(false);
                            setNewCarpetaParentId(null);
                            setNewCarpetaNombre('');
                          }}
                          className="flex items-center gap-2 px-6 py-3 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex-shrink-0"
                          style={{
                            fontFamily: 'Neutra Text Bold, Montserrat, sans-serif',
                            background: 'linear-gradient(to right, #00829a, #14aab8)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(to right, #006b7d, #0d9488)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(to right, #00829a, #14aab8)';
                          }}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="font-bold text-base">NUEVA CARPETA</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateForm(false);
                            setShowEditForm(false);
                            setNewCarpetaNombre('');
                            setNewCarpetaParentId(null);
                            setEditingCarpeta(null);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex-shrink-0"
                          style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                        >
                          <X className="w-4 h-4" />
                          <span className="font-medium">Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selector de carpeta en cascada */}
              {!showCreateForm && !showEditForm && (
                <div className="mb-6">
                  <label style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-3">
                    Seleccionar Carpeta Existente
                  </label>
                
                {selectedCarpetaNombre && (
                  <div className="mb-3 p-3 rounded-lg flex items-center gap-2" style={{
                    backgroundColor: 'rgba(0, 130, 154, 0.1)',
                    border: '1px solid #00829a'
                  }}>
                    <Folder className="w-4 h-4" style={{color: '#00829a'}} />
                    <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a'}} className="text-sm font-medium">
                      Carpeta seleccionada: {selectedCarpetaNombre}
                    </span>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{borderColor: '#00829a'}}></div>
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto bg-white">
                    {carpetas.length === 0 ? (
                      <div className="p-8 text-center">
                        <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm text-gray-600">No hay carpetas disponibles</p>
                        <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500 mt-1">Crea una carpeta primero</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {carpetas.map((carpeta) => renderCarpeta(carpeta))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Formulario para crear nueva carpeta */}
              {showCreateForm && (
                <div className="mb-6 p-4 rounded-lg shadow-md border-2" style={{
                  background: 'linear-gradient(to bottom right, rgba(0, 130, 154, 0.05), rgba(20, 170, 184, 0.1))',
                  borderColor: '#00829a'
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor: '#00829a'}}>
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <h4 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-base font-bold text-gray-900">
                        Crear Nueva Carpeta
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewCarpetaNombre('');
                        setNewCarpetaParentId(null);
                      }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{backgroundColor: 'rgba(0, 130, 154, 0.1)'}}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="block text-sm font-semibold text-gray-700 mb-2">
                        Nombre de la carpeta *
                      </label>
                      <input
                        type="text"
                        value={newCarpetaNombre}
                        onChange={(e) => setNewCarpetaNombre(e.target.value)}
                        placeholder="Ej: Facturas 2026, Enero, Proveedores..."
                        className="w-full px-4 py-2.5 text-sm border-2 border-gray-300 rounded-lg transition-all"
                        style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#00829a';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0, 130, 154, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                        autoFocus
                      />
                    </div>
                    
                    {/* Indicador de ubicación */}
                    {newCarpetaParentId ? (
                      <div className="p-3 rounded-lg flex items-center gap-2" style={{
                        backgroundColor: 'rgba(0, 130, 154, 0.1)',
                        border: '1px solid #00829a'
                      }}>
                        <Folder className="w-4 h-4 flex-shrink-0" style={{color: '#00829a'}} />
                        <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif', color: '#00829a'}} className="text-xs">
                          Se creará como subcarpeta de: <span className="font-semibold">{findCarpetaById(carpetas, newCarpetaParentId)?.nombre || 'Carpeta desconocida'}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg flex items-center gap-2" style={{
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        border: '1px solid #9ca3af'
                      }}>
                        <Folder className="w-4 h-4 flex-shrink-0 text-gray-600" />
                        <span style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-600">
                          Se creará como carpeta principal (raíz)
                        </span>
                      </div>
                    )}
                    
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewCarpetaNombre('');
                          setNewCarpetaParentId(null);
                        }}
                        style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCarpeta}
                        disabled={!newCarpetaNombre.trim() || operationInProgress}
                        style={{
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                          backgroundColor: !newCarpetaNombre.trim() || operationInProgress ? '#9ca3af' : '#00829a'
                        }}
                        onMouseEnter={(e) => {
                          if (newCarpetaNombre.trim() && !operationInProgress) {
                            e.currentTarget.style.backgroundColor = '#14aab8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (newCarpetaNombre.trim() && !operationInProgress) {
                            e.currentTarget.style.backgroundColor = '#00829a';
                          }
                        }}
                        className="px-4 py-2 text-sm text-white rounded-lg disabled:cursor-not-allowed transition-colors font-semibold shadow-md"
                      >
                        {operationInProgress ? 'Creando...' : '✓ Crear Carpeta'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario para editar carpeta */}
              {showEditForm && editingCarpeta && (
                <div className="mb-6 p-4 rounded-lg border-2 shadow-md" style={{
                  background: 'linear-gradient(to bottom right, rgba(0, 130, 154, 0.05), rgba(20, 170, 184, 0.1))',
                  borderColor: '#00829a'
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif', color: '#00829a'}} className="text-sm font-semibold">
                      Editar Carpeta: {editingCarpeta.nombre}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditForm(false);
                        setEditingCarpeta(null);
                        setEditCarpetaNombre('');
                        setEditCarpetaParentId(null);
                      }}
                      className="p-1 rounded transition-colors"
                      style={{backgroundColor: 'rgba(0, 130, 154, 0.1)'}}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de la carpeta *
                      </label>
                      <input
                        type="text"
                        value={editCarpetaNombre}
                        onChange={(e) => setEditCarpetaNombre(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        onFocus={(e) => {
                          e.target.style.borderColor = '#00829a';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0, 130, 154, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="block text-sm font-medium text-gray-700 mb-1">
                        Carpeta padre (opcional)
                      </label>
                      <select
                        value={editCarpetaParentId || ''}
                        onChange={(e) => setEditCarpetaParentId(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        onFocus={(e) => {
                          e.target.style.borderColor = '#00829a';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0, 130, 154, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="">-- Carpeta raíz --</option>
                        {getFlatCarpetasList(carpetas, 0, editingCarpeta.id).map(c => (
                          <option key={c.id} value={c.id}>
                            {'  '.repeat(c.level) + c.nombre}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Se excluyen la carpeta actual y sus subcarpetas</p>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditForm(false);
                          setEditingCarpeta(null);
                          setEditCarpetaNombre('');
                          setEditCarpetaParentId(null);
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateCarpeta}
                        disabled={!editCarpetaNombre.trim() || operationInProgress}
                        style={{
                          fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                          backgroundColor: !editCarpetaNombre.trim() || operationInProgress ? '#9ca3af' : '#00829a'
                        }}
                        onMouseEnter={(e) => {
                          if (editCarpetaNombre.trim() && !operationInProgress) {
                            e.currentTarget.style.backgroundColor = '#14aab8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (editCarpetaNombre.trim() && !operationInProgress) {
                            e.currentTarget.style.backgroundColor = '#00829a';
                          }
                        }}
                        className="px-3 py-1.5 text-sm text-white rounded-lg disabled:cursor-not-allowed transition-colors"
                      >
                        {operationInProgress ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedCarpetaId || isSubmitting}
                  style={{
                    fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                    backgroundColor: !selectedCarpetaId || isSubmitting ? '#9ca3af' : '#00829a',
                    cursor: !selectedCarpetaId || isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCarpetaId && !isSubmitting) {
                      e.currentTarget.style.backgroundColor = '#14aab8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCarpetaId && !isSubmitting) {
                      e.currentTarget.style.backgroundColor = '#00829a';
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:hover:bg-gray-400 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Asignar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {confirmDelete && (
        <>
          <div 
            className="fixed inset-0 z-[60] backdrop-blur-lg" 
            style={{backgroundColor: 'rgba(55, 65, 81, 0.85)'}}
            onClick={() => setConfirmDelete(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-white rounded-lg shadow-2xl max-w-md w-full pointer-events-auto transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-lg font-bold text-gray-900">
                      Confirmar Eliminación
                    </h3>
                    <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-600">
                      Esta acción no se puede deshacer
                    </p>
                  </div>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-800">
                    ¿Estás seguro de que deseas eliminar la carpeta <span className="font-semibold">"{confirmDelete.nombre}"</span>?
                  </p>
                  {confirmDelete.children && confirmDelete.children.length > 0 && (
                    <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-red-700 mt-2 font-medium">
                      ⚠️ Esta carpeta contiene {confirmDelete.children.length} subcarpeta(s) que también serán eliminadas.
                    </p>
                  )}
                  {confirmDelete.facturas && confirmDelete.facturas.length > 0 && (
                    <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-red-700 mt-2 font-medium">
                      ⚠️ Esta carpeta contiene {confirmDelete.facturas.length} factura(s) que quedarán sin archivar.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    disabled={operationInProgress}
                    style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={operationInProgress}
                    style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}}
                    className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {operationInProgress ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

