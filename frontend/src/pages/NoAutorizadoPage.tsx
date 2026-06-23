import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoleCode } from '../lib/api';

function getRoleHome(role: string): string {
  const r = role.toLowerCase();
  if (r === 'admin') return '/global';
  if (r === 'fact') return '/facturacion';
  if (r === 'responsable' || r === 'responsable_tiendas') return '/responsable';
  if (r === 'contabilidad') return '/contabilidad';
  if (r === 'tesoreria' || r === 'tes') return '/tesoreria';
  if (r === 'gerencia') return '/gerencia';
  if (r === 'tecnico' || r === 'mant') return '/tecnico-mantenimiento';
  if (r === 'direccion') return '/centro-documental';
  if (r === 'user') return '/legalizacion';
  if (r === 'tarjeta_cq') return '/tarjeta-cq';
  if (r === 'jefe_zona') return '/jefe-zona';
  return '';
}

export function NoAutorizadoPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Auto-redirect si el usuario tiene un rol conocido con ruta propia
  useEffect(() => {
    if (!user) return;
    const home = getRoleHome(getUserRoleCode(user));
    if (home) {
      navigate(home, { replace: true });
    }
  }, [user, navigate]);

  const handleGoHome = () => {
    if (!user) { navigate('/login'); return; }
    const home = getRoleHome(getUserRoleCode(user));
    navigate(home || '/login', { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Acceso No Autorizado
        </h1>

        <p className="text-gray-600 mb-6">
          No tienes permisos para acceder a esta sección.
          Por favor, contacta con el administrador si crees que esto es un error.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            Ir a mi área
          </button>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        {user && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Usuario: <span className="font-medium text-gray-700">{user.nombre}</span>
            </p>
            <p className="text-sm text-gray-500">
              Área: <span className="font-medium text-gray-700">{user.area?.nombre || 'Sin área'}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
