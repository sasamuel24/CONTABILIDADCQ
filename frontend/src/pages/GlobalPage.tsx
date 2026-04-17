import { useState } from 'react';
import { LogOut, Users, LayoutDashboard, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AdminUsuariosView } from '../components/AdminUsuariosView';
import { AdminDashboardView } from '../components/AdminDashboardView';
import { AdminAreasView } from '../components/AdminAreasView';

type Section = 'dashboard' | 'usuarios' | 'areas';

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Panel', icon: <LayoutDashboard className="w-5 h-5" /> },
  { key: 'usuarios', label: 'Usuarios', icon: <Users className="w-5 h-5" /> },
  { key: 'areas', label: 'Áreas', icon: <Building2 className="w-5 h-5" /> },
];

export function GlobalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('dashboard');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="w-full h-10 rounded-lg flex items-center justify-center px-3" style={{ backgroundColor: '#00829a' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
              Sistema Facturación
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-0.5 transition-all text-sm"
                style={{
                  backgroundColor: isActive ? 'rgba(20,170,184,0.1)' : 'transparent',
                  color: isActive ? '#00829a' : '#6b7280',
                  fontFamily: 'Neutra Text, Montserrat, sans-serif',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="px-4 py-2 mb-3 text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
            {user?.nombre}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 overflow-auto">
        {section === 'dashboard' && <AdminDashboardView />}
        {section === 'usuarios' && <AdminUsuariosView />}
        {section === 'areas' && <AdminAreasView />}
      </div>
    </div>
  );
}
