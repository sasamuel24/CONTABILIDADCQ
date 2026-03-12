import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { GlobalPage } from './pages/GlobalPage';
import { ResponsablePage } from './pages/ResponsablePage';
import { ContabilidadPage } from './pages/ContabilidadPage';
import { TesoreriaPage } from './pages/TesoreriaPage';
import { GerenciaPage } from './pages/GerenciaPage';
import { CentroDocumentalPage } from './pages/CentroDocumentalPage';
import { TecnicoMantenimientoPage } from './pages/TecnicoMantenimientoPage';
import { NoAutorizadoPage } from './pages/NoAutorizadoPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { AprobarPaquetePage } from './pages/AprobarPaquetePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';

function AppRoutes() {
  const { user, loading } = useAuth();
  const currentPath = window.location.pathname;

  // Rutas públicas que no necesitan auth ni loading
  const isPublicPath = currentPath === '/aprobar-paquete' || currentPath === '/change-password';

  if (loading && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#14aab8', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const roleRedirect = () => {
    const r = user?.role?.toLowerCase();
    if (r === 'admin' || r === 'fact') return '/global';
    if (r === 'responsable') return '/responsable';
    if (r === 'contabilidad') return '/contabilidad';
    if (r === 'tesoreria' || r === 'tes') return '/tesoreria';
    if (r === 'gerencia') return '/gerencia';
    if (r === 'tecnico' || r === 'mant') return '/tecnico-mantenimiento';
    if (r === 'direccion') return '/centro-documental';
    return '/no-autorizado';
  };

  return (
    <Routes>
      {/* Rutas públicas — siempre accesibles */}
      <Route path="/login" element={<LoginPage onLogin={() => {}} />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/aprobar-paquete" element={<AprobarPaquetePage />} />
      <Route path="/no-autorizado" element={<NoAutorizadoPage />} />

      {/* Redirigir a change-password si es obligatorio */}
      {user && user.must_change_password ? (
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      ) : (
        <>
          <Route
            path="/global"
            element={
              <ProtectedRoute allowedRoles={['admin', 'fact']}>
                <GlobalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/responsable"
            element={
              <ProtectedRoute allowedRoles={['responsable']}>
                <ResponsablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contabilidad"
            element={
              <ProtectedRoute allowedRoles={['contabilidad']}>
                <ContabilidadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tesoreria"
            element={
              <ProtectedRoute allowedRoles={['tesoreria', 'tes']}>
                <TesoreriaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gerencia"
            element={
              <ProtectedRoute allowedRoles={['gerencia', 'Gerencia']}>
                <GerenciaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tecnico-mantenimiento"
            element={
              <ProtectedRoute allowedRoles={['tecnico', 'Tecnico', 'mant']}>
                <TecnicoMantenimientoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/centro-documental"
            element={
              <ProtectedRoute allowedRoles={['direccion']}>
                <CentroDocumentalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              user
                ? <Navigate to={roleRedirect()} replace />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to={user ? roleRedirect() : '/login'} replace />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}