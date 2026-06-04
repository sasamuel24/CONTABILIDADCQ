import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Inbox, LogOut, PackageOpen, UploadCloud, Banknote, History, Menu, X, ChevronRight } from 'lucide-react';
import { InboxView } from '../components/InboxView';
import { ResponsablePaquetesView } from '../components/ResponsablePaquetesView';
import { GastosAdminSubidaView } from '../components/GastosAdminSubidaView';
import { GastosAdminTrazabilidadView } from '../components/GastosAdminTrazabilidadView';
import { ResponsableHistorialView } from '../components/ResponsableHistorialView';
import { AnticiposView } from '../components/AnticiposView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type Seccion = 'bandeja' | 'paquetes' | 'subida' | 'trazabilidad' | 'historial' | 'anticipo';

export function ResponsablePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>('bandeja');
  const [enDetalle, setEnDetalle] = useState(false);

  // drawerOpen: el usuario lo abre/cierra
  // drawerMounted: controla si el nodo existe en el DOM (para animación de salida)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  const esMant   = user?.area?.code === 'mant';
  const esGadmin = user?.area?.code === 'GADMIN';

  const NAV: { id: Seccion; label: string; icon: React.ReactNode }[] = [
    { id: 'bandeja',   label: 'Bandeja de Entrada',       icon: <Inbox        className="w-5 h-5" /> },
    { id: 'historial', label: 'Historial de Facturas',    icon: <History      className="w-5 h-5" /> },
    ...(esMant   ? [{ id: 'paquetes' as Seccion, label: 'Paquetes de Gastos',        icon: <PackageOpen className="w-5 h-5" /> }] : []),
    ...(esGadmin ? [{ id: 'subida'   as Seccion, label: 'Subida Manual de Facturas', icon: <UploadCloud className="w-5 h-5" /> }] : []),
    { id: 'anticipo',  label: 'Legalizar Anticipo',       icon: <Banknote     className="w-5 h-5" /> },
  ];

  const openDrawer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDrawerMounted(true);
    // pequeño delay para que el DOM monte antes de aplicar la transición
    requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    // desmontar el nodo solo DESPUÉS de que termina la animación (280ms)
    closeTimer.current = setTimeout(() => setDrawerMounted(false), 300);
  };

  const goTo = (id: Seccion) => { setSeccion(id); setEnDetalle(false); closeDrawer(); };

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // limpia el timer al desmontar
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const seccionLabel = NAV.find(n => n.id === seccion)?.label ?? '';

  return (
    <>
      {/* ══ MOBILE: drawer via portal — solo existe en el DOM cuando está montado ══ */}
      {drawerMounted && createPortal(
        <>
          {/* Overlay */}
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,0,0.5)',
              opacity: drawerOpen ? 1 : 0,
              transition: 'opacity 0.28s ease',
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 280, zIndex: 9999,
              background: '#fff',
              boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', fontFamily: "'Neutra Text', 'Montserrat', sans-serif", margin: 0 }}>
                  {user?.area?.nombre || 'CONTABILIDAD CQ'}
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                  Responsable de Área
                </p>
              </div>
              <button
                onClick={closeDrawer}
                style={{ padding: 6, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
              {NAV.map((item) => {
                const activo = seccion === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => goTo(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '11px 14px',
                      borderRadius: 12, border: 'none', cursor: 'pointer',
                      marginBottom: 4, textAlign: 'left',
                      backgroundColor: activo ? 'rgba(0,130,154,0.1)' : 'transparent',
                      color: activo ? '#00829a' : '#6b7280',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                      fontSize: 14, fontWeight: activo ? 600 : 500,
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <span style={{ color: activo ? '#00829a' : '#9ca3af', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {activo && <ChevronRight size={16} style={{ opacity: 0.4 }} />}
                  </button>
                );
              })}
            </nav>

            {/* User footer */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#00829a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {user?.nombre?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                  {user?.nombre}
                </p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                  {user?.area?.nombre}
                </p>
              </div>
              <button
                onClick={handleLogout}
                style={{ padding: 7, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ══ LAYOUT PRINCIPAL ══════════════════════════════════════════════════ */}
      <div className="flex h-screen bg-gray-50 overflow-hidden">

        {/* Área principal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar — siempre visible */}
          <header className="flex items-center gap-3 px-4 bg-white border-b border-gray-200 flex-shrink-0" style={{ height: 56 }}>
            <button onClick={openDrawer} className="p-2 -ml-1 rounded-xl text-gray-500 active:bg-gray-100 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="h-8 px-3 rounded-lg flex items-center" style={{ backgroundColor: '#00829a' }}>
              <span className="text-white text-sm font-bold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>DocuFlow</span>
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-700 truncate" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
              {seccionLabel}
            </span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00829a' }}>
              {user?.nombre?.charAt(0).toUpperCase()}
            </div>
          </header>

          {/* Contenido */}
          <main className="flex-1 overflow-auto">
            {seccion === 'bandeja'      && <InboxView />}
            {seccion === 'historial'    && <ResponsableHistorialView />}
            {seccion === 'subida'       && esGadmin && <GastosAdminSubidaView />}
            {seccion === 'trazabilidad' && esGadmin && <GastosAdminTrazabilidadView />}
            {seccion === 'anticipo'     && <AnticiposView />}
            {seccion === 'paquetes'     && esMant && (
              <div className={enDetalle ? 'p-4' : 'p-4 md:p-8'}>
                {!enDetalle && (
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>Paquetes de Gastos</h2>
                    <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>Revisa, aprueba o devuelve los paquetes enviados por los técnicos</p>
                  </div>
                )}
                <ResponsablePaquetesView onVistaChange={(v) => setEnDetalle(v === 'detalle')} />
              </div>
            )}
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden flex items-stretch bg-white border-t border-gray-200 flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {NAV.slice(0, 4).map((item) => {
              const activo = seccion === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
                  style={{ color: activo ? '#00829a' : '#9ca3af' }}
                >
                  <span className="p-1 rounded-lg" style={{ backgroundColor: activo ? 'rgba(0,130,154,0.1)' : 'transparent' }}>
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>
                    {item.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
            <button onClick={openDrawer} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400">
              <span className="p-1 rounded-lg"><Menu className="w-5 h-5" /></span>
              <span className="text-[10px] font-semibold" style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}>Más</span>
            </button>
          </nav>

        </div>
      </div>
    </>
  );
}
