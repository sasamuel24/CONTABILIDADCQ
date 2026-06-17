import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, MoreVertical, LayoutDashboard, Inbox, LogOut, PackageOpen, Users, FileCode2, Banknote, Menu, X, Trash2 } from 'lucide-react';
import { InboxView } from './InboxView';
import { ResponsablePaquetesView } from './ResponsablePaquetesView';
import { AdminUsuariosView } from './AdminUsuariosView';
import { BuzonXMLView } from './BuzonXMLView';
import { getDashboardMetrics, getAreas, getFacturas, getFacturasAreaCounts, deleteFactura, getUserRoleCode, DashboardMetrics, Area, AreaCount, FacturaListItem } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';

interface DashboardProps {
  userName: string;
  onLogout: () => void;
}

interface AreaWithCount extends Area {
  count: number;
}

export function Dashboard({ userName, onLogout }: DashboardProps) {
  const { user } = useAuth();
  // Permiso de eliminar facturas: solo Radicación (fact), Dirección y Administrador
  const canDelete = ['fact', 'direccion', 'admin'].includes(getUserRoleCode(user));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [facturaToDelete, setFacturaToDelete] = useState<FacturaListItem | null>(null);

  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [enDetallePaquetes, setEnDetallePaquetes] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const openDrawer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDrawerMounted(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    closeTimer.current = setTimeout(() => setDrawerMounted(false), 300);
  };

  // Estados para datos del backend
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [areas, setAreas] = useState<AreaWithCount[]>([]);
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [totalFacturas, setTotalFacturas] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEliminarClick = (factura: FacturaListItem, e: React.MouseEvent) => {
    e.stopPropagation();
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
      setTotalFacturas(prev => Math.max(0, prev - 1));
      toast.success(`Factura ${factura.numero_factura} eliminada correctamente`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la factura';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalFacturas / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Carga única: métricas + áreas
  useEffect(() => {
    if (activeSection !== 'dashboard') return;
    const loadStaticData = async () => {
      setIsLoading(true); setError(null);
      try {
        const [metricsData, areasData, areaCounts] = await Promise.all([
          getDashboardMetrics(), getAreas(), getFacturasAreaCounts(),
        ]);
        setMetrics(metricsData);
        setAreas(areasData.map((area: Area) => ({
          ...area,
          count: areaCounts.find((c: AreaCount) => c.area_id === area.id)?.count || 0,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard');
      } finally { setIsLoading(false); }
    };
    loadStaticData();
  }, [activeSection]);

  // Carga paginada
  useEffect(() => {
    if (activeSection !== 'dashboard') return;
    const loadFacturas = async () => {
      setIsLoadingTable(true);
      try {
        const resp = await getFacturas(
          (currentPage - 1) * itemsPerPage, itemsPerPage,
          selectedAreaId, undefined, debouncedSearch || undefined
        );
        setFacturas(resp.items); setTotalFacturas(resp.total);
      } catch (err) { console.error('Error cargando facturas:', err); }
      finally { setIsLoadingTable(false); }
    };
    loadFacturas();
  }, [currentPage, selectedAreaId, debouncedSearch, activeSection]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Limpia timer al desmontar
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const goTo = (id: string) => {
    setActiveSection(id);
    if (id === 'paquetes' || id === 'anticipos') setEnDetallePaquetes(false);
    closeDrawer();
  };

  const totalAllFacturas = areas.reduce((sum, a) => sum + a.count, 0);

  const estadoConfig = {
    'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
    'En proceso': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
    'Bloqueado': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
    'Finalizado': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
    'Asignada': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
    'En Curso': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
    'Pagada': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  } as Record<string, { color: string; bgColor: string }>;

  const NAV_MOBILE = [
    { id: 'dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
    { id: 'inbox',     label: 'Inbox',       Icon: Inbox           },
    { id: 'paquetes',  label: 'Paquetes',    Icon: PackageOpen     },
    { id: 'anticipos', label: 'Anticipos',   Icon: Banknote        },
  ];

  // Sidebar interior — compartido entre desktop y drawer
  const sidebarInner = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div className="h-10 rounded-lg flex items-center justify-center px-4 flex-1" style={{ backgroundColor: '#00829a' }}>
          <span className="text-white font-bold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>DocuFlow</span>
        </div>
        <button
          className="ml-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          onClick={() => setDrawerOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {[
          { id: 'dashboard', label: 'Dashboard',      Icon: LayoutDashboard },
          { id: 'inbox',     label: 'Inbox',          Icon: Inbox           },
          { id: 'paquetes',  label: 'Paquetes de Gastos', Icon: PackageOpen },
          { id: 'anticipos', label: 'Anticipos',      Icon: Banknote        },
          { id: 'usuarios',  label: 'Usuarios',       Icon: Users           },
          { id: 'buzon-xml', label: 'Buzón XML',      Icon: FileCode2       },
        ].map(({ id, label, Icon }) => {
          const activo = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => goTo(id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2"
              style={{
                backgroundColor: activo ? 'rgba(20, 170, 184, 0.1)' : 'transparent',
                color: activo ? '#00829a' : '#374151',
                fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => { if (!activo) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { if (!activo) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
          style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </nav>
    </>
  );

  return (
    <>
      {/* Portal: overlay + drawer fuera del contenedor overflow:hidden */}
      {drawerMounted && createPortal(
        <>
          {/* Overlay */}
          <div
            onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', opacity: drawerOpen ? 1 : 0, transition: 'opacity 0.28s ease' }}
          />
          {/* Panel */}
          <aside
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, zIndex: 9999,
              background: '#fff', boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {sidebarInner}
          </aside>
        </>,
        document.body
      )}

      <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ════════ ÁREA PRINCIPAL ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header — siempre visible */}
        <header
          className="flex items-center gap-3 px-4 bg-white border-b border-gray-200 flex-shrink-0"
          style={{ height: 56 }}
        >
          <button onClick={openDrawer} className="p-2 -ml-1 rounded-xl text-gray-500 active:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="h-8 px-3 rounded-lg flex items-center" style={{ backgroundColor: '#00829a' }}>
            <span className="text-white text-sm font-bold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>DocuFlow</span>
          </div>
          <span className="flex-1 text-sm font-semibold text-gray-700 truncate" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
            Bienvenid@n, {userName} 👋
          </span>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeSection === 'buzon-xml' ? (
            <BuzonXMLView />
          ) : activeSection === 'usuarios' ? (
            <AdminUsuariosView />
          ) : activeSection === 'anticipos' ? (
            <div className={enDetallePaquetes ? 'p-4' : 'p-4 md:p-8'}>
              {!enDetallePaquetes && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>Anticipos</h2>
                  <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Audita y envía a Tesorería los paquetes de anticipo aprobados</p>
                </div>
              )}
              <ResponsablePaquetesView soloAnticipos onVistaChange={(v) => setEnDetallePaquetes(v === 'detalle')} />
            </div>
          ) : activeSection === 'paquetes' ? (
            <div className={enDetallePaquetes ? 'p-4' : 'p-4 md:p-8'}>
              {!enDetallePaquetes && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>Paquetes de Gastos</h2>
                  <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Revisa, aprueba o devuelve los paquetes enviados por los técnicos</p>
                </div>
              )}
              <ResponsablePaquetesView onVistaChange={(v) => setEnDetallePaquetes(v === 'detalle')} />
            </div>
          ) : activeSection === 'inbox' ? (
            <div className="px-4 md:px-8 py-4 md:py-6">
              <InboxView />
            </div>
          ) : (
            <>
              <div className="px-4 md:px-8 py-4 md:py-6">
                {/* Métricas */}
                <div className="mb-6 md:mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-gray-900" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>Métricas generales</h2>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">{error}</div>
                  ) : metrics ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow text-center">
                        <p className="text-gray-600 mb-2 text-xs md:text-sm">Total Facturas</p>
                        <p className="text-gray-900 text-2xl md:text-3xl font-bold">{metrics.recibidas}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow text-center">
                        <p className="text-gray-600 mb-2 text-xs md:text-sm">Asignadas</p>
                        <p className="text-gray-900 text-2xl md:text-3xl font-bold">{metrics.asignadas}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow text-center">
                        <p className="text-gray-600 mb-2 text-xs md:text-sm">Pagadas</p>
                        <p className="text-gray-900 text-2xl md:text-3xl font-bold">{metrics.cerradas}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow text-center">
                        <p className="text-gray-600 mb-2 text-xs md:text-sm">Pendientes</p>
                        <p className="text-gray-900 text-2xl md:text-3xl font-bold">{metrics.pendientes}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Tabla facturas */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 md:p-6">
                    <h2 className="text-gray-900 mb-4" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>Seguimiento de Facturas por Áreas</h2>
                    <div className="mb-4 md:mb-6 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar por número de factura, proveedor o responsable..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 md:pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                        style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                        onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
                        onBlur={(e) => e.target.style.boxShadow = ''}
                      />
                    </div>

                    {/* Chips de área — solo móvil */}
                    <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-1">
                      {[{ id: undefined as string | undefined, nombre: 'Todas', count: totalAllFacturas }, ...areas].map(area => (
                        <button
                          key={area.nombre}
                          onClick={() => { setSelectedArea(area.nombre); setSelectedAreaId(area.id); setCurrentPage(1); }}
                          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap"
                          style={{
                            backgroundColor: selectedArea === area.nombre ? '#00829a' : '#fff',
                            color: selectedArea === area.nombre ? '#fff' : '#6b7280',
                            borderColor: selectedArea === area.nombre ? '#00829a' : '#e5e7eb',
                          }}
                        >
                          {area.nombre} ({area.count})
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Áreas — solo desktop */}
                      <div className="hidden lg:block lg:col-span-1">
                        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                          <style>{`.areas-scrollbar::-webkit-scrollbar{width:6px}.areas-scrollbar::-webkit-scrollbar-track{background:#f3f4f6}.areas-scrollbar::-webkit-scrollbar-thumb{background:#14aab8;border-radius:10px}.areas-scrollbar::-webkit-scrollbar-thumb:hover{background:#00829a}`}</style>
                          <div className="areas-scrollbar p-3" style={{ maxHeight: '560px', overflowY: 'scroll' }}>
                            <button
                              onClick={() => { setSelectedArea('Todas'); setSelectedAreaId(undefined); setCurrentPage(1); }}
                              className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-4"
                              style={{ backgroundColor: selectedArea === 'Todas' ? 'rgba(20,170,184,0.1)' : 'transparent', color: selectedArea === 'Todas' ? '#00829a' : '#374151', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                              onMouseEnter={(e) => { if (selectedArea !== 'Todas') e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                              onMouseLeave={(e) => { if (selectedArea !== 'Todas') e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div className="flex items-center justify-between">
                                <span>Todas las áreas</span>
                                <span className="text-gray-500">{totalAllFacturas}</span>
                              </div>
                            </button>
                            <p className="px-3 mb-2 text-gray-600 text-sm font-medium">ÁREAS</p>
                            {areas.map((area) => (
                              <button
                                key={area.id}
                                onClick={() => { setSelectedArea(area.nombre); setSelectedAreaId(area.id); setCurrentPage(1); }}
                                className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1"
                                style={{ backgroundColor: selectedArea === area.nombre ? 'rgba(20,170,184,0.1)' : 'transparent', color: selectedArea === area.nombre ? '#00829a' : '#374151', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                                onMouseEnter={(e) => { if (selectedArea !== area.nombre) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                onMouseLeave={(e) => { if (selectedArea !== area.nombre) e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{area.nombre}</span>
                                  <span className="text-gray-500">{area.count}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tabla */}
                      <div className="lg:col-span-3">
                        <div className="border border-gray-200 rounded-lg bg-white flex flex-col" style={{ height: '560px' }}>
                          <div className="overflow-auto flex-1">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                  <th className="text-left px-3 md:px-4 py-3 text-gray-600">N° Factura</th>
                                  <th className="text-left px-3 md:px-4 py-3 text-gray-600">Proveedor</th>
                                  <th className="hidden md:table-cell text-left px-4 py-3 text-gray-600">Área</th>
                                  <th className="text-right px-3 md:px-4 py-3 text-gray-600">Total</th>
                                  <th className="text-left px-3 md:px-4 py-3 text-gray-600">Estado</th>
                                  {canDelete && <th className="text-center px-3 md:px-4 py-3 text-gray-600">Acciones</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {(isLoading || isLoadingTable) ? (
                                  Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                      <td className="px-3 md:px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                                      <td className="px-3 md:px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                      <td className="hidden md:table-cell px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                      <td className="px-3 md:px-4 py-3 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                      <td className="px-3 md:px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                                      {canDelete && <td className="px-3 md:px-4 py-3"><div className="h-6 bg-gray-200 rounded w-20 mx-auto"></div></td>}
                                    </tr>
                                  ))
                                ) : (
                                  facturas.map((factura) => (
                                    <tr key={factura.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-3 md:px-4 py-3">
                                        <span className="font-mono text-gray-900 text-xs md:text-sm">{factura.numero_factura}</span>
                                      </td>
                                      <td className="px-3 md:px-4 py-3">
                                        <span className="text-gray-900 text-xs md:text-sm">{factura.proveedor}</span>
                                      </td>
                                      <td className="hidden md:table-cell px-4 py-3">
                                        <span className="text-gray-700">{factura.area}</span>
                                      </td>
                                      <td className="px-3 md:px-4 py-3 text-right">
                                        <span className="text-gray-900 text-xs md:text-sm whitespace-nowrap">
                                          ${factura.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </td>
                                      <td className="px-3 md:px-4 py-3">
                                        <span className={`px-2 md:px-3 py-1 rounded-full border text-xs md:text-sm ${estadoConfig[factura.estado]?.bgColor || 'bg-gray-100'} ${estadoConfig[factura.estado]?.color || 'text-gray-700'}`}>
                                          {factura.estado}
                                        </span>
                                      </td>
                                      {canDelete && (
                                        <td className="px-3 md:px-4 py-3 text-center">
                                          <button
                                            onClick={(e) => handleEliminarClick(factura, e)}
                                            disabled={deletingId === factura.id}
                                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            title="Eliminar factura"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span>{deletingId === factura.id ? 'Eliminando…' : 'Eliminar'}</span>
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                            {!isLoading && !isLoadingTable && facturas.length === 0 && (
                              <div className="text-center py-12 text-gray-500">No se encontraron facturas</div>
                            )}
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
                              <p className="text-gray-600 text-xs md:text-sm hidden md:block">
                                Mostrando {startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalFacturas)} de {totalFacturas} facturas
                              </p>
                              <p className="text-gray-600 text-xs md:hidden">Pág. {currentPage}/{totalPages}</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                  disabled={currentPage === 1}
                                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs md:text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                  style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                                >
                                  Anterior
                                </button>
                                <span className="text-gray-600 text-xs hidden md:block" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                                  Página {currentPage} de {totalPages}
                                </span>
                                <button
                                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={currentPage === totalPages}
                                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs md:text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                  style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                                >
                                  Siguiente
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* ════════ MOBILE BOTTOM NAV ══════════════════════════════════════ */}
        <nav
          className="md:hidden flex items-stretch bg-white border-t border-gray-200 flex-shrink-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {NAV_MOBILE.map(({ id, label, Icon }) => {
            const activo = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => goTo(id)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
                style={{ color: activo ? '#00829a' : '#9ca3af' }}
              >
                <span
                  className="p-1 rounded-lg"
                  style={{ backgroundColor: activo ? 'rgba(0,130,154,0.1)' : 'transparent' }}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-semibold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                  {label}
                </span>
              </button>
            );
          })}
          <button
            onClick={openDrawer}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400"
          >
            <span className="p-1 rounded-lg"><Menu className="w-5 h-5" /></span>
            <span className="text-[10px] font-semibold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>Más</span>
          </button>
        </nav>

      </div>

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
    </div>
    </>
  );
}
