import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { GlobalPage } from './pages/GlobalPage';
import { ResponsablePage } from './pages/ResponsablePage';
import { ContabilidadPage } from './pages/ContabilidadPage';
import { TesoreriaPage } from './pages/TesoreriaPage';
import { GerenciaPage } from './pages/GerenciaPage';
import { CentroDocumentalPage } from './pages/CentroDocumentalPage';
import { NoAutorizadoPage } from './pages/NoAutorizadoPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';

function AppRoutes() {
  const { user, loading } = useAuth();
  const currentPath = window.location.pathname;

  // Si estamos en /change-password, renderizar directamente sin esperar
  if (currentPath === '/change-password') {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Routes>
    );
  }

  if (loading) {
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
      
      {/* Ruta gerencia financiera (auditor de pagos) */}
      <Route
        path="/gerencia"
        element={
          <ProtectedRoute allowedRoles={['Gerencia']}>
            <GerenciaPage />
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
                user.role === 'Gerencia' ? '/gerencia' :
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
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}