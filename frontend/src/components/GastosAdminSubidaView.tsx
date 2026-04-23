import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Sparkles, Scan, Loader2 } from 'lucide-react';
import { uploadFacturaFile, API_BASE_URL, getAccessToken, extraerDatosFacturaPdf } from '../lib/api';
import { toast } from 'sonner';

const GADMIN_AREA_ID = 'c1589d0c-736b-4af4-89f2-81900d2dac16';
const API_KEY = 'mi-api-key-secreta-2025';

interface FormData {
  proveedor: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: string;
}

const EMPTY_FORM: FormData = {
  proveedor: '',
  numero_factura: '',
  fecha_emision: '',
  fecha_vencimiento: '',
  total: '',
};

export function GastosAdminSubidaView() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const escanearPdf = async (file: File) => {
    setEscaneando(true);
    try {
      const datos = await extraerDatosFacturaPdf(file);

      const patch: Partial<FormData> = {};
      if (datos.proveedor)        patch.proveedor        = datos.proveedor;
      if (datos.numero_factura)   patch.numero_factura   = datos.numero_factura;
      if (datos.fecha_emision)    patch.fecha_emision    = datos.fecha_emision;
      if (datos.fecha_vencimiento) patch.fecha_vencimiento = datos.fecha_vencimiento;
      if (datos.total)            patch.total            = datos.total;

      if (Object.keys(patch).length > 0) {
        setForm(prev => ({ ...prev, ...patch }));
      }

      const n = datos.campos_detectados.length;
      if (n === 0) {
        toast.warning('No se detectaron datos en el PDF. Completa los campos manualmente.');
      } else {
        const emoji = datos.confianza === 'alta' ? '✅' : datos.confianza === 'media' ? '⚠️' : '🔍';
        toast.success(`${emoji} ${n} campo${n !== 1 ? 's' : ''} completado${n !== 1 ? 's' : ''} automáticamente`);
      }
    } catch {
      toast.error('No se pudo analizar el PDF. Completa los campos manualmente.');
    } finally {
      setEscaneando(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setEstado('error');
      setMensaje('Solo se permiten archivos PDF.');
      return;
    }
    setPdfFile(f);
    setEstado('idle');
    setMensaje('');
    escanearPdf(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setEstado('error');
      setMensaje('Solo se permiten archivos PDF.');
      return;
    }
    setPdfFile(f);
    setEstado('idle');
    setMensaje('');
    escanearPdf(f);
  };

  const limpiar = () => {
    setForm(EMPTY_FORM);
    setPdfFile(null);
    setEstado('idle');
    setMensaje('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfFile) {
      setEstado('error');
      setMensaje('Debes adjuntar el PDF de la factura.');
      return;
    }

    const totalNum = parseFloat(form.total.replace(/,/g, '.'));
    if (isNaN(totalNum) || totalNum <= 0) {
      setEstado('error');
      setMensaje('El total debe ser un número mayor a cero.');
      return;
    }

    setEstado('loading');
    setMensaje('');

    try {
      const token = getAccessToken();
      const body = {
        proveedor: form.proveedor.trim(),
        numero_factura: form.numero_factura.trim(),
        fecha_emision: form.fecha_emision || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        total: totalNum,
        area_id: GADMIN_AREA_ID,
        estado_id: 1,
        es_gasto_adm: true,
      };

      const res = await fetch(`${API_BASE_URL}/facturas/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status} al crear la factura`);
      }

      const factura = await res.json();
      await uploadFacturaFile(factura.id, 'FACTURA_PDF', pdfFile);

      setEstado('ok');
      setMensaje(`Factura ${form.numero_factura.trim()} registrada. Ábrela desde la Bandeja de Entrada para adjuntar el Soporte de Gasto Fijo y enviarla a Tesorería.`);
    } catch (err) {
      setEstado('error');
      setMensaje(err instanceof Error ? err.message : 'Error al procesar la solicitud.');
    }
  };

  const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none transition-all`;
  const labelCls = `block text-sm font-medium text-gray-700 mb-1`;

  if (estado === 'ok') {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12">
        <div className="bg-white border border-green-200 rounded-xl p-8 text-center shadow-sm">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#00829a' }} />
          <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            ¡Factura registrada!
          </h2>
          <p className="text-gray-500 text-sm mb-6" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>{mensaje}</p>
          <button
            onClick={limpiar}
            className="px-6 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
          >
            Registrar otra factura
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
          Subida Manual de Facturas
        </h2>
        <p className="text-sm text-gray-400 mt-0.5" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
          Completa los datos y adjunta el PDF. Luego desde la Bandeja de Entrada podrás agregar el Soporte de Gasto Fijo y enviar a Tesorería.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">

        {/* PDF Upload — va primero para que el escáner IA pre-llene los campos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif', marginBottom: 0 }}>
              PDF de la Factura <span className="text-red-500">*</span>
            </label>
            {pdfFile && !escaneando && (
              <button
                type="button"
                onClick={() => escanearPdf(pdfFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  color: '#7c3aed',
                  borderColor: '#ddd6fe',
                  backgroundColor: '#f5f3ff',
                  fontFamily: 'Neutra Text Demi, Montserrat, sans-serif',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <Scan className="w-3.5 h-3.5" />
                Re-escanear con IA
              </button>
            )}
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !escaneando && fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-5 text-center transition-colors"
            style={{
              borderColor: pdfFile ? '#00829a' : '#d1d5db',
              backgroundColor: pdfFile ? 'rgba(20,170,184,0.05)' : '#fafafa',
              cursor: escaneando ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (!pdfFile && !escaneando) e.currentTarget.style.borderColor = '#14aab8'; }}
            onMouseLeave={e => { if (!pdfFile && !escaneando) e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            {escaneando ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c3aed' }} />
                  <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#7c3aed', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}>
                  Analizando factura con IA...
                </p>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Claude Sonnet está leyendo el PDF y extrayendo los datos
                </p>
              </div>
            ) : pdfFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-6 h-6" style={{ color: '#00829a' }} />
                <span className="text-sm font-medium text-gray-800" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                  {pdfFile.name}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setPdfFile(null);
                    setForm(EMPTY_FORM);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Upload className="w-7 h-7 text-gray-400" />
                  <Sparkles className="w-5 h-5" style={{ color: '#7c3aed' }} />
                </div>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                  Arrastra el PDF aquí o <span style={{ color: '#00829a' }} className="font-medium">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
                  Solo archivos PDF · La IA completará los campos automáticamente
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {/* Separador con label IA */}
        {pdfFile && !escaneando && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 flex items-center gap-1" style={{ fontFamily: 'Neutra Text Book, Montserrat, sans-serif' }}>
              <Sparkles className="w-3 h-3" style={{ color: '#7c3aed' }} />
              Revisa y ajusta los campos completados por IA
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
        )}

        <div>
          <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
            Proveedor <span className="text-red-500">*</span>
          </label>
          <input
            name="proveedor"
            value={form.proveedor}
            onChange={handleChange}
            required
            placeholder="Nombre del proveedor o empresa"
            className={inputCls}
            style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
            onBlur={e => e.currentTarget.style.boxShadow = ''}
          />
        </div>

        <div>
          <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
            N° Factura <span className="text-red-500">*</span>
          </label>
          <input
            name="numero_factura"
            value={form.numero_factura}
            onChange={handleChange}
            required
            placeholder="Ej: FV-2024-001"
            className={inputCls}
            style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
            onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
            onBlur={e => e.currentTarget.style.boxShadow = ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
              Fecha de Emisión <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="fecha_emision"
              value={form.fecha_emision}
              onChange={handleChange}
              required
              className={inputCls}
              style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
              onBlur={e => e.currentTarget.style.boxShadow = ''}
            />
          </div>
          <div>
            <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
              Fecha de Vencimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="fecha_vencimiento"
              value={form.fecha_vencimiento}
              onChange={handleChange}
              required
              className={inputCls}
              style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
              onBlur={e => e.currentTarget.style.boxShadow = ''}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
            Total a Pagar (COP) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              name="total"
              value={form.total}
              onChange={handleChange}
              required
              placeholder="0.00"
              className={`${inputCls} pl-6`}
              style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,170,184,0.4)'}
              onBlur={e => e.currentTarget.style.boxShadow = ''}
            />
          </div>
        </div>

        {estado === 'error' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>{mensaje}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={estado === 'loading' || escaneando}
          className="w-full py-3 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          {estado === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registrando...
            </span>
          ) : escaneando ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analizando PDF...
            </span>
          ) : (
            'Registrar Factura'
          )}
        </button>
      </form>
    </div>
  );
}
