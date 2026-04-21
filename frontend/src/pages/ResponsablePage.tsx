import { useState } from 'react';
import { Inbox, LogOut, PackageOpen, UploadCloud, FolderInput } from 'lucide-react';
import { InboxView } from '../components/InboxView';
import { ResponsablePaquetesView } from '../components/ResponsablePaquetesView';
import { GastosAdminSubidaView } from '../components/GastosAdminSubidaView';
import { GastosAdminTrazabilidadView } from '../components/GastosAdminTrazabilidadView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type Seccion = 'bandeja' | 'paquetes' | 'subida' | 'trazabilidad';

export function ResponsablePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>('bandeja');
  const [enDetalle, setEnDetalle] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const esMant = user?.area?.code === 'mant';
  const esGadmin = user?.area?.code === 'GADMIN';

  const NAV: { id: Seccion; label: string; icon: React.ReactNode }[] = [
    { id: 'bandeja',  label: 'Bandeja de Entrada',  icon: <Inbox className="w-5 h-5" /> },
    ...(esMant ? [{ id: 'paquetes' as Seccion, label: 'Paquetes de Gastos', icon: <PackageOpen className="w-5 h-5" /> }] : []),
    ...(esGadmin ? [
      { id: 'subida' as Seccion, label: 'Subida Manual de Facturas', icon: <UploadCloud className="w-5 h-5" /> },
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <h1
            className="text-xl font-bold text-gray-900"
            style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
          >
            {user?.area?.nombre || 'CONTABILIDAD CQ'}
          </h1>
          <p
            className="text-sm text-gray-500 mt-1"
            style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
          >
            Responsable de Área
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => {
            const activo = seccion === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSeccion(item.id); setEnDetalle(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-all"
                style={{
                  color: activo ? '#00829a' : '#6b7280',
                  backgroundColor: activo ? 'rgba(20, 170, 184, 0.1)' : 'transparent',
                  fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{
                  backgroundColor: '#00829a',
                  fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                }}
              >
                {user?.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-gray-900 truncate"
                  style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                >
                  {user?.nombre}
                </p>
                <p
                  className="text-xs text-gray-500 truncate"
                  style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                >
                  {user?.area?.nombre}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 rounded-lg"
              style={{ transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#00829a';
                e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {seccion === 'bandeja' && <InboxView />}
        {seccion === 'subida' && esGadmin && <GastosAdminSubidaView />}
        {seccion === 'trazabilidad' && esGadmin && <GastosAdminTrazabilidadView />}
        {seccion === 'paquetes' && esMant && (
          <div className={enDetalle ? 'p-4' : 'p-8'}>
            {!enDetalle && (
              <div className="mb-6">
                <h2
                  className="text-2xl font-bold text-gray-900"
                  style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}
                >
                  Paquetes de Gastos
                </h2>
                <p
                  className="text-sm text-gray-400 mt-0.5"
                  style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}
                >
                  Revisa, aprueba o devuelve los paquetes enviados por los técnicos
                </p>
              </div>
            )}
            <ResponsablePaquetesView
              onVistaChange={(v) => setEnDetalle(v === 'detalle')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
