import { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Edit2, X, Check } from 'lucide-react';
import type { ComentarioFactura } from '../lib/api';
import { 
  getComentariosByFactura, 
  createComentario, 
  updateComentario, 
  deleteComentario,
  type ComentarioCreate,
  type ComentarioUpdate 
} from '../lib/api';

interface ComentariosFacturaProps {
  facturaId: string;
  currentUserId: string;
}

export function ComentariosFactura({ facturaId, currentUserId }: ComentariosFacturaProps) {
  const [comentarios, setComentarios] = useState<ComentarioFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContenido, setEditingContenido] = useState('');

  // Cargar comentarios al montar el componente
  useEffect(() => {
    loadComentarios();
  }, [facturaId]);

  const loadComentarios = async () => {
    try {
      setLoading(true);
      const response = await getComentariosByFactura(facturaId);
      setComentarios(response.comentarios);
    } catch (error) {
      console.error('Error cargando comentarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || submitting) return;

    try {
      setSubmitting(true);
      const data: ComentarioCreate = { contenido: nuevoComentario.trim() };
      const comentario = await createComentario(facturaId, data);
      setComentarios([comentario, ...comentarios]);
      setNuevoComentario('');
    } catch (error) {
      console.error('Error creando comentario:', error);
      alert('Error al crear el comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (comentario: ComentarioFactura) => {
    setEditingId(comentario.id);
    setEditingContenido(comentario.contenido);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContenido('');
  };

  const handleSaveEdit = async (comentarioId: string) => {
    if (!editingContenido.trim()) return;

    try {
      const data: ComentarioUpdate = { contenido: editingContenido.trim() };
      const updated = await updateComentario(comentarioId, data);
      setComentarios(
        comentarios.map(c => (c.id === comentarioId ? updated : c))
      );
      setEditingId(null);
      setEditingContenido('');
    } catch (error) {
      console.error('Error actualizando comentario:', error);
      alert('Error al actualizar el comentario');
    }
  };

  const handleDeleteComentario = async (comentarioId: string) => {
    if (!confirm('¿Estás seguro de eliminar este comentario?')) return;

    try {
      await deleteComentario(comentarioId);
      setComentarios(comentarios.filter(c => c.id !== comentarioId));
    } catch (error) {
      console.error('Error eliminando comentario:', error);
      alert('Error al eliminar el comentario');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'Hace un momento' : `Hace ${minutes} minutos`;
      }
      return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
    }
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <MessageSquare className="w-5 h-5 text-[#00829a]" />
        <h4 className="text-lg font-semibold text-gray-900">
          Comentarios ({comentarios.length})
        </h4>
      </div>

      {/* Formulario para nuevo comentario */}
      <form onSubmit={handleSubmitComentario} className="space-y-3 bg-white">
        <div>
          <textarea
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            placeholder="Escribe un comentario..."
            className="w-full min-h-[80px] px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00829a] focus:border-transparent resize-none"
            disabled={submitting}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!nuevoComentario.trim() || submitting}
            style={{
              fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
              backgroundColor: !nuevoComentario.trim() || submitting ? '#9CA3AF' : '#00829a'
            }}
            onMouseEnter={(e) => {
              if (!(!nuevoComentario.trim() || submitting)) {
                e.currentTarget.style.backgroundColor = '#14aab8';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!nuevoComentario.trim() || submitting)) {
                e.currentTarget.style.backgroundColor = '#00829a';
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium transition-all shadow-sm disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Enviando...' : 'Comentar'}
          </button>
        </div>
      </form>

      {/* Lista de comentarios */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Cargando comentarios...
          </div>
        ) : comentarios.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay comentarios aún. ¡Sé el primero en comentar!
          </div>
        ) : (
          comentarios.map((comentario) => (
            <div
              key={comentario.id}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              {/* Header del comentario */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {comentario.user.nombre}
                    </span>
                    <span className="text-xs text-gray-500">
                      {comentario.user.email}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(comentario.created_at)}
                    {comentario.created_at !== comentario.updated_at && (
                      <span className="ml-2 italic">(editado)</span>
                    )}
                  </div>
                </div>

                {/* Acciones (solo si es el autor) */}
                {comentario.user_id === currentUserId && !editingId && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartEdit(comentario)}
                      className="p-1 text-gray-500 hover:text-[#00829a] transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteComentario(comentario.id)}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Contenido del comentario */}
              {editingId === comentario.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingContenido}
                    onChange={(e) => setEditingContenido(e.target.value)}
                    className="w-full min-h-[60px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00829a] focus:border-transparent resize-none text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comentario.id)}
                      disabled={!editingContenido.trim()}
                      style={{
                        fontFamily: 'Neutra Text Book, Montserrat, sans-serif',
                        backgroundColor: !editingContenido.trim() ? '#9CA3AF' : '#00829a'
                      }}
                      onMouseEnter={(e) => {
                        if (editingContenido.trim()) {
                          e.currentTarget.style.backgroundColor = '#14aab8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (editingContenido.trim()) {
                          e.currentTarget.style.backgroundColor = '#00829a';
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded transition-colors disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-700 whitespace-pre-wrap">
                  {comentario.contenido}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
