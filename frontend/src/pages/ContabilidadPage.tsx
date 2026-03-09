import { useState } from 'react';
import { Inbox, LogOut, FolderInput, PackageOpen } from 'lucide-react';
import { InboxView } from '../components/InboxView';
import { CarpetasView } from '../components/CarpetasView';
import { ResponsablePaquetesView } from '../components/ResponsablePaquetesView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function ContabilidadPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'inbox' | 'carpetas' | 'paquetes'>('inbox');
  const [enDetalle, setEnDetalle] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 style={{fontFamily: 'Neutra Text Bold, Montserrat, sans-serif'}} className="text-xl font-bold text-gray-900">{user?.area?.nombre || 'CONTABILIDAD CQ'}</h1>
          <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-500 mt-1">Contabilidad</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <button 
            onClick={() => { setActiveView('inbox'); setEnDetalle(false); }}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: activeView === 'inbox' ? '#e0f5f7' : 'transparent',
              color: activeView === 'inbox' ? '#00829a' : '#6b7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'inbox') {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#00829a';
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'inbox') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg mb-2"
          >
            <Inbox className="w-5 h-5" />
            Bandeja de Entrada
          </button>
          
          <button
            onClick={() => { setActiveView('carpetas'); setEnDetalle(false); }}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: activeView === 'carpetas' ? '#e0f5f7' : 'transparent',
              color: activeView === 'carpetas' ? '#00829a' : '#6b7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'carpetas') {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#00829a';
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'carpetas') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg"
          >
            <FolderInput className="w-5 h-5" />
            Trazabilidad Facturas
          </button>

          <button
            onClick={() => { setActiveView('paquetes'); setEnDetalle(false); }}
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: activeView === 'paquetes' ? '#e0f5f7' : 'transparent',
              color: activeView === 'paquetes' ? '#00829a' : '#6b7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'paquetes') {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#00829a';
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'paquetes') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg mt-2"
          >
            <PackageOpen className="w-5 h-5" />
            Paquetes de Gastos
          </button>
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                style={{backgroundColor: '#00829a'}}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              >
                {user?.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
                <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-gray-500 truncate">{user?.area?.nombre}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#4b5563';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
              className="p-2 text-gray-400 rounded-lg"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeView === 'inbox' && <InboxView />}
        {activeView === 'carpetas' && <CarpetasView />}
        {activeView === 'paquetes' && (
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
