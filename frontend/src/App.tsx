import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { GlobalPage } from './pages/GlobalPage';
import { ResponsablePage } from './pages/ResponsablePage';
import { ContabilidadPage } from './pages/ContabilidadPage';
import { TesoreriaPage } from './pages/TesoreriaPage';
import { CentroDocumentalPage } from './pages/CentroDocumentalPage';
import { NoAutorizadoPage } from './pages/NoAutorizadoPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function AppRoutes() {
  const { user, loading } = useAuth();
  const currentPath = window.location.pathname;

  // Permitir acceso a change-password sin esperar loading
  if (currentPath === '/change-password') {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Redirigir a cambio de contraseña si es obligatorio
  if (user && user.must_change_password && currentPath !== '/change-password' && currentPath !== '/login') {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <Routes>
      {/* Ruta de login */}
      <Route path="/login" element={<LoginPage onLogin={() => {}} />} />
      
      {/* Ruta de cambio de contraseña obligatorio */}
      <Route path="/change-password" element={<ChangePasswordPage />} />
      
      {/* Ruta de acceso no autorizado */}
      <Route path="/no-autorizado" element={<NoAutorizadoPage />} />
      
      {/* Ruta global (para admin y facturación) */}
      <Route
        path="/global"
        element={
          <ProtectedRoute allowedRoles={['admin', 'fact']}>
            <GlobalPage />
          </ProtectedRoute>
        }
      />
      
      {/* Ruta responsable */}
      <Route
        path="/responsable"
        element={
          <ProtectedRoute allowedRoles={['responsable']}>
            <ResponsablePage />
          </ProtectedRoute>
        }
      />
      
      {/* Ruta contabilidad */}
      <Route
        path="/contabilidad"
        element={
          <ProtectedRoute allowedRoles={['contabilidad']}>
            <ContabilidadPage />
          </ProtectedRoute>
        }
      />
      
      {/* Ruta tesorería */}
      <Route
        path="/tesoreria"
        element={
          <ProtectedRoute allowedRoles={['tesoreria']}>
            <TesoreriaPage />
          </ProtectedRoute>
        }
      />
      
      {/* Ruta centro documental (Directora Contabilidad) */}
      <Route
        path="/centro-documental"
        element={
          <ProtectedRoute allowedRoles={['direccion']}>
            <CentroDocumentalPage />
          </ProtectedRoute>
        }
      />
      
      {/* Redirección raíz: redirigir según rol del usuario */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={
                user.role === 'admin' || user.role === 'fact' ? '/global' :
                user.role === 'responsable' ? '/responsable' :
                user.role === 'contabilidad' ? '/contabilidad' :
                user.role === 'tesoreria' ? '/tesoreria' :
                user.role === 'direccion' ? '/centro-documental' :
                '/no-autorizado'
              }
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      
      {/* Catch all: redirigir a no autorizado */}
      <Route path="*" element={<Navigate to="/no-autorizado" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}