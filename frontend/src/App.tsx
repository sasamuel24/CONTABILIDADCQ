import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getUserRoleCode } from './lib/api';
import { LoginPage } from './components/LoginPage';
import { GlobalPage } from './pages/GlobalPage';
import { FacturacionPage } from './pages/FacturacionPage';
import { ResponsablePage } from './pages/ResponsablePage';
import { ContabilidadPage } from './pages/ContabilidadPage';
import { TesoreriaPage } from './pages/TesoreriaPage';
import { GerenciaPage } from './pages/GerenciaPage';
import { CentroDocumentalPage } from './pages/CentroDocumentalPage';
import { TecnicoMantenimientoPage } from './pages/TecnicoMantenimientoPage';
import { LegalizacionPage } from './pages/LegalizacionPage';
import { TarjetaCQPage } from './pages/TarjetaCQPage';
import { JefeZonaPage } from './pages/JefeZonaPage';
import { NoAutorizadoPage } from './pages/NoAutorizadoPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { AprobarPaquetePage } from './pages/AprobarPaquetePage';
import { AprobarFacturaPage } from './pages/AprobarFacturaPage';
import { AprobarAnticipoPagina } from './pages/AprobarAnticipoPagina';
import { AnticiposView } from './components/AnticiposView';
import { Component, type ReactNode } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { DocuFlowAgentButton } from './components/DocuFlowAgentButton';

class ChatBotErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const currentPath = window.location.pathname;

  // Rutas públicas que no necesitan auth ni loading
  const isPublicPath =
    currentPath === '/aprobar-paquete' ||
    currentPath === '/aprobar-factura' ||
    currentPath === '/aprobar-anticipo' ||
    currentPath === '/change-password';

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
    const r = getUserRoleCode(user).toLowerCase();
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
    return '/no-autorizado';
  };

  return (
    <Routes>
      {/* Rutas públicas — siempre accesibles */}
      <Route path="/login" element={<LoginPage onLogin={() => {}} />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/aprobar-paquete" element={<AprobarPaquetePage />} />
      <Route path="/aprobar-factura" element={<AprobarFacturaPage />} />
      <Route path="/aprobar-anticipo" element={<AprobarAnticipoPagina />} />
      <Route path="/no-autorizado" element={<NoAutorizadoPage />} />

      {/* Redirigir a change-password si es obligatorio */}
      {user && user.must_change_password ? (
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      ) : (
        <>
          <Route
            path="/global"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <GlobalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/facturacion"
            element={
              <ProtectedRoute allowedRoles={['fact']}>
                <FacturacionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/responsable"
            element={
              <ProtectedRoute allowedRoles={['responsable', 'responsable_tiendas']}>
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
            path="/legalizacion"
            element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <LegalizacionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tarjeta-cq"
            element={
              <ProtectedRoute allowedRoles={['tarjeta_cq']}>
                <TarjetaCQPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jefe-zona"
            element={
              <ProtectedRoute allowedRoles={['jefe_zona']}>
                <JefeZonaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mis-anticipo"
            element={
              <ProtectedRoute>
                <AnticiposView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mis-gastos-anticipo"
            element={
              <ProtectedRoute>
                <LegalizacionPage modoAnticipo={true} />
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
        <ChatBotErrorBoundary>
          <DocuFlowAgentButton />
        </ChatBotErrorBoundary>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}