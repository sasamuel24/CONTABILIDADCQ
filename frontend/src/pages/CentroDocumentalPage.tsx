import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, DollarSign, Activity, LogOut, FileBarChart, FolderInput, Download, Trash2, X, Folder } from 'lucide-react';
import { getFacturas, getAreas, deleteFactura, getUserRoleCode, type FacturaListItem, type Area, type Carpeta } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CarpetasPanel } from '../components/CarpetasPanel';
import { DirectorTrazabilidadView } from '../components/DirectorTrazabilidadView';
import { AsignarCarpetaModal } from '../components/AsignarCarpetaModal';
import { CentroDocumentalFacturaDetail } from '../components/CentroDocumentalFacturaDetail';
import { ConfirmModal } from '../components/ConfirmModal';
import { exportFacturasToExcel } from '../utils/exportToExcel';
import { toast } from 'sonner';

// Tipografía de marca
const F_BOLD = 'Neutra Text Bold, Montserrat, sans-serif';
const F_DEMI = 'Neutra Text Demi, Montserrat, sans-serif';
const F_BOOK = 'Neutra Text Book, Montserrat, sans-serif';

// Configuración visual del "Proceso Actual"
const PROCESO_CONFIG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  'Revisión':  { bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  'Pago':      { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  'Archivada': { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb', dot: '#9ca3af' },
};

// Foco de marca para inputs/selects (el snapshot de Tailwind no garantiza focus:ring)
const focusBrand = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#00829a';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,130,154,0.12)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#d1d5db';
    e.currentTarget.style.boxShadow = 'none';
  },
};

const inputBaseStyle: React.CSSProperties = {
  fontFamily: F_BOOK,
  borderColor: '#d1d5db',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  outline: 'none',
};

export function CentroDocumentalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Vista activa: explorador documental de facturas o trazabilidad de legalizaciones
  const [vista, setVista] = useState<'documental' | 'trazabilidad'>('documental');

  // Estados
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedEstado, setSelectedEstado] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Carpetas
  const [selectedCarpeta, setSelectedCarpeta] = useState<Carpeta | null>(null);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [facturaToAssign, setFacturaToAssign] = useState<FacturaListItem | null>(null);

  // Detalle de factura
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);

  // Ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof FacturaListItem>('fecha_emision');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Exportación
  const [isExporting, setIsExporting] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [facturasResponse, areasData] = await Promise.all([
          getFacturas(0, 10000), // Cargar todas las facturas
          getAreas()
        ]);

        setFacturas(facturasResponse.items);
        setAreas(areasData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos';
        setError(message);
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Función de ordenamiento
  const handleSort = (column: keyof FacturaListItem) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Mapeo de estados a proceso actual
  const getProcesoActual = (estado: string): string => {
    const estadosRevision = ['Recibida', 'Pendiente', 'Asignada', 'En Curso'];
    const estadosPago = ['En Revisión Contabilidad', 'Aprobada Tesorería'];
    const estadosArchivada = ['Pagada', 'Rechazada'];

    if (estadosRevision.includes(estado)) return 'Revisión';
    if (estadosPago.includes(estado)) return 'Pago';
    if (estadosArchivada.includes(estado)) return 'Archivada';
    return 'Revisión';
  };

  // Filtrar facturas
  const filteredFacturas = facturas.filter(factura => {
    // Filtro de búsqueda
    const matchesSearch =
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase());

    // Filtro de área
    const matchesArea = selectedArea === 'Todas' || factura.area === selectedArea;

    // Filtro de estado
    const matchesEstado = selectedEstado === 'Todos' || factura.estado === selectedEstado;

    // Filtro de fecha desde
    const matchesFechaDesde = !fechaDesde || (factura.fecha_emision && new Date(factura.fecha_emision) >= new Date(fechaDesde));

    // Filtro de fecha hasta
    const matchesFechaHasta = !fechaHasta || (factura.fecha_emision && new Date(factura.fecha_emision) <= new Date(fechaHasta));

    // Filtro de carpeta
    let matchesCarpeta = true;
    if (selectedCarpeta) {
      // Obtener IDs de todas las facturas en la carpeta seleccionada y sus subcarpetas
      const getFacturaIds = (carpeta: Carpeta): string[] => {
        const ids = carpeta.facturas?.map(f => f.id) || [];
        carpeta.children?.forEach(child => {
          ids.push(...getFacturaIds(child));
        });
        return ids;
      };
      const carpetaFacturaIds = getFacturaIds(selectedCarpeta);
      matchesCarpeta = carpetaFacturaIds.includes(factura.id);
    }

    return matchesSearch && matchesArea && matchesEstado && matchesFechaDesde && matchesFechaHasta && matchesCarpeta;
  });

  // Ordenar facturas
  const sortedFacturas = [...filteredFacturas].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (sortColumn === 'fecha_emision') {
      const dateA = new Date(aValue as string).getTime();
      const dateB = new Date(bValue as string).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortColumn === 'total') {
      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    }

    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    return sortDirection === 'asc'
      ? strA.localeCompare(strB)
      : strB.localeCompare(strA);
  });

  // Paginación
  const totalPages = Math.ceil(sortedFacturas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFacturas = sortedFacturas.slice(startIndex, startIndex + itemsPerPage);

  // Reset página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedArea, selectedEstado, fechaDesde, fechaHasta, sortColumn, sortDirection, selectedCarpeta]);

  const handleAsignarCarpeta = (factura: FacturaListItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se abra el detalle al hacer clic en el botón
    setFacturaToAssign(factura);
    setShowAsignarModal(true);
  };

  const handleVerDetalle = (factura: FacturaListItem) => {
    setSelectedFactura(factura);
  };

  // Permiso de eliminar facturas: solo Radicación (fact), Dirección y Administrador
  const ROLES_PUEDEN_ELIMINAR = ['fact', 'direccion', 'admin'];
  const canDelete = ROLES_PUEDEN_ELIMINAR.includes(getUserRoleCode(user));

  // ID de la factura que se está eliminando (para deshabilitar el botón)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [facturaToDelete, setFacturaToDelete] = useState<FacturaListItem | null>(null);

  const handleEliminarClick = (factura: FacturaListItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar abrir el detalle al hacer clic
    setFacturaToDelete(factura);
  };

  const confirmarEliminarFactura = async () => {
    if (!facturaToDelete) return;
    const factura = facturaToDelete;
    setFacturaToDelete(null);
    setDeletingId(factura.id);
    try {
      await deleteFactura(factura.id);
      setFacturas(prev => prev.filter(f => f.id !== factura.id));
      toast.success(`Factura ${factura.numero_factura} eliminada correctamente`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la factura';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAsignarSuccess = async () => {
    // Recargar facturas después de asignar
    try {
      const [facturasResponse] = await Promise.all([
        getFacturas(0, 10000)
      ]);
      setFacturas(facturasResponse.items);
    } catch (err) {
      console.error('Error reloading facturas:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleExportExcel = () => {
    if (sortedFacturas.length === 0) return;
    setIsExporting(true);
    try {
      let nombre = 'informe_facturas';
      if (selectedCarpeta) nombre += `_${selectedCarpeta.nombre.replace(/\s+/g, '_')}`;
      if (selectedArea !== 'Todas') nombre += `_${selectedArea.replace(/\s+/g, '_')}`;
      if (selectedEstado !== 'Todos') nombre += `_${selectedEstado.replace(/\s+/g, '_')}`;
      exportFacturasToExcel(sortedFacturas, nombre);
    } finally {
      setIsExporting(false);
    }
  };

  // Estados únicos de las facturas
  const estadosUnicos = Array.from(new Set(facturas.map(f => f.estado))).sort();

  const hayFiltrosActivos = Boolean(searchQuery || selectedArea !== 'Todas' || selectedEstado !== 'Todos' || fechaDesde || fechaHasta);

  const limpiarFiltros = () => {
    setSearchQuery('');
    setSelectedArea('Todas');
    setSelectedEstado('Todos');
    setFechaDesde('');
    setFechaHasta('');
  };

  // Indicadores sobre el conjunto filtrado
  const valorTotalFiltrado = sortedFacturas.reduce((acc, f) => acc + (f.total ?? 0), 0);
  const enRevisionCount = sortedFacturas.filter(f => getProcesoActual(f.estado) === 'Revisión').length;
  const sinArchivarCount = sortedFacturas.filter(f => !f.carpeta).length;

  const KPIS = [
    { label: 'Facturas', valor: sortedFacturas.length.toLocaleString('es-CO'), Icon: FileText, bg: '#e0f5f7', color: '#00829a', hint: 'Total según filtros aplicados' },
    { label: 'Valor total', valor: `$ ${valorTotalFiltrado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, Icon: DollarSign, bg: '#f0fdf4', color: '#15803d', hint: 'Suma de las facturas visibles' },
    { label: 'En revisión', valor: enRevisionCount.toLocaleString('es-CO'), Icon: Activity, bg: '#fffbeb', color: '#b45309', hint: 'Facturas en proceso de revisión' },
    { label: 'Sin archivar', valor: sinArchivarCount.toLocaleString('es-CO'), Icon: FolderInput, bg: '#fef2f2', color: '#dc2626', hint: 'Facturas sin carpeta asignada' },
  ];

  // Iniciales del usuario para el avatar del header
  const iniciales = (user?.nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || 'DC';

  // Columnas de la tabla
  const COLUMNAS: { key?: keyof FacturaListItem; label: string; align?: 'left' | 'center' | 'right' }[] = [
    { key: 'numero_factura', label: 'N° Factura' },
    { key: 'fecha_emision', label: 'Emisión' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'area', label: 'Área' },
    { key: 'total', label: 'Total', align: 'right' },
    { label: 'Archivo', align: 'center' },
    { label: 'Proceso' },
    { label: 'Acciones', align: 'center' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f6f8fa' }}>
      {/* Header */}
      <header className="sticky top-0 z-10" style={{ background: 'linear-gradient(135deg, #006c80 0%, #00829a 45%, #14aab8 100%)', boxShadow: '0 2px 12px rgba(0,108,128,0.25)' }}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}
              >
                <FileBarChart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 style={{ fontFamily: F_BOLD, letterSpacing: '0.2px' }} className="text-xl font-bold text-white">
                  {vista === 'documental' ? 'Centro Documental' : 'Trazabilidad de Legalizaciones'}
                </h1>
                <p style={{ fontFamily: F_BOOK, opacity: 0.85, letterSpacing: '0.3px' }} className="text-xs text-white uppercase tracking-wide">
                  Dirección Contable · Café Quindío
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p style={{ fontFamily: F_DEMI }} className="text-sm font-medium text-white">{user?.nombre}</p>
                <p style={{ fontFamily: F_BOOK, opacity: 0.85 }} className="text-xs text-white">Director Contable</p>
              </div>
              <div
                className="flex items-center justify-center rounded-full text-white text-sm font-bold"
                style={{ width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', fontFamily: F_DEMI }}
                title={user?.nombre}
              >
                {iniciales}
              </div>
              <button
                onClick={handleLogout}
                style={{ transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                className="p-2 rounded-lg"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 p-6">
        {/* Selector de vista */}
        <div className="mx-auto mb-6" style={{ maxWidth: 1600 }}>
          <div
            className="flex gap-1 rounded-xl p-1 w-fit"
            style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            {[
              { value: 'documental' as const, label: 'Centro Documental', Icon: FileBarChart },
              { value: 'trazabilidad' as const, label: 'Trazabilidad Legalizaciones', Icon: Activity },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setVista(value)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: vista === value ? 'linear-gradient(135deg, #00829a, #14aab8)' : 'transparent',
                  color: vista === value ? '#ffffff' : '#6b7280',
                  boxShadow: vista === value ? '0 2px 6px rgba(0,130,154,0.35)' : 'none',
                  fontFamily: F_DEMI,
                }}
                onMouseEnter={(e) => { if (vista !== value) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={(e) => { if (vista !== value) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Vista de trazabilidad de paquetes de legalización (solo lectura) */}
        {vista === 'trazabilidad' && (
          <div className="mx-auto" style={{ maxWidth: 1600 }}>
            <DirectorTrazabilidadView />
          </div>
        )}

        {vista === 'documental' && (
        <div className="mx-auto" style={{ maxWidth: 1600 }}>
          {/* Indicadores */}
          <div className="grid gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {KPIS.map(({ label, valor, Icon, bg, color, hint }) => (
              <div
                key={label}
                title={hint}
                className="bg-white rounded-2xl p-4 flex items-center gap-3"
                style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#9ca3af', fontFamily: F_DEMI }}>{label}</p>
                  <p className="text-lg font-bold truncate" style={{ color: '#111827', fontFamily: F_BOLD }}>{valor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Panel de carpetas - 3 columnas */}
            <div className="col-span-3">
              <CarpetasPanel
                onSelectCarpeta={setSelectedCarpeta}
                selectedCarpeta={selectedCarpeta}
              />
            </div>

            {/* Contenido principal - 9 columnas */}
            <div className="col-span-9">
              {/* Filtros */}
              <div className="bg-white rounded-2xl p-5 mb-6" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 style={{ fontFamily: F_DEMI }} className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Filtros</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedCarpeta && (
                      <button
                        onClick={() => setSelectedCarpeta(null)}
                        title="Quitar filtro de carpeta"
                        className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                        style={{ backgroundColor: '#e0f5f7', border: '1px solid #b2e0e8', color: '#00829a', fontFamily: F_DEMI, transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cceef2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f5f7'}
                      >
                        <Folder className="w-3.5 h-3.5" />
                        {selectedCarpeta.nombre}
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {hayFiltrosActivos && (
                      <button
                        onClick={limpiarFiltros}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                        style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontFamily: F_DEMI, transition: 'all 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(200px, 1.8fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(230px, 1.6fr)' }}>
                  {/* Búsqueda */}
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontFamily: F_DEMI, color: '#9ca3af' }} className="block text-xs uppercase tracking-wide mb-1.5">
                      Buscar
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Número de factura o proveedor"
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                        style={inputBaseStyle}
                        {...focusBrand}
                      />
                    </div>
                  </div>

                  {/* Filtro por área */}
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontFamily: F_DEMI, color: '#9ca3af' }} className="block text-xs uppercase tracking-wide mb-1.5">
                      Área
                    </label>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ ...inputBaseStyle, color: '#374151' }}
                      {...focusBrand}
                    >
                      <option value="Todas">Todas las áreas</option>
                      {areas.map(area => (
                        <option key={area.id} value={area.nombre}>{area.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por estado */}
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontFamily: F_DEMI, color: '#9ca3af' }} className="block text-xs uppercase tracking-wide mb-1.5">
                      Estado
                    </label>
                    <select
                      value={selectedEstado}
                      onChange={(e) => setSelectedEstado(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ ...inputBaseStyle, color: '#374151' }}
                      {...focusBrand}
                    >
                      <option value="Todos">Todos los estados</option>
                      {estadosUnicos.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rango de fechas */}
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontFamily: F_DEMI, color: '#9ca3af' }} className="block text-xs uppercase tracking-wide mb-1.5">
                      Fecha emisión
                    </label>
                    <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        title="Desde"
                        className="w-full px-2 py-2 border rounded-lg text-sm"
                        style={{ ...inputBaseStyle, color: '#374151', minWidth: 0, flex: 1 }}
                        {...focusBrand}
                      />
                      <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>–</span>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        title="Hasta"
                        className="w-full px-2 py-2 border rounded-lg text-sm"
                        style={{ ...inputBaseStyle, color: '#374151', minWidth: 0, flex: 1 }}
                        {...focusBrand}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                {/* Header de la tabla con contador */}
                <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <h2 style={{ fontFamily: F_BOLD }} className="text-lg font-semibold text-gray-900">
                      Facturas
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold align-middle"
                        style={{ marginLeft: 10, backgroundColor: '#e0f5f7', color: '#00829a', border: '1px solid #b2e0e8', fontFamily: F_DEMI }}
                      >
                        {sortedFacturas.length.toLocaleString('es-CO')}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: F_BOOK }}>
                      Mostrando {sortedFacturas.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedFacturas.length)} de {sortedFacturas.length}
                    </p>
                  </div>
                  {sortedFacturas.length > 0 && (
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      style={{
                        background: isExporting ? '#9ca3af' : 'linear-gradient(135deg, #00829a, #14aab8)',
                        fontFamily: F_DEMI,
                        boxShadow: isExporting ? 'none' : '0 2px 6px rgba(0,130,154,0.3)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isExporting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,130,154,0.35)'; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isExporting ? 'none' : '0 2px 6px rgba(0,130,154,0.3)'; }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl disabled:cursor-not-allowed"
                      title="Exportar tabla actual a Excel"
                    >
                      <Download className="w-4 h-4" />
                      {isExporting ? 'Generando...' : 'Exportar Excel'}
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00829a' }}></div>
                      <p className="text-gray-500 text-sm" style={{ fontFamily: F_BOOK }}>Cargando facturas...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <p className="text-red-600 font-medium mb-2" style={{ fontFamily: F_DEMI }}>Error al cargar datos</p>
                      <p className="text-gray-500 text-sm" style={{ fontFamily: F_BOOK }}>{error}</p>
                    </div>
                  </div>
                ) : sortedFacturas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex items-center justify-center rounded-full mb-4" style={{ width: 72, height: 72, backgroundColor: '#e0f5f7' }}>
                      <FileText className="w-8 h-8" style={{ color: '#00829a' }} />
                    </div>
                    <p className="text-gray-700 font-medium" style={{ fontFamily: F_DEMI }}>No hay facturas disponibles</p>
                    <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: F_BOOK }}>Intenta ajustar los filtros de búsqueda</p>
                  </div>
                ) : (
                  <>
                    {/* Tabla */}
                    <div className="overflow-x-auto">
                      <table className="w-full" style={{ minWidth: 1000 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#00829a' }}>
                            {COLUMNAS.map(({ key, label, align }) => {
                              const sortable = Boolean(key);
                              const isActive = sortable && sortColumn === key;
                              return (
                                <th
                                  key={label}
                                  onClick={sortable ? () => handleSort(key as keyof FacturaListItem) : undefined}
                                  className={`px-4 py-3.5 text-xs font-semibold text-white whitespace-nowrap ${sortable ? 'cursor-pointer' : ''}`}
                                  style={{
                                    fontFamily: F_DEMI,
                                    letterSpacing: '0.5px',
                                    textTransform: 'uppercase',
                                    fontSize: 11,
                                    textAlign: align ?? 'left',
                                    transition: 'background-color 0.15s',
                                  }}
                                  onMouseEnter={sortable ? (e) => (e.currentTarget.style.backgroundColor = '#026e83') : undefined}
                                  onMouseLeave={sortable ? (e) => (e.currentTarget.style.backgroundColor = 'transparent') : undefined}
                                  title={sortable ? 'Ordenar por esta columna' : undefined}
                                >
                                  <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                                    <span>{label}</span>
                                    {sortable && (
                                      <span style={{ opacity: isActive ? 1 : 0.4, fontSize: 11 }}>
                                        {isActive ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedFacturas.map((factura, idx) => {
                            const proceso = getProcesoActual(factura.estado);
                            const procesoCfg = PROCESO_CONFIG[proceso] ?? PROCESO_CONFIG['Revisión'];
                            const zebra = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                            return (
                              <tr
                                key={factura.id}
                                onClick={() => handleVerDetalle(factura)}
                                className="cursor-pointer"
                                style={{ backgroundColor: zebra, borderTop: '1px solid #f3f4f6', transition: 'background-color 0.12s' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0f5f7')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = zebra)}
                              >
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span className="font-mono text-sm font-semibold" style={{ color: '#00829a' }}>
                                    {factura.numero_factura}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500" style={{ fontFamily: F_BOOK }}>
                                  {factura.fecha_emision
                                    ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                    : '-'}
                                </td>
                                <td className="px-4 py-3.5 text-sm text-gray-800" style={{ fontFamily: F_DEMI }}>
                                  <span
                                    title={factura.proveedor}
                                    style={{ display: 'block', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  >
                                    {factura.proveedor}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500" style={{ fontFamily: F_BOOK }}>
                                  {factura.area}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-right" style={{ color: '#111827', fontFamily: F_DEMI }}>
                                  ${factura.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                  <span
                                    title={factura.carpeta ? `Archivado en: ${factura.carpeta.nombre}` : 'Sin archivar'}
                                    className="inline-flex items-center justify-center rounded-full"
                                    style={{
                                      width: 28,
                                      height: 28,
                                      backgroundColor: factura.carpeta ? '#e0f5f7' : '#fef2f2',
                                      border: `1px solid ${factura.carpeta ? '#b2e0e8' : '#fecaca'}`,
                                    }}
                                  >
                                    {factura.carpeta
                                      ? <Folder className="w-3.5 h-3.5" style={{ color: '#00829a' }} />
                                      : <FolderInput className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: procesoCfg.bg, color: procesoCfg.color, border: `1px solid ${procesoCfg.border}`, fontFamily: F_DEMI }}
                                  >
                                    <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: procesoCfg.dot }} />
                                    {proceso}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={(e) => handleAsignarCarpeta(factura, e)}
                                      style={{
                                        width: 30,
                                        height: 30,
                                        backgroundColor: '#e0f5f7',
                                        color: '#00829a',
                                        border: '1px solid #b2e0e8',
                                        transition: 'background-color 0.15s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cceef2'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f5f7'}
                                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                                      title="Asignar a carpeta"
                                    >
                                      <FolderInput className="w-4 h-4" />
                                    </button>
                                    {canDelete && (
                                      <button
                                        onClick={(e) => handleEliminarClick(factura, e)}
                                        disabled={deletingId === factura.id}
                                        style={{
                                          width: 30,
                                          height: 30,
                                          backgroundColor: '#fef2f2',
                                          color: '#dc2626',
                                          border: '1px solid #fecaca',
                                          transition: 'background-color 0.15s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                                        className="flex items-center justify-center rounded-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Eliminar factura"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                      <div className="px-6 py-3.5 flex items-center justify-between" style={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#fafbfc' }}>
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg disabled:cursor-not-allowed"
                          style={{
                            fontFamily: F_DEMI,
                            backgroundColor: '#fff',
                            border: '1px solid #d1d5db',
                            color: currentPage === 1 ? '#d1d5db' : '#374151',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                          onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.borderColor = '#00829a'; e.currentTarget.style.color = '#00829a'; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = currentPage === 1 ? '#d1d5db' : '#374151'; }}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </button>
                        <span className="text-sm text-gray-500" style={{ fontFamily: F_BOOK }}>
                          Página <span className="font-semibold" style={{ color: '#00829a', fontFamily: F_DEMI }}>{currentPage}</span> de <span className="font-semibold" style={{ fontFamily: F_DEMI }}>{totalPages}</span>
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg disabled:cursor-not-allowed"
                          style={{
                            fontFamily: F_DEMI,
                            backgroundColor: '#fff',
                            border: '1px solid #d1d5db',
                            color: currentPage === totalPages ? '#d1d5db' : '#374151',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                          onMouseEnter={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.borderColor = '#00829a'; e.currentTarget.style.color = '#00829a'; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = currentPage === totalPages ? '#d1d5db' : '#374151'; }}
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* Modal de asignar carpeta */}
      {showAsignarModal && facturaToAssign && (
        <AsignarCarpetaModal
          isOpen={showAsignarModal}
          onClose={() => {
            setShowAsignarModal(false);
            setFacturaToAssign(null);
          }}
          factura={facturaToAssign}
          onSuccess={handleAsignarSuccess}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={!!facturaToDelete}
        onClose={() => setFacturaToDelete(null)}
        onConfirm={confirmarEliminarFactura}
        type="warning"
        title="Eliminar factura"
        message={
          facturaToDelete
            ? `¿Eliminar la factura ${facturaToDelete.numero_factura} de ${facturaToDelete.proveedor}?\n\nEsta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        showCancel
      />

      {/* Modal de detalle de factura */}
      {selectedFactura && (
        <CentroDocumentalFacturaDetail
          factura={selectedFactura}
          onClose={() => setSelectedFactura(null)}
          onDelete={(id) => setFacturas(prev => prev.filter(f => f.id !== id))}
          onReasignada={async () => {
            try {
              const facturasResponse = await getFacturas(0, 10000);
              setFacturas(facturasResponse.items);
              const actualizada = facturasResponse.items.find(f => f.id === selectedFactura.id);
              if (actualizada) setSelectedFactura(actualizada);
            } catch (err) {
              console.error('Error reloading facturas tras reasignación:', err);
            }
          }}
        />
      )}
    </div>
  );
}
