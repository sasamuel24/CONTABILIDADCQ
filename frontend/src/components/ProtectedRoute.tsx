import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function getRoleHome(role: string): string {
  const r = role.toLowerCase();
  if (r === 'admin') return '/global';
  if (r === 'fact') return '/facturacion';
  if (r === 'responsable') return '/responsable';
  if (r === 'contabilidad') return '/contabilidad';
  if (r === 'tesoreria' || r === 'tes') return '/tesoreria';
  if (r === 'gerencia') return '/gerencia';
  if (r === 'tecnico' || r === 'mant') return '/tecnico-mantenimiento';
  if (r === 'direccion') return '/centro-documental';
  return '/login';
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedUserRole = user.role?.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
      return <Navigate to={getRoleHome(user.role)} replace />;
    }
  }

  return <>{children}</>;
}
