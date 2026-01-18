import { useState } from 'react';
import { Inbox, LogOut } from 'lucide-react';
import { InboxView } from '../components/InboxView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function TesoreriaPage() {
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
          <h1 className="text-xl font-bold text-gray-900">{user?.area?.nombre || 'CONTABILIDAD CQ'}</h1>
          <p className="text-sm text-gray-500 mt-1">Tesorería</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
            <Inbox className="w-5 h-5" />
            Bandeja de Entrada
          </button>
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{user?.area?.nombre}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <InboxView />
      </div>
    </div>
  );
}
