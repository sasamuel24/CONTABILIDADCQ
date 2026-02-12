import { useState } from 'react';
import { FolderOpen, LogOut, Eye } from 'lucide-react';
import { CarpetasGerenciaView } from '../components/CarpetasGerenciaView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function GerenciaPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-sm text-gray-500 mt-1">Gerencia Financiera</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button 
            style={{
              fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
              backgroundColor: '#e0f5f7',
              color: '#00829a',
              transition: 'all 0.2s'
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg"
          >
            <FolderOpen className="w-5 h-5" />
            Carpetas programación de pagos
          </button>

          {/* Indicador modo auditor */}
          <div className="mt-4 mx-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-amber-600" />
              <span style={{fontFamily: 'Neutra Text Demi, Montserrat, sans-serif'}} className="text-xs text-amber-700 font-medium">Modo Auditor</span>
            </div>
            <p style={{fontFamily: 'Neutra Text Book, Montserrat, sans-serif'}} className="text-xs text-amber-600">
              Vista de solo lectura de las carpetas gestionadas por Tesorería.
            </p>
          </div>
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
        <CarpetasGerenciaView />
      </div>
    </div>
  );
}
