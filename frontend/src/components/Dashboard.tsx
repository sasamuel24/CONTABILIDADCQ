import { useState, useEffect } from 'react';
import { Search, ChevronDown, TrendingUp, TrendingDown, MoreVertical, Reply, Circle, LayoutDashboard, Inbox, LogOut } from 'lucide-react';
import { InboxView } from './InboxView';
import { getDashboardMetrics, getAreas, getFacturas, DashboardMetrics, Area, FacturaListItem } from '../lib/api';

interface DashboardProps {
  userName: string;
  onLogout: () => void;
}

interface AreaWithCount extends Area {
  count: number;
}

const statusList = [
  { label: 'Willing to meet', count: 0, color: 'bg-green-500' },
  { label: 'Follow-up question', count: 1, color: 'bg-blue-500' },
  { label: 'Referred to other person', count: 0, color: 'bg-purple-500' },
  { label: 'Out of office', count: 0, color: 'bg-yellow-500' },
  { label: 'Not the right person', count: 0, color: 'bg-orange-500' },
  { label: 'Not interested', count: 0, color: 'bg-red-500' },
  { label: 'Unsubscribed', count: 0, color: 'bg-gray-500' },
];

export function Dashboard({ userName, onLogout }: DashboardProps) {
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  
  // Estados para datos del backend
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [areas, setAreas] = useState<AreaWithCount[]>([]);
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos del backend
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [metricsData, areasData, facturasResponse] = await Promise.all([
          getDashboardMetrics(),
          getAreas(),
          getFacturas(0, 1000), // Cargar todas las facturas
        ]);

        setMetrics(metricsData);
        const facturasData = facturasResponse.items;
        setFacturas(facturasData);

        // Contar facturas por área
        const areaCounts = facturasData.reduce((acc, factura) => {
          acc[factura.area] = (acc[factura.area] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const areasWithCount = areasData.map(area => ({
          ...area,
          count: areaCounts[area.nombre] || 0,
        }));

        setAreas(areasWithCount);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos del dashboard';
        setError(message);
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeSection === 'dashboard') {
      loadDashboardData();
    }
  }, [activeSection]);

  // Filtrar facturas
  const filteredFacturas = facturas.filter(factura => {
    const matchesArea = selectedArea === 'Todas' || factura.area === selectedArea;
    const matchesSearch = 
      factura.numero_factura.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesArea && matchesSearch;
  });

  // Paginación local (frontend-side)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredFacturas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFacturas = filteredFacturas.slice(startIndex, startIndex + itemsPerPage);

  // Reset página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedArea, searchQuery]);

  const estadoConfig = {
    'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
    'En proceso': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
    'Bloqueado': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
    'Finalizado': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
    'Asignada': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
    'En Curso': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
    'Cerrada': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  } as Record<string, { color: string; bgColor: string }>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white">R</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
              activeSection === 'dashboard'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSection('inbox')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === 'inbox'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Inbox className="w-5 h-5" />
            <span>Inbox</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-gray-900">
              Welcome, {userName} 👋
            </h1>
            <div className="flex items-center gap-3">
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-8 py-6 flex-1 overflow-auto">
          {activeSection === 'inbox' ? (
            <InboxView />
          ) : (
            <>
              {/* Email Stats Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-gray-900">Your email stats</h2>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded">
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">
                    {error}
                  </div>
                ) : metrics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow text-center">
                      <p className="text-gray-600 mb-3">Total Facturas</p>
                      <p className="text-gray-900">{metrics.recibidas}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow text-center">
                      <p className="text-gray-600 mb-3">Facturas Asignadas</p>
                      <p className="text-gray-900">{metrics.asignadas}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow text-center">
                      <p className="text-gray-600 mb-3">Facturas Cerradas</p>
                      <p className="text-gray-900">{metrics.cerradas}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow text-center">
                      <p className="text-gray-600 mb-3">Facturas Pendientes</p>
                      <p className="text-gray-900">{metrics.pendientes}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Recent Replies Section */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-6">
                  <h2 className="text-gray-900 mb-4">Seguimiento de Facturas por Áreas</h2>

                  {/* Search Bar */}
                  <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por número de factura, proveedor o responsable..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Areas Sidebar */}
                    <div className="lg:col-span-1">
                      <div className="mb-4">
                        <button
                          onClick={() => {
                            setSelectedArea('Todas');
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            selectedArea === 'Todas'
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>Todas las áreas</span>
                            <span className="text-gray-500">{facturas.length}</span>
                          </div>
                        </button>
                      </div>

                      <div>
                        <p className="px-3 mb-2 text-gray-600">ÁREAS</p>
                        {areas.map((area) => (
                          <button
                            key={area.id}
                            onClick={() => {
                              setSelectedArea(area.nombre);
                              setCurrentPage(1);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors mb-1 ${
                              selectedArea === area.nombre
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{area.nombre}</span>
                              <span className="text-gray-500">{area.count}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Facturas Table */}
                    <div className="lg:col-span-3">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-4 py-3 text-gray-600">
                                N° Factura
                              </th>
                              <th className="text-left px-4 py-3 text-gray-600">
                                Proveedor
                              </th>
                              <th className="text-left px-4 py-3 text-gray-600">
                                Área
                              </th>
                              <th className="text-right px-4 py-3 text-gray-600">
                                Total
                              </th>
                              <th className="text-left px-4 py-3 text-gray-600">
                                Estado
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {isLoading ? (
                              // Loading skeleton
                              Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                  <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                                  <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                                </tr>
                              ))
                            ) : (
                              paginatedFacturas.map((factura) => (
                                <tr key={factura.numero_factura} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <span className="font-mono text-gray-900">{factura.numero_factura}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-gray-900">{factura.proveedor}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-gray-700">{factura.area}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="text-gray-900">
                                      ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-3 py-1 rounded-full border text-sm ${estadoConfig[factura.estado]?.bgColor || 'bg-gray-100'} ${estadoConfig[factura.estado]?.color || 'text-gray-700'}`}>
                                      {factura.estado}
                                    </span>
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

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                          <p className="text-gray-600">
                            Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredFacturas.length)} de {filteredFacturas.length} facturas
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <span className="text-gray-600">
                              Página {currentPage} de {totalPages}
                            </span>
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}