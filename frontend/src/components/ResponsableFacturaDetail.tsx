import { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Eye, Download, FileText, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion, InventariosData, UnidadNegocio, CuentaAuxiliar, DistribucionCCCO } from '../lib/api';
import { 
  uploadFacturaFile, 
  getFacturaFilesByDocType,
  getCentrosCosto,
  getCentrosOperacion,
  updateFacturaCentros,
  getUnidadesNegocio,
  updateFacturaUnidadNegocio,
  getCuentasAuxiliares,
  updateFacturaCuentaAuxiliar,
  getFacturaInventarios,
  updateFacturaInventarios,
  updateFacturaAnticipo,
  asignarFactura,
  updateFactura,
  getDistribucionCCCO,
  updateDistribucionCCCO,
  API_BASE_URL,
  downloadFileById,
  devolverAFacturacion,
  deleteFacturaFile
} from '../lib/api';
import { DistribucionCCCOTable } from './DistribucionCCCOTable';
import { FilePreviewModal } from './FilePreviewModal';
import { ConfirmModal } from './ConfirmModal';
import { ComentariosFactura } from './ComentariosFactura';
import { useAuth } from '../contexts/AuthContext';

interface ResponsableFacturaDetailProps {
  factura: FacturaListItem;
  onClose: () => void;
}

const statusConfig: Record<string, { color: string; bgColor: string }> = {
  'Recibida': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  'Pendiente': { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  'Asignada': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  'En Curso': { color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  'Cerrada': { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  'Rechazada': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};



const INTERVALOS_ENTREGA = [
  { value: '1_SEMANA', label: '1 Semana' },
  { value: '2_SEMANAS', label: '2 Semanas' },
  { value: '3_SEMANAS', label: '3 Semanas' },
  { value: '1_MES', label: '1 Mes' },
];

export function ResponsableFacturaDetail({ factura, onClose }: ResponsableFacturaDetailProps) {
  const { user } = useAuth();
  // Estados para modal de devolución a Facturación
  const [mostrarModalDevolucion, setMostrarModalDevolucion] = useState(false);
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [enviandoDevolucion, setEnviandoDevolucion] = useState(false);
  
  // Estados para archivos
  const [archivoOC, setArchivoOC] = useState<string>('');
  const [archivoAprobacion, setArchivoAprobacion] = useState<string>('');
  const [archivoInventario, setArchivoInventario] = useState<string>('');
  const [archivoNotaCredito, setArchivoNotaCredito] = useState<string>('');

  // Estados para archivos existentes (ya subidos)
  const [archivosOCExistentes, setArchivosOCExistentes] = useState<FileMiniOut[]>([]);
  const [archivoAprobacionExistente, setArchivoAprobacionExistente] = useState<FileMiniOut | null>(null);
  const [soportePagoFiles, setSoportePagoFiles] = useState<FileMiniOut[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);

  // Estados de loading para uploads
  const [uploadingOC, setUploadingOC] = useState(false);
  const [uploadingAprobacion, setUploadingAprobacion] = useState(false);
  const [uploadingInventario, setUploadingInventario] = useState(false);
  
  // Estados de loading para eliminación
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // Estados para Centro de Costo y Operación (obligatorios)
  // Inicializar con los valores de la factura si existen
  const [centroCosto, setCentroCosto] = useState(factura.centro_costo_id || '');
  const [centroOperacion, setCentroOperacion] = useState(factura.centro_operacion_id || '');
  
  // Listas de centros desde el backend
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [centrosOperacion, setCentrosOperacion] = useState<CentroOperacion[]>([]);
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [savingCentros, setSavingCentros] = useState(false);

  // Estados para Unidad de Negocio
  const [unidadNegocio, setUnidadNegocio] = useState(factura.unidad_negocio_id || '');
  const [unidadesNegocio, setUnidadesNegocio] = useState<UnidadNegocio[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [savingUnidad, setSavingUnidad] = useState(false);

  // Estados para Cuenta Auxiliar
  const [cuentaAuxiliar, setCuentaAuxiliar] = useState(factura.cuenta_auxiliar_id || '');
  const [cuentasAuxiliares, setCuentasAuxiliares] = useState<CuentaAuxiliar[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [savingCuenta, setSavingCuenta] = useState(false);

  // Estados para Inventarios
  const [requiereInventario, setRequiereInventario] = useState(false);
  const [tipoIngreso, setTipoIngreso] = useState<'tienda' | 'almacen' | ''>('');
  const [presentaNovedad, setPresentaNovedad] = useState(false);
  const [loadingInventarios, setLoadingInventarios] = useState(true);
  const [savingInventarios, setSavingInventarios] = useState(false);
  const [savingNovedad, setSavingNovedad] = useState(false);
  const [savingAnticipo, setSavingAnticipo] = useState(false);
  const [savingIntervalo, setSavingIntervalo] = useState(false);
  const [enviandoContabilidad, setEnviandoContabilidad] = useState(false);

  // Campos de Tienda
  const [oct, setOct] = useState('');
  const [ect, setEct] = useState('');
  const [fpcTienda, setFpcTienda] = useState('');

  // Campos de Almacén
  const [occ, setOcc] = useState('');
  const [edo, setEdo] = useState('');
  const [fpcAlmacen, setFpcAlmacen] = useState('');

  // Novedad
  const [tieneNovedad, setTieneNovedad] = useState(false);
  const [numeroNotaCredito, setNumeroNotaCredito] = useState('');

  // Anticipo
  const [tieneAnticipo, setTieneAnticipo] = useState(false);
  const [porcentajeAnticipo, setPorcentajeAnticipo] = useState('');
  const [intervaloEntrega, setIntervaloEntrega] = useState('1_SEMANA');

  // Errores de validación
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mostrarValidacion, setMostrarValidacion] = useState(false);

  // Estado para Gasto Administrativo
  const [esGastoAdm, setEsGastoAdm] = useState(factura.es_gasto_adm || false);

  // Estados para Distribución CC/CO
  const [distribuciones, setDistribuciones] = useState<DistribucionCCCO[]>([]);
  const [loadingDistribucion, setLoadingDistribucion] = useState(true);
  const [savingDistribucion, setSavingDistribucion] = useState(false);

  // Estados para vista previa
  const [previewFile, setPreviewFile] = useState<FileMiniOut | null>(null);
  
  // Estados para modales de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({ title: '', message: '', type: 'info' });

  // Cargar archivos existentes al montar el componente
  useEffect(() => {
    const cargarArchivosExistentes = async () => {
      try {
        setLoadingArchivos(true);
        
        const [archivosOC, archivosAprobacion, archivosSoportePago] = await Promise.all([
          getFacturaFilesByDocType(factura.id, 'OC'),
          getFacturaFilesByDocType(factura.id, 'APROBACION_GERENCIA'),
          getFacturaFilesByDocType(factura.id, 'FACTURA_PDF')
        ]);
        
        // Cargar todos los archivos OC/OS
        setArchivosOCExistentes(archivosOC);
        
        if (archivosAprobacion.length > 0) {
          setArchivoAprobacionExistente(archivosAprobacion[0]);
        }
        
        setSoportePagoFiles(archivosSoportePago);
      } catch (error) {
        console.error('Error cargando archivos existentes:', error);
      } finally {
        setLoadingArchivos(false);
      }
    };

    cargarArchivosExistentes();
  }, [factura.id]);

  // Cargar centros de costo al montar el componente
  useEffect(() => {
    const cargarCentrosCosto = async () => {
      try {
        setLoadingCentros(true);
        const centros = await getCentrosCosto(true);
        setCentrosCosto(centros);
      } catch (error) {
        console.error('Error cargando centros de costo:', error);
        toast.error('Error al cargar centros de costo');
      } finally {
        setLoadingCentros(false);
      }
    };

    cargarCentrosCosto();
  }, []);

  // Cargar unidades de negocio al montar el componente
  useEffect(() => {
    const cargarUnidadesNegocio = async () => {
      try {
        setLoadingUnidades(true);
        const unidades = await getUnidadesNegocio(true);
        setUnidadesNegocio(unidades);
      } catch (error) {
        console.error('Error cargando unidades de negocio:', error);
        toast.error('Error al cargar unidades de negocio');
      } finally {
        setLoadingUnidades(false);
      }
    };

    cargarUnidadesNegocio();
  }, []);

  // Cargar cuentas auxiliares al montar el componente
  useEffect(() => {
    const cargarCuentasAuxiliares = async () => {
      try {
        setLoadingCuentas(true);
        const cuentas = await getCuentasAuxiliares(true);
        setCuentasAuxiliares(cuentas);
      } catch (error) {
        console.error('Error cargando cuentas auxiliares:', error);
        toast.error('Error al cargar cuentas auxiliares');
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentasAuxiliares();
  }, []);

  // Cargar centros de operación al montar el componente (todos, sin filtro)
  useEffect(() => {
    const cargarCentrosOperacion = async () => {
      try {
        // Cargar todos los centros de operación sin filtrar por CC
        const todosCentrosCosto = await getCentrosCosto(true);
        const allCentrosOperacion = [];
        
        for (const cc of todosCentrosCosto) {
          const centros = await getCentrosOperacion(cc.id, true);
          allCentrosOperacion.push(...centros);
        }
        
        setCentrosOperacion(allCentrosOperacion);
      } catch (error) {
        console.error('Error cargando centros de operación:', error);
      } finally {
        setLoadingCentros(false);
      }
    };

    cargarCentrosOperacion();
  }, []);

  // Cargar datos de inventarios al montar el componente
  useEffect(() => {
    const cargarInventarios = () => {
      try {
        setLoadingInventarios(true);
        
        // Usar los datos que ya vienen en la factura
        setRequiereInventario(factura.requiere_entrada_inventarios);
        setTieneNovedad(factura.presenta_novedad);
        
        // Buscar código NP si existe
        const npCodigo = factura.inventarios_codigos.find(c => c.codigo === 'NP');
        if (npCodigo) {
          setNumeroNotaCredito(npCodigo.valor);
        }
        
        if (factura.requiere_entrada_inventarios && factura.destino_inventarios) {
          setTipoIngreso(factura.destino_inventarios === 'TIENDA' ? 'tienda' : 'almacen');
          
          // Cargar códigos según el tipo
          if (factura.destino_inventarios === 'TIENDA') {
            const octCodigo = factura.inventarios_codigos.find(c => c.codigo === 'OCT');
            const ectCodigo = factura.inventarios_codigos.find(c => c.codigo === 'ECT');
            const fpcCodigo = factura.inventarios_codigos.find(c => c.codigo === 'FPC');
            
            if (octCodigo) setOct(octCodigo.valor);
            if (ectCodigo) setEct(ectCodigo.valor);
            if (fpcCodigo) setFpcTienda(fpcCodigo.valor);
          } else if (factura.destino_inventarios === 'ALMACEN') {
            const occCodigo = factura.inventarios_codigos.find(c => c.codigo === 'OCC');
            const edoCodigo = factura.inventarios_codigos.find(c => c.codigo === 'EDO');
            const fpcCodigo = factura.inventarios_codigos.find(c => c.codigo === 'FPC');
            
            if (occCodigo) setOcc(occCodigo.valor);
            if (edoCodigo) setEdo(edoCodigo.valor);
            if (fpcCodigo) setFpcAlmacen(fpcCodigo.valor);
          }
        }
      } catch (error) {
        console.error('Error cargando inventarios:', error);
      } finally {
        setLoadingInventarios(false);
      }
    };

    cargarInventarios();
  }, [factura.id, factura.requiere_entrada_inventarios, factura.destino_inventarios, factura.inventarios_codigos]);

  // Cargar datos de anticipo al montar el componente
  useEffect(() => {
    const cargarAnticipo = () => {
      try {
        // Usar los datos que ya vienen en la factura
        setTieneAnticipo(factura.tiene_anticipo);
        
        if (factura.porcentaje_anticipo !== null) {
          setPorcentajeAnticipo(factura.porcentaje_anticipo.toString());
        }
        
        if (factura.intervalo_entrega_contabilidad) {
          setIntervaloEntrega(factura.intervalo_entrega_contabilidad);
        }
      } catch (error) {
        console.error('Error cargando anticipo:', error);
      }
    };

    cargarAnticipo();
  }, [factura.id, factura.tiene_anticipo, factura.porcentaje_anticipo, factura.intervalo_entrega_contabilidad]);

  // Cargar distribuciones CC/CO al montar el componente
  useEffect(() => {
    const cargarDistribuciones = async () => {
      try {
        setLoadingDistribucion(true);
        const dist = await getDistribucionCCCO(factura.id);
        setDistribuciones(dist);
      } catch (error) {
        console.error('Error cargando distribuciones:', error);
      } finally {
        setLoadingDistribucion(false);
      }
    };

    cargarDistribuciones();
  }, [factura.id]);

  // Guardar todos los campos de clasificación (CC, CO, UN, CA)
  const handleGuardarClasificacion = async () => {
    if (!centroCosto || !centroOperacion) {
      toast.warning('Debe seleccionar Centro de Costo y Centro de Operación');
      return;
    }

    try {
      setSavingCentros(true);
      setSavingUnidad(true);
      setSavingCuenta(true);

      // Guardar centros (obligatorios)
      await updateFacturaCentros(factura.id, {
        centro_costo_id: centroCosto,
        centro_operacion_id: centroOperacion
      });

      // Guardar unidad de negocio (opcional)
      await updateFacturaUnidadNegocio(factura.id, unidadNegocio || null);

      // Guardar cuenta auxiliar (opcional)
      await updateFacturaCuentaAuxiliar(factura.id, cuentaAuxiliar || null);

      toast.success('Clasificación actualizada correctamente');
      
    } catch (error: any) {
      console.error('Error guardando clasificación:', error);
      toast.error(`Error al guardar: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingCentros(false);
      setSavingUnidad(false);
      setSavingCuenta(false);
    }
  };

  // Guardar estado de Gasto Administrativo
  const handleToggleEsGastoAdm = async (nuevoValor: boolean) => {
    try {
      await updateFactura(factura.id, { es_gasto_adm: nuevoValor });
      setEsGastoAdm(nuevoValor);
      
      // Mostrar modal de éxito
      const mensaje = nuevoValor 
        ? 'Marcado como gasto administrativo. OC y Aprobación ya no son obligatorios.' 
        : 'Desmarcado como gasto administrativo. OC y Aprobación son obligatorios.';
      
      const modalDiv = document.createElement('div');
      modalDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 24px 32px;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          z-index: 10000;
          min-width: 350px;
          max-width: 500px;
          font-family: 'Neutra Text', 'Montserrat', sans-serif;
        ">
          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
            <div style="
              width: 40px;
              height: 40px;
              background: #dcfce7;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              flex-shrink: 0;
            ">✓</div>
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">Sistema de facturación dice:</h3>
              <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${mensaje}</p>
            </div>
          </div>
          <button onclick="this.closest('div').parentElement.remove()" style="
            width: 100%;
            padding: 10px;
            background: #00829a;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            font-family: 'Neutra Text', 'Montserrat', sans-serif;
          " onmouseover="this.style.background='#14aab8'" onmouseout="this.style.background='#00829a'">
            Aceptar
          </button>
        </div>
      `;
      
      const backdrop = document.createElement('div');
      backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      `;
      backdrop.onclick = () => backdrop.remove();
      
      document.body.appendChild(backdrop);
      backdrop.appendChild(modalDiv);
      
    } catch (error: any) {
      console.error('Error actualizando es_gasto_adm:', error);
      alert(`❌ Error al actualizar: ${error.message || 'Error desconocido'}`);
    }
  };

  // Guardar novedad de producto
  const handleGuardarNovedad = async () => {
    // Validar que si tiene novedad, tenga el número de nota de crédito
    if (tieneNovedad && !numeroNotaCredito) {
      toast.warning('Debe ingresar el número de Nota de Crédito (NP)');
      return;
    }

    try {
      setSavingNovedad(true);
      
      // Construir payload con los datos actuales de inventarios
      const codigos = tipoIngreso === 'tienda' 
        ? [
            { codigo: 'OCT', valor: oct || '' },
            { codigo: 'ECT', valor: ect || '' },
            { codigo: 'FPC', valor: fpcTienda || '' }
          ].filter(c => c.valor) // Solo enviar los que tienen valor
        : [
            { codigo: 'OCC', valor: occ || '' },
            { codigo: 'EDO', valor: edo || '' },
            { codigo: 'FPC', valor: fpcAlmacen || '' }
          ].filter(c => c.valor);

      // Si tiene novedad, agregar el código NP
      if (tieneNovedad && numeroNotaCredito) {
        codigos.push({ codigo: 'NP', valor: numeroNotaCredito });
      }

      await updateFacturaInventarios(factura.id, {
        requiere_entrada_inventarios: requiereInventario,
        destino_inventarios: tipoIngreso === 'tienda' ? 'TIENDA' : tipoIngreso === 'almacen' ? 'ALMACEN' : null,
        presenta_novedad: tieneNovedad,
        codigos: codigos.length > 0 ? codigos : undefined
      });
      
      toast.success('Novedad actualizada correctamente');
    } catch (error: any) {
      console.error('Error guardando novedad:', error);
      toast.error(`Error al guardar novedad: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingNovedad(false);
    }
  };

  // Guardar anticipo
  const handleGuardarAnticipo = async () => {
    // Validar que si tiene anticipo, tenga el porcentaje
    if (tieneAnticipo && !porcentajeAnticipo) {
      toast.warning('Debe ingresar el porcentaje de anticipo');
      return;
    }

    // Validar rango de porcentaje
    const porcentaje = parseFloat(porcentajeAnticipo);
    if (tieneAnticipo && (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
      toast.warning('El porcentaje de anticipo debe estar entre 0 y 100');
      return;
    }

    try {
      setSavingAnticipo(true);
      
      await updateFacturaAnticipo(factura.id, {
        tiene_anticipo: tieneAnticipo,
        porcentaje_anticipo: tieneAnticipo ? porcentaje : null,
        intervalo_entrega_contabilidad: intervaloEntrega
      });
      
      toast.success('Anticipo actualizado correctamente');
    } catch (error: any) {
      console.error('Error guardando anticipo:', error);
      toast.error(`Error al guardar anticipo: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingAnticipo(false);
    }
  };

  // Guardar intervalo de entrega
  const handleGuardarIntervalo = async () => {
    try {
      setSavingIntervalo(true);
      
      await updateFacturaAnticipo(factura.id, {
        tiene_anticipo: tieneAnticipo,
        porcentaje_anticipo: tieneAnticipo && porcentajeAnticipo ? parseFloat(porcentajeAnticipo) : null,
        intervalo_entrega_contabilidad: intervaloEntrega
      });
      
      toast.success('Intervalo de entrega actualizado correctamente');
    } catch (error: any) {
      console.error('Error guardando intervalo:', error);
      toast.error(`Error al guardar intervalo: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingIntervalo(false);
    }
  };

  // Guardar distribución CC/CO
  const handleGuardarDistribucion = async (distribuciones: Omit<DistribucionCCCO, 'id' | 'factura_id' | 'created_at' | 'updated_at'>[]) => {
    try {
      setSavingDistribucion(true);
      const distribucionesActualizadas = await updateDistribucionCCCO(factura.id, {
        distribuciones
      });
      setDistribuciones(distribucionesActualizadas);
      toast.success('Distribución CC/CO actualizada correctamente');
    } catch (error: any) {
      console.error('Error guardando distribución:', error);
      toast.error(`Error al guardar distribución: ${error.message || 'Error desconocido'}`);
      throw error;
    } finally {
      setSavingDistribucion(false);
    }
  };

  // Guardar todos los cambios de una vez
  const handleGuardarCambios = async () => {
    try {
      // Validaciones previas
      const erroresValidacion: string[] = [];

      // Validar inventarios si está activado
      if (requiereInventario) {
        if (!tipoIngreso) {
          erroresValidacion.push('Debe seleccionar el tipo de ingreso (Tienda o Almacén)');
        }
        if (tipoIngreso === 'tienda' && (!oct || !ect || !fpcTienda)) {
          erroresValidacion.push('Debe completar todos los campos de Tienda (OCT, ECT, FPC)');
        }
        if (tipoIngreso === 'almacen' && (!occ || !edo || !fpcAlmacen)) {
          erroresValidacion.push('Debe completar todos los campos de Almacén (OCC, EDO, FPC)');
        }
      }

      // Validar novedad
      if (tieneNovedad && !numeroNotaCredito) {
        erroresValidacion.push('Debe ingresar el número de Nota de Crédito (NP)');
      }

      // Validar anticipo
      if (tieneAnticipo) {
        const porcentaje = parseFloat(porcentajeAnticipo);
        if (!porcentajeAnticipo || isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
          erroresValidacion.push('El porcentaje de anticipo debe estar entre 0 y 100');
        }
      }

      if (erroresValidacion.length > 0) {
        alert('❌ Errores de validación:\n\n' + erroresValidacion.join('\n'));
        return;
      }

      // Iniciar guardado
      setSavingInventarios(true);
      setSavingNovedad(true);
      setSavingAnticipo(true);
      setSavingIntervalo(true);

      // 1. Guardar Inventarios
      const codigosInventario = [];
      if (requiereInventario) {
        if (tipoIngreso === 'tienda') {
          codigosInventario.push(
            { codigo: 'OCT', valor: oct },
            { codigo: 'ECT', valor: ect },
            { codigo: 'FPC', valor: fpcTienda }
          );
        } else if (tipoIngreso === 'almacen') {
          codigosInventario.push(
            { codigo: 'OCC', valor: occ },
            { codigo: 'EDO', valor: edo },
            { codigo: 'FPC', valor: fpcAlmacen }
          );
        }
      }

      // Si tiene novedad, agregar código NP
      if (tieneNovedad && numeroNotaCredito) {
        codigosInventario.push({ codigo: 'NP', valor: numeroNotaCredito });
      }

      await updateFacturaInventarios(factura.id, {
        requiere_entrada_inventarios: requiereInventario,
        destino_inventarios: requiereInventario 
          ? (tipoIngreso === 'tienda' ? 'TIENDA' : tipoIngreso === 'almacen' ? 'ALMACEN' : null)
          : null,
        presenta_novedad: tieneNovedad,
        codigos: codigosInventario.length > 0 ? codigosInventario : undefined
      });

      // 2. Guardar Anticipo e Intervalo
      const porcentaje = tieneAnticipo && porcentajeAnticipo ? parseFloat(porcentajeAnticipo) : null;
      await updateFacturaAnticipo(factura.id, {
        tiene_anticipo: tieneAnticipo,
        porcentaje_anticipo: porcentaje,
        intervalo_entrega_contabilidad: intervaloEntrega
      });

      setConfirmModalConfig({
        title: 'Cambios Guardados',
        message: 'Todos los cambios se han guardado correctamente en la factura.',
        type: 'success'
      });
      setShowConfirmModal(true);

    } catch (error: any) {
      console.error('Error guardando cambios:', error);
      alert(`❌ Error al guardar cambios: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingInventarios(false);
      setSavingNovedad(false);
      setSavingAnticipo(false);
      setSavingIntervalo(false);
    }
  };

  // Guardar inventarios
  const handleGuardarInventarios = async () => {
    if (!requiereInventario) {
      // Si no requiere, enviar solo eso
      try {
        setSavingInventarios(true);
        await updateFacturaInventarios(factura.id, {
          requiere_entrada_inventarios: false,
          destino_inventarios: null,
          presenta_novedad: false,
          codigos: []
        });
        
        alert('✅ Inventarios actualizados correctamente');
      } catch (error: any) {
        console.error('Error guardando inventarios:', error);
        alert(`❌ Error al guardar inventarios: ${error.message || 'Error desconocido'}`);
      } finally {
        setSavingInventarios(false);
      }
      return;
    }

    // Validar que tenga tipo de ingreso
    if (!tipoIngreso) {
      alert('❌ Debe seleccionar el tipo de ingreso (Tienda o Almacén)');
      return;
    }

    // Validar campos según el tipo
    if (tipoIngreso === 'tienda') {
      if (!oct || !ect || !fpcTienda) {
        alert('❌ Debe completar todos los campos de Tienda (OCT, ECT, FPC)');
        return;
      }
    } else if (tipoIngreso === 'almacen') {
      if (!occ || !edo || !fpcAlmacen) {
        alert('❌ Debe completar todos los campos de Almacén (OCC, EDO, FPC)');
        return;
      }
    }

    try {
      setSavingInventarios(true);
      
      const codigos = tipoIngreso === 'tienda' 
        ? [
            { codigo: 'OCT', valor: oct },
            { codigo: 'ECT', valor: ect },
            { codigo: 'FPC', valor: fpcTienda }
          ]
        : [
            { codigo: 'OCC', valor: occ },
            { codigo: 'EDO', valor: edo },
            { codigo: 'FPC', valor: fpcAlmacen }
          ];

      await updateFacturaInventarios(factura.id, {
        requiere_entrada_inventarios: true,
        destino_inventarios: tipoIngreso === 'tienda' ? 'TIENDA' : 'ALMACEN',
        presenta_novedad: presentaNovedad,
        codigos
      });
      
      alert('✅ Inventarios actualizados correctamente');
    } catch (error: any) {
      console.error('Error guardando inventarios:', error);
      alert(`❌ Error al guardar inventarios: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingInventarios(false);
    }
  };

  const handleVerDocumento = (fileId: string) => {
    // Abrir documento en nueva pestaña
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE_URL}/files/${fileId}/download`;
    
    // Abrir en nueva ventana con token en header (mediante fetch y blob)
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    })
    .catch(error => {
      console.error('Error al abrir documento:', error);
      alert('Error al abrir el documento');
    });
  };

  const handleDownloadFile = (storageProvider: string, storagePath: string, filename: string) => {
    try {
      if (storageProvider === 's3') {
        // Usar el filename tal cual (respeta extensión original: .pdf, .png, .jpg, etc.)
        const finalFilename = filename;
        
        // Usar endpoint proxy del backend para archivos S3
        const downloadUrl = `${API_BASE_URL}/facturas/${factura.id}/files/download?key=${encodeURIComponent(storagePath)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error al descargar archivo:', err);
      alert('Error al descargar el archivo');
    }
  };

  const handlePreviewFile = (file: FileMiniOut) => {
    setPreviewFile(file);
  };

  const handleDownloadById = async (file: FileMiniOut) => {
    try {
      const blob = await downloadFileById(file.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      alert('Error al descargar el archivo');
    }
  };

  const handleDeleteFile = async (fileId: string, tipo: 'oc' | 'aprobacion') => {
    const tipoTexto = tipo === 'oc' ? 'OC/OS' : 'Aprobación de Gerencia';
    
    setConfirmModalConfig({
      title: 'Eliminar Archivo',
      message: `¿Está seguro de que desea eliminar este archivo de ${tipoTexto}?\n\nEsta acción no se puede deshacer.`,
      type: 'warning',
      showCancel: true,
      onConfirm: async () => {
        try {
          setDeletingFileId(fileId);
          await deleteFacturaFile(fileId);
          
          // Actualizar el estado según el tipo
          if (tipo === 'oc') {
            setArchivosOCExistentes(prev => prev.filter(f => f.id !== fileId));
            toast.success('Archivo OC/OS eliminado correctamente');
          } else if (tipo === 'aprobacion') {
            setArchivoAprobacionExistente(null);
            toast.success('Archivo de Aprobación eliminado correctamente');
          }
        } catch (error: any) {
          console.error('Error eliminando archivo:', error);
          toast.error(`Error al eliminar archivo: ${error.message || 'Error desconocido'}`);
        } finally {
          setDeletingFileId(null);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleFileUpload = async (tipo: 'oc' | 'aprobacion' | 'inventario' | 'notacredito') => {
    // Crear input file temporal
    const input = document.createElement('input');
    input.type = 'file';
    
    // Configurar tipos aceptados según el tipo de archivo
    if (tipo === 'oc') {
      input.accept = '.pdf'; // OC/OS solo PDF
    } else if (tipo === 'aprobacion') {
      input.accept = '.pdf,.jpg,.jpeg,.png,.webp'; // APROBACION_GERENCIA acepta imágenes
    } else {
      input.accept = '.pdf';
    }
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) return;
      
      // Determinar doc_type según el tipo (fuera del try para que sea accesible en finally)
      let docType = '';
      let setLoading: (loading: boolean) => void = () => {};
      let setArchivo: (nombre: string) => void = () => {};
      
      switch (tipo) {
        case 'oc':
          // Por ahora usaremos "OC" como default, podríamos agregar un selector para OC/OS
          docType = 'OC';
          setLoading = setUploadingOC;
          setArchivo = setArchivoOC;
          break;
        case 'aprobacion':
          docType = 'APROBACION_GERENCIA';
          setLoading = setUploadingAprobacion;
          setArchivo = setArchivoAprobacion;
          break;
        case 'inventario':
          docType = 'SOPORTE_PAGO';
          setLoading = setUploadingInventario;
          setArchivo = setArchivoInventario;
          break;
        default:
          return;
      }
      
      try {
        setLoading(true);
        
        // Subir archivo al backend
        const response = await uploadFacturaFile(factura.id, docType, file);
        
        // Actualizar estado con el nombre del archivo subido
        setArchivo(response.filename);
        
        // Actualizar archivo existente en estado
        if (tipo === 'oc') {
          // Agregar el nuevo archivo al array de archivos OC
          setArchivosOCExistentes(prev => [...prev, {
            id: response.file_id,
            filename: response.filename,
            doc_type: response.doc_type,
            content_type: response.content_type,
            uploaded_at: response.created_at
          }]);
        } else if (tipo === 'aprobacion') {
          setArchivoAprobacionExistente({
            id: response.file_id,
            filename: response.filename,
            doc_type: response.doc_type,
            content_type: response.content_type,
            uploaded_at: response.created_at
          });
        }
        
        // Limpiar error si existía
        const nuevosErrores = { ...errores };
        delete nuevosErrores[tipo];
        setErrores(nuevosErrores);
        
        console.log('Archivo subido exitosamente:', response);
        
      } catch (error: any) {
        console.error('Error al subir archivo:', error);
        
        // Mostrar error al usuario
        const nuevosErrores = { ...errores };
        nuevosErrores[tipo] = error.message || 'Error al subir el archivo';
        setErrores(nuevosErrores);
        
        alert(`Error al subir archivo: ${error.message || 'Error desconocido'}`);
      } finally {
        setLoading(false);
      }
    };
    
    input.click();
  };

  const validarFormulario = (): { valido: boolean; errores: Record<string, string> } => {
    const nuevosErrores: Record<string, string> = {};

    // Log para debugging
    console.log('🔍 Validando formulario:', {
      distribuciones: distribuciones.length,
      esGastoAdm,
      archivosOC: archivosOCExistentes.length,
      archivoAprobacion: archivoAprobacionExistente ? 'Sí' : 'No'
    });

    // Validar OC y APROBACIÓN solo si NO es gasto administrativo
    if (!esGastoAdm) {
      if (archivosOCExistentes.length === 0) {
        nuevosErrores.oc = 'Debe subir al menos una OC/OS (o marque como gasto administrativo)';
      }
      if (!archivoAprobacionExistente) {
        nuevosErrores.aprobacion = 'Aprobación es obligatoria (o marque como gasto administrativo)';
      }
    }

    // Validar Inventarios si está activado
    if (requiereInventario) {
      if (!tipoIngreso) {
        nuevosErrores.tipoIngreso = 'Debe seleccionar el tipo de ingreso';
      }

      if (tipoIngreso === 'tienda') {
        if (!oct) nuevosErrores.oct = 'OCT es obligatorio';
        if (!ect) nuevosErrores.ect = 'ECT es obligatorio';
        if (!fpcTienda) nuevosErrores.fpcTienda = 'FPC es obligatorio';
      }

      if (tipoIngreso === 'almacen') {
        if (!occ) nuevosErrores.occ = 'OCC es obligatorio';
        if (!edo) nuevosErrores.edo = 'EDO es obligatorio';
        if (!fpcAlmacen) nuevosErrores.fpcAlmacen = 'FPC es obligatorio';
      }
    }

    // Validar Nota de Crédito si tiene novedad
    if (tieneNovedad) {
      if (!numeroNotaCredito) {
        nuevosErrores.numeroNotaCredito = 'El número de Nota de Crédito es obligatorio';
      }
    }

    // Validar porcentaje de anticipo
    if (tieneAnticipo) {
      const porcentaje = parseFloat(porcentajeAnticipo);
      if (!porcentajeAnticipo || isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        nuevosErrores.porcentajeAnticipo = 'El porcentaje debe estar entre 0 y 100';
      }
    }

    // Validar Distribución CC/CO (OBLIGATORIO)
    if (distribuciones.length === 0) {
      nuevosErrores.distribucion = 'Debe guardar al menos una distribución de CC/CO';
      console.log('❌ ERROR: No hay distribuciones guardadas');
    } else {
      // Validar que la suma de porcentajes sea 100%
      const sumaPorcentajes = distribuciones.reduce((sum, d) => sum + d.porcentaje, 0);
      console.log(`📊 Suma de porcentajes: ${sumaPorcentajes}%`);
      if (Math.abs(sumaPorcentajes - 100) > 0.01) { // Tolerancia de 0.01 para decimales
        nuevosErrores.distribucion = `La suma de porcentajes debe ser 100% (actualmente: ${sumaPorcentajes.toFixed(2)}%)`;
        console.log(`❌ ERROR: Suma de porcentajes incorrecta: ${sumaPorcentajes}%`);
      }
    }

    setErrores(nuevosErrores);
    const valido = Object.keys(nuevosErrores).length === 0;
    console.log('✅ Validación resultado:', { valido, erroresCount: Object.keys(nuevosErrores).length });
    return { valido, errores: nuevosErrores };
  };

  const handleEnviarContabilidad = async () => {
    setMostrarValidacion(true);
    
    const { valido, errores: nuevosErrores } = validarFormulario();
    
    if (!valido) {
      // Crear mensaje más descriptivo
      const mensajesError = [];
      if (!esGastoAdm && (nuevosErrores.oc || nuevosErrores.aprobacion)) {
        mensajesError.push('• OC y Aprobación');
      }
      if (nuevosErrores.distribucion) {
        mensajesError.push(`• Distribución CC/CO: ${nuevosErrores.distribucion}`);
      }
      if (nuevosErrores.tipoIngreso || nuevosErrores.oct || nuevosErrores.ect || nuevosErrores.fpcTienda || nuevosErrores.occ || nuevosErrores.edo || nuevosErrores.fpcAlmacen) {
        mensajesError.push('• Datos de Inventarios');
      }
      if (nuevosErrores.numeroNotaCredito) {
        mensajesError.push('• Número de Nota de Crédito');
      }
      if (nuevosErrores.porcentajeAnticipo) {
        mensajesError.push('• Porcentaje de Anticipo');
      }
      
      const mensaje = mensajesError.length > 0 
        ? `Faltan campos obligatorios:\n\n${mensajesError.join('\n')}`
        : 'Por favor complete todos los campos obligatorios antes de enviar.';
      
      console.log('⚠️ Formulario inválido, mostrando modal:', mensajesError);
      
      setConfirmModalConfig({
        title: 'Validación Pendiente',
        message: mensaje,
        type: 'warning'
      });
      setShowConfirmModal(true);
      return;
    }

    console.log('✅ Formulario válido, enviando a contabilidad');

    try {
      setEnviandoContabilidad(true);
      
      // IDs de contabilidad
      const CONTABILIDAD_AREA_ID = '725f5e5a-49d3-4e44-800f-f5ff21e187ac';
      const CONTABILIDAD_USER_ID = '15d7b2c4-d4fa-4118-94a2-a0bd6782a2b7';
      
      await asignarFactura(factura.id, {
        area_id: CONTABILIDAD_AREA_ID,
        responsable_user_id: CONTABILIDAD_USER_ID
      });
      
      setConfirmModalConfig({
        title: 'Factura Enviada',
        message: 'La factura ha sido enviada exitosamente al área de Contabilidad para su revisión y aprobación.',
        type: 'success',
        onConfirm: () => onClose()
      });
      setShowConfirmModal(true);
    } catch (error: any) {
      console.error('Error enviando a contabilidad:', error);
      setConfirmModalConfig({
        title: 'Error al Enviar',
        message: `No se pudo enviar la factura a Contabilidad.\n\n${error.message || 'Error desconocido'}`,
        type: 'error'
      });
      setShowConfirmModal(true);
    } finally {
      setEnviandoContabilidad(false);
    }
  };

  const handleDevolverAFacturacion = async () => {
    if (motivoDevolucion.trim().length < 10) {
      toast.warning('El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      setEnviandoDevolucion(true);
      await devolverAFacturacion(factura.id, motivoDevolucion.trim());
      toast.success('Factura devuelta a Facturación correctamente');
      setMostrarModalDevolucion(false);
      setMotivoDevolucion('');
      onClose(); // Cerrar modal después de devolver
    } catch (error: any) {
      console.error('Error devolviendo factura:', error);
      toast.error(`Error al devolver factura: ${error.message || 'Error desconocido'}`);
    } finally {
      setEnviandoDevolucion(false);
    }
  };

  return (<>
      {/* Overlay */}
      <div className="fixed inset-0 bg-white z-40" />
      
      {/* Modal centrado */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-white shadow-2xl rounded-lg border border-gray-200 my-8">
            {/* Header */}
            <div className="text-white p-6 rounded-t-lg" style={{background: 'linear-gradient(to right, #00829a, #14aab8)'}}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mt-2">
                  <h3 className="text-white mb-2 text-xl font-semibold" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Detalle de Factura</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-lg transition-colors"
                  style={{backgroundColor: 'transparent'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="font-mono text-white text-lg">{factura.numero_factura}</span>
                <span className="text-blue-200">•</span>
                <span className={`px-3 py-1 rounded-full border text-sm ${statusConfig[factura.estado]?.bgColor || 'bg-gray-100 border-gray-200'} ${statusConfig[factura.estado]?.color || 'text-gray-700'}`}>
                  {factura.estado}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[calc(90vh-280px)]">
            
            {/* Alerta de Devolución (si existe motivo) */}
            {factura.motivo_devolucion && (
              <div className="border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Factura Devuelta por Contabilidad</h4>
                    <p className=" text-sm mb-3">
                      Esta factura fue devuelta para correcciones. Por favor revise y corrija antes de reenviar.
                    </p>
                    <div className="bg-white border border-red-200 rounded p-3">
                      <p className="text-xs font-semibold text-red-900 mb-2">MOTIVO DE DEVOLUCIÓN:</p>
                      <p className="text-sm text-gray-800">{factura.motivo_devolucion}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Información de la Factura */}
            <div>
              <h4 className="text-gray-900 font-semibold mb-3">Información de la Factura</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Proveedor</span>
                  <span className="text-gray-900 font-medium">{factura.proveedor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Área</span>
                  <span className="text-gray-900 font-medium">{factura.area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Emisión</span>
                  <span className="text-gray-900 font-medium">
                    {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total a Pagar</span>
                  <span className="text-gray-900 font-bold text-lg">
                    ${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Soporte de Pago (Factura PDF) */}
            <div>
              <h4 className="text-gray-900 font-semibold mb-3">Soporte de Pago</h4>
              {loadingArchivos ? (
                <div className="text-sm text-gray-500">Cargando archivos...</div>
              ) : soportePagoFiles.length > 0 ? (
                <div className="space-y-2">
                  {soportePagoFiles.map((file) => (
                    <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 truncate">{file.filename}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {file.doc_type && (
                                <>
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                    {file.doc_type}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              {file.storage_provider && (
                                <>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium uppercase">
                                    {file.storage_provider}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span>
                                {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreviewFile(file)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Vista previa"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          {file.storage_path ? (
                            <button
                              onClick={() => handleDownloadFile(file.storage_provider || 's3', file.storage_path || '', file.filename)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4 text-green-600" />
                            </button>
                          ) : (
                            <button 
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-50 cursor-not-allowed"
                              title="Archivo no disponible"
                            >
                              <Download className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No hay archivos de soporte de pago</p>
                </div>
              )}
            </div>

            {/* Toggle: ¿Es Gasto Administrativo? */}
            <div className="rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={esGastoAdm}
                        onChange={(e) => handleToggleEsGastoAdm(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 rounded-full peer transition-colors" style={{backgroundColor: esGastoAdm ? '#00829a' : '#d1d5db'}}></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">¿Es gasto administrativo?</span>
                      <p className="text-xs text-gray-600 mt-1">
                        Si está activo, OC y Aprobación no serán obligatorios para enviar a Contabilidad.
                      </p>
                    </div>
                  </label>
                </div>
                {esGastoAdm && (
                  <span className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full" style={{backgroundColor: 'rgba(20, 170, 184, 0.1)', color: '#00829a'}}>
                    Activado
                  </span>
                )}
              </div>
            </div>

            {/* Botón Subir OC/OS - Múltiples archivos */}
            <div>
              <h4 className="text-gray-900 font-semibold mb-3">
                OC / OS
                {!esGastoAdm && <span className="text-red-600 ml-1">*</span>}
                {esGastoAdm && <span className="text-xs text-gray-500 ml-2">(Opcional)</span>}
              </h4>
              
              {loadingArchivos ? (
                <div className="w-full px-4 py-3 bg-gray-200 rounded-lg animate-pulse">
                  <div className="h-5 bg-gray-300 rounded w-32 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Lista de archivos OC existentes */}
                  {archivosOCExistentes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {archivosOCExistentes.map((archivo, index) => (
                        <div key={archivo.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{archivo.filename}</p>
                              <p className="text-xs text-gray-500">Documento {index + 1}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewFile(archivo)}
                              className="p-2 rounded-lg transition-colors"
                              style={{color: '#00829a'}}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadFile(
                                archivo.storage_provider || 's3',
                                archivo.storage_path || '',
                                archivo.filename
                              )}
                              className="p-2 rounded-lg transition-colors"
                              style={{color: '#00829a'}}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 130, 154, 0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(archivo.id, 'oc')}
                              disabled={deletingFileId === archivo.id}
                              className="p-2 rounded-lg transition-colors"
                              style={{color: deletingFileId === archivo.id ? '#9ca3af' : '#dc2626'}}
                              onMouseEnter={(e) => {
                                if (deletingFileId !== archivo.id) {
                                  e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                                }
                              }}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Eliminar archivo"
                            >
                              {deletingFileId === archivo.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Botón para agregar más archivos */}
                  <button
                    onClick={() => handleFileUpload('oc')}
                    disabled={uploadingOC}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all border-2"
                    style={{
                      backgroundColor: uploadingOC ? '#f3f4f6' : 'transparent',
                      borderColor: uploadingOC ? '#d1d5db' : '#00829a',
                      color: uploadingOC ? '#9ca3af' : '#00829a',
                      cursor: uploadingOC ? 'not-allowed' : 'pointer',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                      fontSize: '0.875rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!uploadingOC) {
                        e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.05)';
                        e.currentTarget.style.borderColor = '#14aab8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!uploadingOC) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#00829a';
                      }
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingOC ? 'Subiendo...' : archivosOCExistentes.length > 0 ? 'Agregar otra OC / OS' : 'Subir OC / OS'}
                  </button>
                  
                  {archivosOCExistentes.length === 0 && !archivoOC && (
                    <p className="text-xs text-gray-500 mt-2">No hay archivos cargados</p>
                  )}
                  {errores.oc && (
                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errores.oc}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Botón Subir Aprobación */}
            <div>
              <h4 className="text-gray-900 font-semibold mb-3">
                Aprobación
                {!esGastoAdm && <span className="text-red-600 ml-1">*</span>}
                {esGastoAdm && <span className="text-xs text-gray-500 ml-2">(Opcional)</span>}
              </h4>
              
              {loadingArchivos ? (
                <div className="w-full px-4 py-3 bg-gray-200 rounded-lg animate-pulse">
                  <div className="h-5 bg-gray-300 rounded w-32 mx-auto"></div>
                </div>
              ) : archivoAprobacionExistente ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{archivoAprobacionExistente.filename}</p>
                        <p className="text-xs text-gray-500">Documento cargado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreviewFile(archivoAprobacionExistente)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Vista previa"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(
                          archivoAprobacionExistente.storage_provider || 's3',
                          archivoAprobacionExistente.storage_path || '',
                          archivoAprobacionExistente.filename
                        )}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Descargar archivo"
                      >
                        <Download className="w-4 h-4 text-green-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(archivoAprobacionExistente.id, 'aprobacion')}
                        disabled={deletingFileId === archivoAprobacionExistente.id}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar archivo"
                      >
                        {deletingFileId === archivoAprobacionExistente.id ? (
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleFileUpload('aprobacion')}
                    disabled={uploadingAprobacion}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all border-2"
                    style={{
                      backgroundColor: uploadingAprobacion ? '#f3f4f6' : 'transparent',
                      borderColor: uploadingAprobacion ? '#d1d5db' : '#00829a',
                      color: uploadingAprobacion ? '#9ca3af' : '#00829a',
                      cursor: uploadingAprobacion ? 'not-allowed' : 'pointer',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
                      fontSize: '0.875rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!uploadingAprobacion) {
                        e.currentTarget.style.backgroundColor = 'rgba(20, 170, 184, 0.05)';
                        e.currentTarget.style.borderColor = '#14aab8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!uploadingAprobacion) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#00829a';
                      }
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingAprobacion ? 'Subiendo...' : 'Subir Aprobación'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    {archivoAprobacion ? (
                      <span className="text-green-600">✓ {archivoAprobacion}</span>
                    ) : (
                      'No hay archivo cargado'
                    )}
                  </p>
                  {errores.aprobacion && (
                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errores.aprobacion}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Distribución CC/CO */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              {(loadingDistribucion || loadingCentros || loadingUnidades || loadingCuentas) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Cargando datos...</span>
                </div>
              ) : (
                <DistribucionCCCOTable
                  facturaId={factura.id}
                  distribuciones={distribuciones}
                  centrosCosto={centrosCosto}
                  centrosOperacion={centrosOperacion}
                  unidadesNegocio={unidadesNegocio}
                  cuentasAuxiliares={cuentasAuxiliares}
                  onSave={handleGuardarDistribucion}
                  saving={savingDistribucion}
                />
              )}
            </div>

            {/* ¿Requiere Inventario? */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ¿Esta factura requiere soporte de entrada a inventarios?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setRequiereInventario(true);
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: requiereInventario ? '#00829a' : '#e5e7eb',
                      color: requiereInventario ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (!requiereInventario) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (!requiereInventario) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      setRequiereInventario(false);
                      // Limpiar campos si se desactiva
                      setTipoIngreso('');
                      setOct('');
                      setEct('');
                      setFpcTienda('');
                      setOcc('');
                      setEdo('');
                      setFpcAlmacen('');
                      setArchivoInventario('');
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: !requiereInventario ? '#00829a' : '#e5e7eb',
                      color: !requiereInventario ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (requiereInventario) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (requiereInventario) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Bloque de Inventarios (solo visible si requiereInventario = true) */}
              {requiereInventario && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h5 className="font-medium text-gray-900">Inventarios</h5>
                  
                  {/* ¿Este ingreso corresponde a? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ¿Este ingreso corresponde a? <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipoIngreso"
                          value="tienda"
                          checked={tipoIngreso === 'tienda'}
                          onChange={(e) => setTipoIngreso(e.target.value as 'tienda')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">Tienda</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipoIngreso"
                          value="almacen"
                          checked={tipoIngreso === 'almacen'}
                          onChange={(e) => setTipoIngreso(e.target.value as 'almacen')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">Almacén / Inventarios</span>
                      </label>
                    </div>
                    {mostrarValidacion && errores.tipoIngreso && (
                      <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errores.tipoIngreso}
                      </p>
                    )}
                  </div>

                  {/* Campos para TIENDA */}
                  {tipoIngreso === 'tienda' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            OCT <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={oct}
                            onChange={(e) => setOct(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.oct ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="OCT"
                          />
                          {mostrarValidacion && errores.oct && (
                            <p className="text-red-600 text-xs mt-1">{errores.oct}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ECT <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={ect}
                            onChange={(e) => setEct(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.ect ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="ECT"
                          />
                          {mostrarValidacion && errores.ect && (
                            <p className="text-red-600 text-xs mt-1">{errores.ect}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            FPC <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={fpcTienda}
                            onChange={(e) => setFpcTienda(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.fpcTienda ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="FPC"
                          />
                          {mostrarValidacion && errores.fpcTienda && (
                            <p className="text-red-600 text-xs mt-1">{errores.fpcTienda}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campos para ALMACÉN */}
                  {tipoIngreso === 'almacen' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            OCC <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={occ}
                            onChange={(e) => setOcc(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.occ ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="OCC"
                          />
                          {mostrarValidacion && errores.occ && (
                            <p className="text-red-600 text-xs mt-1">{errores.occ}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            EDO <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={edo}
                            onChange={(e) => setEdo(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.edo ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="EDO"
                          />
                          {mostrarValidacion && errores.edo && (
                            <p className="text-red-600 text-xs mt-1">{errores.edo}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            FPC <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={fpcAlmacen}
                            onChange={(e) => setFpcAlmacen(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              mostrarValidacion && errores.fpcAlmacen ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="FPC"
                          />
                          {mostrarValidacion && errores.fpcAlmacen && (
                            <p className="text-red-600 text-xs mt-1">{errores.fpcAlmacen}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ¿Producto incorrecto / novedad? */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ¿Producto incorrecto / novedad?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setTieneNovedad(true);
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: tieneNovedad ? '#00829a' : '#e5e7eb',
                      color: tieneNovedad ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (!tieneNovedad) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (!tieneNovedad) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      setTieneNovedad(false);
                      setNumeroNotaCredito('');
                      setArchivoNotaCredito('');
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: !tieneNovedad ? '#00829a' : '#e5e7eb',
                      color: !tieneNovedad ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (tieneNovedad) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (tieneNovedad) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    No
                  </button>
                </div>
              </div>

              {tieneNovedad && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    <strong>Nota crédito tipo: NP (única)</strong>
                  </p>
                  
                  {/* Campo de texto para número de nota de crédito */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Nota Crédito (NP) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={numeroNotaCredito}
                      onChange={(e) => setNumeroNotaCredito(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        mostrarValidacion && errores.numeroNotaCredito ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ej: NP-2025-001"
                    />
                    {mostrarValidacion && errores.numeroNotaCredito && (
                      <p className="text-red-600 text-xs mt-1">{errores.numeroNotaCredito}</p>
                    )}
                  </div>
                  

                </div>
              )}
            </div>

            {/* Anticipo e Intervalo */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ¿Tiene anticipo?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setTieneAnticipo(true);
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: tieneAnticipo ? '#00829a' : '#e5e7eb',
                      color: tieneAnticipo ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (!tieneAnticipo) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (!tieneAnticipo) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      setTieneAnticipo(false);
                      setPorcentajeAnticipo('');
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors`}
                    style={{
                      backgroundColor: !tieneAnticipo ? '#00829a' : '#e5e7eb',
                      color: !tieneAnticipo ? 'white' : '#374151',
                      fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      if (tieneAnticipo) e.currentTarget.style.backgroundColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      if (tieneAnticipo) e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }}
                  >
                    No
                  </button>
                </div>
              </div>

              {tieneAnticipo && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    % Anticipo <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={porcentajeAnticipo}
                    onChange={(e) => setPorcentajeAnticipo(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${
                      mostrarValidacion && errores.porcentajeAnticipo ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ej: 50"
                  />
                  {mostrarValidacion && errores.porcentajeAnticipo && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errores.porcentajeAnticipo}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sección de Comentarios */}
            <div className="p-6 border-t border-gray-200 bg-white">
              {user && (
                <ComentariosFactura 
                  facturaId={factura.id} 
                  currentUserId={user.id}
                />
              )}
            </div>

            {/* Botón Unificado de Guardar Cambios */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-b border-gray-200 p-6">
              <button
                onClick={handleGuardarCambios}
                disabled={savingInventarios || savingNovedad || savingAnticipo || savingIntervalo}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-bold text-lg transition-all shadow-lg"
                style={{
                  backgroundColor: (savingInventarios || savingNovedad || savingAnticipo || savingIntervalo) ? '#9ca3af' : '#00829a',
                  color: 'white',
                  cursor: (savingInventarios || savingNovedad || savingAnticipo || savingIntervalo) ? 'not-allowed' : 'pointer',
                  fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                }}
                onMouseEnter={(e) => {
                  if (!(savingInventarios || savingNovedad || savingAnticipo || savingIntervalo)) {
                    e.currentTarget.style.backgroundColor = '#14aab8';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(20, 170, 184, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(savingInventarios || savingNovedad || savingAnticipo || savingIntervalo)) {
                    e.currentTarget.style.backgroundColor = '#00829a';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                  }
                }}
              >
                {(savingInventarios || savingNovedad || savingAnticipo || savingIntervalo) ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Guardando cambios...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Todos los Cambios
                  </>
                )}
              </button>
              <p className="text-xs text-gray-600 text-center mt-3" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                Guarda: Inventarios, Novedad y Anticipo
              </p>
            </div>

            {/* Footer con acciones */}
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => setMostrarModalDevolucion(true)}
                disabled={enviandoDevolucion}
                className="px-6 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Devolver a Facturación
              </button>
              <button
                onClick={handleEnviarContabilidad}
                disabled={enviandoContabilidad}
                className={`px-6 py-2 rounded-lg transition-colors font-medium`}
                style={{
                  backgroundColor: enviandoContabilidad ? '#9ca3af' : '#00829a',
                  color: enviandoContabilidad ? '#e5e7eb' : 'white',
                  cursor: enviandoContabilidad ? 'not-allowed' : 'pointer',
                  fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                }}
                onMouseEnter={(e) => {
                  if (!enviandoContabilidad) e.currentTarget.style.backgroundColor = '#14aab8';
                }}
                onMouseLeave={(e) => {
                  if (!enviandoContabilidad) e.currentTarget.style.backgroundColor = '#00829a';
                }}
              >
                {enviandoContabilidad ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </div>
                ) : (
                  'Enviar a Contabilidad'
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Devolución a Facturación */}
      {mostrarModalDevolucion && (
        <>
          <div 
            className="fixed inset-0 z-50 backdrop-blur-lg" 
            style={{backgroundColor: 'rgba(55, 65, 81, 0.75)'}}
            onClick={() => {
              setMostrarModalDevolucion(false);
              setMotivoDevolucion('');
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header con gradiente verde */}
            <div className="p-6 border-b border-gray-200 rounded-t-lg" style={{background: 'linear-gradient(to right, #059669, #10b981)'}}>
              <h3 className="text-lg font-semibold text-white" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>Devolver a Facturación</h3>
              <p className="text-sm mt-1" style={{color: 'rgba(255, 255, 255, 0.9)', fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                La factura será devuelta al área de Facturación para correcciones
              </p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                Motivo de devolución <span className="text-red-600">*</span>
              </label>
              <textarea
                value={motivoDevolucion}
                onChange={(e) => setMotivoDevolucion(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none resize-none"
                style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(220, 38, 38, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = ''}
                placeholder="Describa el motivo de la devolución (mínimo 10 caracteres)..."
                disabled={enviandoDevolucion}
              />
              <p className="text-xs text-gray-500 mt-1" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                {motivoDevolucion.length}/1000 caracteres (mínimo 10)
              </p>
              {motivoDevolucion.length > 0 && motivoDevolucion.length < 10 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1" style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}>
                  <AlertCircle className="w-3 h-3" />
                  El motivo debe tener al menos 10 caracteres
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setMostrarModalDevolucion(false);
                  setMotivoDevolucion('');
                }}
                disabled={enviandoDevolucion}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                style={{fontFamily: "'Neutra Text', 'Montserrat', sans-serif"}}
              >
                Cancelar
              </button>
              {motivoDevolucion.trim().length >= 10 && (
                <button
                  onClick={handleDevolverAFacturacion}
                  disabled={enviandoDevolucion}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: enviandoDevolucion ? '#9ca3af' : '#dc2626',
                    color: 'white',
                    cursor: enviandoDevolucion ? 'not-allowed' : 'pointer',
                    fontFamily: "'Neutra Text', 'Montserrat', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    if (!enviandoDevolucion) e.currentTarget.style.backgroundColor = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    if (!enviandoDevolucion) e.currentTarget.style.backgroundColor = '#dc2626';
                  }}
                >
                  {enviandoDevolucion ? 'Devolviendo...' : 'Confirmar Devolución'}
                </button>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {/* Modal de vista previa */}
      {previewFile && (
        <FilePreviewModal
          fileId={previewFile.id}
          filename={previewFile.filename}
          contentType={previewFile.content_type}
          storagePath={previewFile.storage_path}
          facturaId={factura.id}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownloadById(previewFile)}
        />
      )}
      
      {/* Modal de confirmación moderno */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        type={confirmModalConfig.type}
        showCancel={confirmModalConfig.showCancel}
      />
    </>
  );
}
