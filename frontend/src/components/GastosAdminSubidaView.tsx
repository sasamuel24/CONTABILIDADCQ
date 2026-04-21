import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadFacturaFile, API_BASE_URL, getAccessToken } from '../lib/api';

const GADMIN_AREA_ID = 'c1589d0c-736b-4af4-89f2-81900d2dac16';
const API_KEY = 'mi-api-key-secreta-2025';

interface FormData {
  proveedor: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: string;
  nit_emisor: string;
}

const EMPTY_FORM: FormData = {
  proveedor: '',
  numero_factura: '',
  fecha_emision: '',
  fecha_vencimiento: '',
  total: '',
  nit_emisor: '',
};

export function GastosAdminSubidaView() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');
  const [facturaCreada, setFacturaCreada] = useState<{ id: string; numero: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
  };

  const limpiar = () => {
    setForm(EMPTY_FORM);
    setPdfFile(null);
    setEstado('idle');
    setMensaje('');
    setFacturaCreada(null);
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
      // 1. Crear la factura
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
      const facturaId: string = factura.id;

      // 2. Subir el PDF
      await uploadFacturaFile(facturaId, 'FACTURA_PDF', pdfFile);

      setEstado('ok');
      setFacturaCreada({ id: facturaId, numero: form.numero_factura.trim() });
      setMensaje(`Factura ${form.numero_factura.trim()} creada y PDF adjunto exitosamente.`);
    } catch (err) {
      setEstado('error');
      setMensaje(err instanceof Error ? err.message : 'Error al procesar la solicitud.');
    }
  };

  const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none transition-all`;
  const labelCls = `block text-sm font-medium text-gray-700 mb-1`;

  if (estado === 'ok' && facturaCreada) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12">
        <div className="bg-white border border-green-200 rounded-xl p-8 text-center shadow-sm">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#00829a' }} />
          <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Neutra Text Bold, Montserrat, sans-serif' }}>
            ¡Factura cargada exitosamente!
          </h2>
          <p className="text-gray-500 text-sm mb-6">{mensaje}</p>
          <button
            onClick={limpiar}
            className="px-6 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text, Montserrat, sans-serif' }}
          >
            Subir otra factura
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
          Completa los datos de la factura y adjunta el PDF. El área se asigna automáticamente a Gastos Fijos Café Quindío.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">

        {/* Proveedor */}
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

        {/* N° Factura */}
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

        {/* Fechas */}
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

        {/* Total */}
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

        {/* PDF Upload */}
        <div>
          <label className={labelCls} style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
            PDF de la Factura <span className="text-red-500">*</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors"
            style={{
              borderColor: pdfFile ? '#00829a' : '#d1d5db',
              backgroundColor: pdfFile ? 'rgba(20,170,184,0.05)' : '#fafafa',
            }}
            onMouseEnter={e => { if (!pdfFile) e.currentTarget.style.borderColor = '#14aab8'; }}
            onMouseLeave={e => { if (!pdfFile) e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            {pdfFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-6 h-6" style={{ color: '#00829a' }} />
                <span className="text-sm font-medium text-gray-800" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                  {pdfFile.name}
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                  Arrastra el PDF aquí o <span style={{ color: '#00829a' }} className="font-medium">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>
                  Solo archivos PDF
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

        {/* Mensaje de error */}
        {estado === 'error' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span style={{ fontFamily: 'Neutra Text, Montserrat, sans-serif' }}>{mensaje}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={estado === 'loading'}
          className="w-full py-3 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#00829a', fontFamily: 'Neutra Text Demi, Montserrat, sans-serif' }}
        >
          {estado === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Procesando...
            </span>
          ) : (
            'Subir Factura'
          )}
        </button>
      </form>
    </div>
  );
}
