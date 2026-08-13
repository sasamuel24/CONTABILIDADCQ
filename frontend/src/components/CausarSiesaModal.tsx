import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Send, AlertTriangle, CheckCircle2, RefreshCw, Plus, Trash2, Info, ShieldAlert,
} from 'lucide-react';
import {
  causarEnSiesa,
  getMaestrosSiesa,
  prepararCausacionSiesa,
  verificarCausacionSiesa,
  type SiesaCausarIn,
  type SiesaCausacion,
  type SiesaMaestros,
  type SiesaPreparar,
  type SiesaRetencionIn,
} from '../lib/api';

interface CausarSiesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  facturaId: string;
  onCausada?: (causacion: SiesaCausacion) => void;
}

const toNum = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

const fmtCOP = (v: string | number | null | undefined) =>
  toNum(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const ESTADO_LABELS: Record<string, { label: string; cls: string }> = {
  verificado: { label: 'Verificado', cls: 'bg-green-50 text-green-700 border-green-200' },
  exitoso: { label: 'Exitoso (sin nº FSP)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  enviado: { label: 'Estado desconocido', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  enviando: { label: 'Enviando', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Error', cls: 'bg-red-50 text-red-700 border-red-200' },
  borrador: { label: 'Borrador', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const inputCls =
  'w-full rounded-lg px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

export function CausarSiesaModal({ isOpen, onClose, facturaId, onCausada }: CausarSiesaModalProps) {
  const [loading, setLoading] = useState(false);
  const [prep, setPrep] = useState<SiesaPreparar | null>(null);
  const [maestros, setMaestros] = useState<SiesaMaestros | null>(null);
  const [form, setForm] = useState<SiesaCausarIn | null>(null);
  const [guardarDefault, setGuardarDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setExito(null);
    setGuardarDefault(true);
    void cargar();
  }, [isOpen, facturaId]);

  const cargar = async () => {
    try {
      setLoading(true);
      const [p, m] = await Promise.all([
        prepararCausacionSiesa(facturaId),
        getMaestrosSiesa(),
      ]);
      setPrep(p);
      setMaestros(m);
      setForm(p.prefill ? { ...p.prefill, guardar_como_default: true } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error preparando la causación');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const yaCausada = (prep?.causaciones ?? []).some(c => c.estado === 'exitoso' || c.estado === 'verificado');
  const envioDudoso = (prep?.causaciones ?? []).some(c => c.estado === 'enviando' || c.estado === 'enviado');
  const renglon = form?.renglones?.[0];

  // Cuadre en vivo con lo que hay en el formulario (regla #11 en el backend;
  // aquí solo se anticipa visualmente)
  const baseForm = form ? form.renglones.reduce((s, r) => s + toNum(r.valor_bruto), 0) : 0;
  const ivaForm = form ? form.renglones.reduce((s, r) => s + toNum(r.valor_iva), 0) : 0;
  const retForm = form
    ? form.retenciones.reduce((s, r) => (baseForm >= toNum(r.base_minima) ? s + Math.round(baseForm * toNum(r.tasa) / 100) : s), 0)
    : 0;
  const totalFactura = toNum(prep?.total);
  const brutoForm = baseForm + ivaForm;
  const netoForm = brutoForm - retForm;
  const cuadraForm = Math.abs(brutoForm - totalFactura) <= 1 || Math.abs(netoForm - totalFactura) <= 1;

  const setRenglon = (campo: string, valor: string) => {
    if (!form) return;
    const renglones = form.renglones.map((r, i) => (i === 0 ? { ...r, [campo]: valor } : r));
    setForm({ ...form, renglones });
  };

  const setRetencion = (idx: number, campo: keyof SiesaRetencionIn, valor: string) => {
    if (!form) return;
    const retenciones = form.retenciones.map((r, i) => (i === idx ? { ...r, [campo]: valor } : r));
    setForm({ ...form, retenciones });
  };

  const agregarRetencion = () => {
    if (!form) return;
    setForm({
      ...form,
      retenciones: [...form.retenciones, { llave: '', tasa: '', clase_imp_base: '2', base_minima: '0' }],
    });
  };

  const quitarRetencion = (idx: number) => {
    if (!form) return;
    setForm({ ...form, retenciones: form.retenciones.filter((_, i) => i !== idx) });
  };

  const numeroDoctoValido = (form?.numero_docto_proveedor ?? '').length <= 8;
  const puedeEnviar =
    Boolean(form) && Boolean(prep?.habilitado) && !yaCausada && !envioDudoso && !submitting && cuadraForm && numeroDoctoValido;

  const handleCausar = async () => {
    if (!form || !puedeEnviar) return;
    try {
      setSubmitting(true);
      setError(null);
      setExito(null);
      const resp = await causarEnSiesa(facturaId, { ...form, guardar_como_default: guardarDefault });
      setExito(resp.mensaje);
      onCausada?.(resp.causacion);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al causar en Siesa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerificar = async (causacionId: string) => {
    try {
      setVerificando(causacionId);
      setError(null);
      const resp = await verificarCausacionSiesa(causacionId);
      setExito(resp.mensaje);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar en Siesa');
    } finally {
      setVerificando(null);
    }
  };

  const modal = (
    <>
      <div
        className="fixed inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(17, 24, 39, 0.55)', zIndex: 100000 }}
        onClick={onClose}
      />
      <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 100001 }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to right, #00829a, #14aab8)' }}
              className="text-white px-6 py-4 rounded-t-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5" />
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
                    Causar en Siesa (FSP)
                  </h3>
                  <p className="text-sm text-white/90">
                    {prep ? `${prep.numero_factura} · ${prep.proveedor} · NIT ${prep.nit_normalizado || '—'}` : 'Cargando…'}
                    {prep && ` · ambiente ${prep.causaciones[0]?.ambiente || (prep.habilitado ? '' : '')}`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Preparando causación…</div>
              ) : !prep ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error || 'No se pudo preparar la causación.'}
                </div>
              ) : (
                <>
                  {!prep.habilitado && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800">
                        La integración con Siesa está <strong>deshabilitada</strong> en el servidor
                        (SIESA_HABILITADO). Se puede revisar el prefill pero no enviar.
                      </p>
                    </div>
                  )}

                  {/* Historial de causaciones */}
                  {prep.causaciones.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Causaciones de esta factura
                      </div>
                      <div className="divide-y divide-gray-100">
                        {prep.causaciones.map(c => {
                          const cfg = ESTADO_LABELS[c.estado] || ESTADO_LABELS.borrador;
                          const verificable = c.estado === 'exitoso' || c.estado === 'enviado' || c.estado === 'enviando';
                          return (
                            <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                              <span className="text-gray-600">
                                {c.numero_fsp ? <>FSP <strong>{c.numero_fsp}</strong></> : `amarre ${c.amarre}`}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(c.created_at).toLocaleString('es-CO')} · {c.ambiente.toUpperCase()}
                              </span>
                              {verificable && (
                                <button
                                  type="button"
                                  onClick={() => handleVerificar(c.id)}
                                  disabled={verificando === c.id}
                                  className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-cyan-300 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3 h-3 ${verificando === c.id ? 'animate-spin' : ''}`} />
                                  {verificando === c.id ? 'Verificando…' : 'Verificar en Siesa'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {envioDudoso && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800">
                        Hay un envío con <strong>estado desconocido</strong> (fallo de red). Usa
                        "Verificar en Siesa" antes de reintentar — riesgo de doble causación.
                      </p>
                    </div>
                  )}

                  {yaCausada ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-green-800">
                        Esta factura <strong>ya fue causada</strong> en Siesa. No se puede reenviar.
                      </p>
                    </div>
                  ) : form && (
                    <>
                      {/* Valores de la factura + cuadre */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: 'Total factura', valor: fmtCOP(prep.total), destacar: false },
                          { label: 'Base (XML)', valor: prep.base_gravable != null ? fmtCOP(prep.base_gravable) : '—', destacar: false },
                          { label: 'IVA (XML)', valor: prep.valor_iva != null ? fmtCOP(prep.valor_iva) : '—', destacar: false },
                          { label: 'Neto tras retenciones', valor: fmtCOP(netoForm), destacar: true },
                        ].map(c => (
                          <div key={c.label} className="border border-gray-200 rounded-lg p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</p>
                            <p className={`text-sm font-semibold ${c.destacar ? 'text-cyan-700' : 'text-gray-800'}`}>{c.valor}</p>
                          </div>
                        ))}
                      </div>

                      <div className={`rounded-lg p-3 border flex items-start gap-2 ${cuadraForm ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        {cuadraForm ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <p className={`text-sm ${cuadraForm ? 'text-green-800' : 'text-red-700'}`}>
                          <strong>Cuadre aritmético:</strong> base {fmtCOP(baseForm)} + IVA {fmtCOP(ivaForm)} = {fmtCOP(brutoForm)}
                          {retForm > 0 && <> − retenciones {fmtCOP(retForm)} = {fmtCOP(netoForm)}</>}
                          {' '}vs total {fmtCOP(totalFactura)}.
                          {!cuadraForm && ' NO cuadra: corrige base/IVA/retenciones — el sistema no causa descuadrado (regla #11).'}
                        </p>
                      </div>

                      {/* Documento y proveedor */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>Prefijo docto.</label>
                          <input className={inputCls} value={form.prefijo_docto_proveedor}
                            onChange={e => setForm({ ...form, prefijo_docto_proveedor: e.target.value.toUpperCase() })} />
                        </div>
                        <div>
                          <label className={labelCls}>
                            Número docto.{' '}
                            <span className={form.numero_docto_proveedor.length > 8 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ({form.numero_docto_proveedor.length}/8)
                            </span>
                          </label>
                          <input
                            className={inputCls}
                            style={form.numero_docto_proveedor.length > 8 ? { borderColor: '#dc2626' } : undefined}
                            value={form.numero_docto_proveedor}
                            onChange={e => setForm({ ...form, numero_docto_proveedor: e.target.value })}
                          />
                          {form.numero_docto_proveedor.length > 8 && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, numero_docto_proveedor: form.numero_docto_proveedor.slice(-8) })}
                              className="mt-1 text-xs text-cyan-700 hover:underline"
                            >
                              El conector permite máx. 8 — usar últimos 8: <strong>{form.numero_docto_proveedor.slice(-8)}</strong>
                            </button>
                          )}
                        </div>
                        <div>
                          <label className={labelCls}>Tipo proveedor</label>
                          <select className={inputCls} value={form.tipo_proveedor}
                            onChange={e => setForm({ ...form, tipo_proveedor: e.target.value })}>
                            <option value="">— Seleccionar —</option>
                            {Object.entries(maestros?.tipos_proveedor ?? {}).map(([code, nombre]) => (
                              <option key={code} value={code}>{code} · {nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Condición de pago</label>
                          <select className={inputCls} value={form.cond_pago}
                            onChange={e => setForm({ ...form, cond_pago: e.target.value })}>
                            <option value="">— Seleccionar —</option>
                            {Object.keys(maestros?.condiciones_pago ?? {}).map(code => (
                              <option key={code} value={code}>{code}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Renglón de servicio */}
                      {renglon && (
                        <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Renglón de servicio</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Código de servicio</label>
                              <input className={inputCls} value={renglon.codigo_servicio}
                                placeholder="CS4515-1"
                                onChange={e => setRenglon('codigo_servicio', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelCls}>Centro de costo Siesa</label>
                              <select className={inputCls} value={renglon.centro_costo}
                                onChange={e => setRenglon('centro_costo', e.target.value)}>
                                <option value="">— Seleccionar —</option>
                                {Object.entries(maestros?.centros_costo ?? {}).map(([code, nombre]) => (
                                  <option key={code} value={code}>{code} · {nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Motivo</label>
                              <select className={inputCls} value={renglon.motivo}
                                onChange={e => setRenglon('motivo', e.target.value)}>
                                <option value="">— Seleccionar —</option>
                                {Object.entries(maestros?.motivos ?? {}).map(([code, nombre]) => (
                                  <option key={code} value={code}>{code} · {nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Base gravable ($)</label>
                              <input className={inputCls} type="number" value={renglon.valor_bruto}
                                onChange={e => setRenglon('valor_bruto', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelCls}>IVA ($)</label>
                              <input className={inputCls} type="number" value={renglon.valor_iva}
                                onChange={e => setRenglon('valor_iva', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Llave IVA</label>
                                <input className={inputCls} maxLength={4} placeholder="0010"
                                  value={renglon.llave_impuesto ?? ''}
                                  onChange={e => setRenglon('llave_impuesto', e.target.value)} />
                              </div>
                              <div>
                                <label className={labelCls}>Tasa %</label>
                                <input className={inputCls} type="number" placeholder="19"
                                  value={renglon.tasa_iva ?? ''}
                                  onChange={e => setRenglon('tasa_iva', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={labelCls}>
                          Notas (obligatorias — el ERP exige este campo en el movimiento)
                        </label>
                        <input
                          className={inputCls}
                          maxLength={250}
                          value={form.notas ?? ''}
                          onChange={e => setForm({ ...form, notas: e.target.value })}
                        />
                      </div>

                      {/* Retenciones (parametrización propia) */}
                      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            Retenciones que aplica Café Quindío
                          </p>
                          <button type="button" onClick={agregarRetencion}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        </div>
                        {form.retenciones.length === 0 ? (
                          <p className="text-sm text-gray-500">Sin retenciones parametrizadas para este proveedor.</p>
                        ) : (
                          form.retenciones.map((ret, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                              <div>
                                <label className={labelCls}>Llave</label>
                                <input className={inputCls} maxLength={4} placeholder="1040" value={ret.llave}
                                  onChange={e => setRetencion(idx, 'llave', e.target.value)} />
                              </div>
                              <div>
                                <label className={labelCls}>Tasa %</label>
                                <input className={inputCls} type="number" placeholder="2.5" value={ret.tasa}
                                  onChange={e => setRetencion(idx, 'tasa', e.target.value)} />
                              </div>
                              <div>
                                <label className={labelCls}>Clase base</label>
                                <input className={inputCls} maxLength={3} value={ret.clase_imp_base}
                                  onChange={e => setRetencion(idx, 'clase_imp_base', e.target.value)} />
                              </div>
                              <div>
                                <label className={labelCls}>Base mínima ($)</label>
                                <input className={inputCls} type="number" value={ret.base_minima}
                                  onChange={e => setRetencion(idx, 'base_minima', e.target.value)} />
                              </div>
                              <button type="button" onClick={() => quitarRetencion(idx)}
                                className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 justify-self-start">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                        {prep.retenciones_xml.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-800">
                              <p className="font-medium mb-0.5">
                                El emisor declaró en el XML (solo referencia — la retención la define
                                Café Quindío como agente retenedor, no el proveedor):
                              </p>
                              {prep.retenciones_xml.map((r, i) => (
                                <p key={i}>
                                  · {r.esquema_nombre || r.esquema_id || 'Retención'}
                                  {r.porcentaje != null && ` ${r.porcentaje}%`}
                                  {r.valor != null && ` → ${fmtCOP(r.valor)}`}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Problemas detectados por el backend */}
                      {prep.problemas.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1">
                            Revisar antes de causar
                          </p>
                          <ul className="text-sm text-amber-800 space-y-0.5">
                            {prep.problemas.map((p, i) => <li key={i}>• {p}</li>)}
                          </ul>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={guardarDefault}
                          onChange={e => setGuardarDefault(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Guardar estos datos como default del proveedor {prep.nit_normalizado || ''}
                      </label>
                    </>
                  )}

                  {exito && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{exito}</span>
                    </div>
                  )}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 whitespace-pre-line">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {yaCausada
                  ? 'Factura ya causada en Siesa.'
                  : envioDudoso
                  ? 'Verifica el envío dudoso antes de reintentar.'
                  : !prep?.habilitado
                  ? 'Integración deshabilitada en el servidor.'
                  : !numeroDoctoValido
                  ? 'El número del documento supera los 8 caracteres del conector.'
                  : !cuadraForm
                  ? 'El cuadre aritmético no da: no se puede causar.'
                  : 'El ERP asigna el número FSP definitivo.'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  Cerrar
                </button>
                {!yaCausada && (
                  <button
                    type="button"
                    onClick={handleCausar}
                    disabled={!puedeEnviar}
                    style={{ backgroundColor: !puedeEnviar ? '#9ca3af' : '#00829a' }}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Causando…' : 'Causar en Siesa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
