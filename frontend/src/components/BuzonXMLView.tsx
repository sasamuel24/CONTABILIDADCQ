import { useState, useEffect, ReactElement } from 'react';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, X, FileText, Eye, Download } from 'lucide-react';
import { getAreas, getFacturas, confirmarIngestaFactura, getFacturaFilesByDocType, downloadFileById, AreaDetail, FileMiniOut } from '../lib/api';
import { FilePreviewModal } from './FilePreviewModal';

// NITs de proveedores cuyos facturas se gestionan en el buzón XML automático
const NITS_TABLA = new Set([
  "901761363","901373083","890928257","860000996","900080634",
  "900040299","900718257","900277192","901731328","860530547",
  "860016767","91440300MA5EM","900083863","800245795","890904478",
  "890800718","800045797","901037119","LU24640654","860028580",
  "800250778","860006127","890900608","805016704","901534331",
  "900529276","860007538","860002063","900438907","890900424",
  "891300241","901026869","901235670","860007955","900833934",
  "890916575","900618834","860004922","1193389919","900973989",
  "891903392","900813998","860524896","900208583","811006722",
  "901597547","901554982",
]);

interface FacturaBuzon {
  id: string;
  numero_factura: string;
  proveedor: string;
  nit_proveedor: string | null;
  total: number;
  fecha_emision: string | null;
  area: string;
  area_id: string | null;
  pendiente_confirmacion: boolean;
  ai_area_confianza: string | null;
  ai_area_razonamiento: string | null;
}

type Area = AreaDetail;

type Seccion = 'auto_asignadas' | 'pendientes' | 'sin_asignar';

const confianzaConfig: Record<string, { label: string; color: string; bg: string; icon: ReactElement }> = {
  alta:  { label: 'Alta',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
  media: { label: 'Media', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <AlertCircle className="w-4 h-4 text-yellow-600" /> },
  baja:  { label: 'Baja',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <AlertCircle className="w-4 h-4 text-orange-600" /> },
  nula:  { label: 'Sin identificar', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" /> },
};

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export function BuzonXMLView() {
  const [facturas, setFacturas] = useState<FacturaBuzon[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seccion, setSeccion] = useState<Seccion>('pendientes');
  const [seleccionada, setSeleccionada] = useState<FacturaBuzon | null>(null);
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [actualizando, setActualizando] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<FileMiniOut[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const [facturasResp, areasResp] = await Promise.all([
        getFacturas(0, 500),
        getAreas(),
      ]);

      const buzon: FacturaBuzon[] = (facturasResp.items || []).filter((f: any) => {
        if (!f.nit_proveedor) return false;
        const nit = f.nit_proveedor.trim().replace(/-/g, '').toUpperCase();
        return NITS_TABLA.has(nit);
      });
      setFacturas(buzon);
      setAreas(areasResp || []);
    } catch (e) {
      console.error('Error cargando buzón XML:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const abrirDetalle = async (f: FacturaBuzon) => {
    setSeleccionada(f);
    setAreaSeleccionada(f.area_id || '');
    setLoadingPdf(true);
    try {
      const files = await getFacturaFilesByDocType(f.id, 'FACTURA_PDF');
      setPdfFiles(files);
    } catch {
      setPdfFiles([]);
    } finally {
      setLoadingPdf(false);
    }
  };

  const cerrar = () => {
    setSeleccionada(null);
    setAreaSeleccionada('');
    setPdfFiles([]);
  };

  const handleDownloadPdf = async (file: FileMiniOut) => {
    try {
      const blob = await downloadFileById(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error descargando PDF:', e);
    }
  };

  const actualizarArea = async () => {
    if (!seleccionada || !areaSeleccionada) return;
    setActualizando(true);
    try {
      await confirmarIngestaFactura(seleccionada.id, areaSeleccionada);
      await cargarDatos();
      cerrar();
    } finally {
      setActualizando(false);
    }
  };

  // Auto-asignadas: asignación directa por tabla NIT (confianza alta, ya fluyen al responsable)
  const autoAsignadas = facturas.filter(f => !f.pendiente_confirmacion && !!f.area_id && f.ai_area_confianza === 'alta');
  // Pendientes: tabla NIT con múltiples responsables o tienda ambigua (confianza media)
  const pendientes    = facturas.filter(f => f.pendiente_confirmacion && !!f.area_id);
  // Sin asignar: NIT conocido pero área no determinada (tienda no identificada, etc.)
  const sinAsignar    = facturas.filter(f => !f.area_id);

  const secciones: { key: Seccion; label: string; count: number; dot: string }[] = [
    { key: 'auto_asignadas', label: 'Auto-asignadas',         count: autoAsignadas.length, dot: 'bg-green-500' },
    { key: 'pendientes',     label: 'Pendientes confirmación', count: pendientes.length,   dot: 'bg-yellow-500' },
    { key: 'sin_asignar',   label: 'Sin asignar',             count: sinAsignar.length,   dot: 'bg-red-500' },
  ];

  const facturasActivas =
    seccion === 'auto_asignadas' ? autoAsignadas :
    seccion === 'pendientes'     ? pendientes     :
    sinAsignar;

  const puedeActualizar = !!areaSeleccionada && areaSeleccionada !== seleccionada?.area_id;

  return (
    <div className="p-8">

      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
          Buzón XML Automático
        </h2>
        <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          Facturas electrónicas procesadas automáticamente desde el correo
        </p>
      </div>

      {/* Tarjetas de sección */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {secciones.map(s => (
          <button
            key={s.key}
            onClick={() => { setSeccion(s.key); cerrar(); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              seccion === s.key ? 'border-[#00829a] bg-[#f0fbfc]' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`w-3 h-3 rounded-full ${s.dot}`} />
              <span className="text-2xl font-bold text-gray-900">{s.count}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Layout lista + panel detalle */}
      <div className="flex gap-4">

        {/* Lista */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-all ${seleccionada ? 'flex-1' : 'w-full'}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {secciones.find(s => s.key === seccion)?.label}
            </h3>
            <button
              onClick={cargarDatos}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#00829a]"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Cargando...</div>
          ) : facturasActivas.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay facturas en esta sección.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Factura</th>
                  <th className="px-6 py-3 text-left">Proveedor</th>
                  <th className="px-6 py-3 text-left">Total</th>
                  <th className="px-6 py-3 text-left">Área IA</th>
                  <th className="px-6 py-3 text-left">Confianza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturasActivas.map(f => {
                  const conf = confianzaConfig[f.ai_area_confianza || 'nula'];
                  const activa = seleccionada?.id === f.id;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => abrirDetalle(f)}
                      className={`cursor-pointer transition-colors ${activa ? 'bg-[#f0fbfc]' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 text-sm">{f.numero_factura}</div>
                        <div className="text-xs text-gray-400">{f.fecha_emision || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{f.proveedor}</div>
                        {f.nit_proveedor && (
                          <div className="text-xs text-gray-400">NIT: {f.nit_proveedor}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatCOP(f.total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{f.area || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${conf.bg} ${conf.color}`}>
                          {conf.icon}
                          {conf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel detalle */}
        {seleccionada && (
          <div className="w-80 bg-white rounded-xl border border-gray-200 flex flex-col shrink-0">

            {/* Header panel */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#00829a' }}>
              <div className="flex flex-col gap-1">
                <span className="text-white font-semibold text-sm">{seleccionada.numero_factura}</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-white/20 text-white w-fit">Recibida por facturación</span>
              </div>
              <button onClick={cerrar} className="text-white/70 hover:text-white ml-3 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info factura */}
            <div className="px-6 py-4 border-b border-gray-100 space-y-3">
              <h4 className="text-gray-900 font-medium text-sm">Información de la Factura</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Proveedor</span>
                <span className="text-gray-900 text-right max-w-40 font-medium">{seleccionada.proveedor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Área</span>
                <span className="text-gray-900">{seleccionada.area || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha Emisión</span>
                <span className="text-gray-900">{seleccionada.fecha_emision || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total a Pagar</span>
                <span className="text-gray-900 font-medium">{formatCOP(seleccionada.total)}</span>
              </div>
              {seleccionada.ai_area_razonamiento && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 leading-relaxed">
                  {seleccionada.ai_area_razonamiento}
                </div>
              )}
            </div>

            {/* PDF de la factura */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-gray-900 font-medium text-sm mb-3">Documento PDF</h4>
              {loadingPdf ? (
                <p className="text-xs text-gray-400">Cargando...</p>
              ) : pdfFiles.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin PDF adjunto</p>
              ) : (
                <div className="space-y-2">
                  {pdfFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-xs text-gray-700 truncate max-w-[130px]">{file.filename}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded hover:bg-[#e0f5f7] text-gray-400 hover:text-[#00829a] transition-colors"
                          title="Previsualizar PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(file)}
                          className="p-1.5 rounded hover:bg-[#e0f5f7] text-gray-400 hover:text-[#00829a] transition-colors"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cambiar Área */}
            {(seleccionada.pendiente_confirmacion || !seleccionada.area_id) && (
              <div className="px-6 py-4 flex-1">
                <h4 className="text-gray-900 mb-3">Cambiar Área</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm">
                      Área Responsable
                    </label>
                    <select
                      value={areaSeleccionada}
                      onChange={e => setAreaSeleccionada(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm"
                      style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
                      onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'; }}
                      onBlur={e => { e.target.style.boxShadow = ''; }}
                    >
                      <option value="">Seleccionar área...</option>
                      {areas.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={actualizarArea}
                    disabled={!puedeActualizar || actualizando}
                    className="w-full px-4 py-2.5 rounded-lg transition-all border-2 text-sm"
                    style={{
                      backgroundColor: puedeActualizar ? 'transparent' : '#f3f4f6',
                      borderColor:     puedeActualizar ? '#00829a' : '#d1d5db',
                      color:           puedeActualizar ? '#00829a' : '#9ca3af',
                      cursor:          puedeActualizar ? 'pointer' : 'not-allowed',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                    }}
                    onMouseEnter={e => { if (puedeActualizar) { e.currentTarget.style.backgroundColor = 'rgba(20,170,184,0.05)'; e.currentTarget.style.borderColor = '#14aab8'; } }}
                    onMouseLeave={e => { if (puedeActualizar) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#00829a'; } }}
                  >
                    {actualizando ? 'Actualizando...' : 'Actualizar Área'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={cerrar}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-100 transition-colors"
                style={{ fontFamily: "'Neutra Text', 'Montserrat', sans-serif" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de previsualización PDF — mismo que usa el resto de la app */}
      {previewFile && (
        <FilePreviewModal
          fileId={previewFile.id}
          filename={previewFile.filename}
          contentType={previewFile.content_type}
          storagePath={previewFile.storage_path ?? undefined}
          facturaId={seleccionada?.id}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownloadPdf(previewFile)}
        />
      )}
    </div>
  );
}
