import { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Eye, Download, FileText, CheckCircle, Loader2 } from 'lucide-react';
import type { FacturaListItem, FileMiniOut, CentroCosto, CentroOperacion, InventariosData, UnidadNegocio, CuentaAuxiliar } from '../lib/api';
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
  API_BASE_URL
} from '../lib/api';

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
  // Estados para archivos
  const [archivoOC, setArchivoOC] = useState<string>('');
  const [archivoAprobacion, setArchivoAprobacion] = useState<string>('');
  const [archivoInventario, setArchivoInventario] = useState<string>('');
  const [archivoNotaCredito, setArchivoNotaCredito] = useState<string>('');

  // Estados para archivos existentes (ya subidos)
  const [archivoOCExistente, setArchivoOCExistente] = useState<FileMiniOut | null>(null);
  const [archivoAprobacionExistente, setArchivoAprobacionExistente] = useState<FileMiniOut | null>(null);
  const [soportePagoFiles, setSoportePagoFiles] = useState<FileMiniOut[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);

  // Estados de loading para uploads
  const [uploadingOC, setUploadingOC] = useState(false);
  const [uploadingAprobacion, setUploadingAprobacion] = useState(false);
  const [uploadingInventario, setUploadingInventario] = useState(false);

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
        
        if (archivosOC.length > 0) {
          setArchivoOCExistente(archivosOC[0]);
        }
        
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
        alert('Error al cargar centros de costo');
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
        alert('Error al cargar unidades de negocio');
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
        alert('Error al cargar cuentas auxiliares');
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentasAuxiliares();
  }, []);

  // Cargar centros de operación cuando se selecciona un centro de costo
  useEffect(() => {
    const cargarCentrosOperacion = async () => {
      if (!centroCosto) {
        setCentrosOperacion([]);
        // Solo limpiar el centro de operación si no hay centro de costo
        // Y no es la carga inicial (cuando factura ya tiene valores)
        if (!factura.centro_costo_id) {
          setCentroOperacion('');
        }
        return;
      }

      try {
        const centros = await getCentrosOperacion(centroCosto, true);
        setCentrosOperacion(centros);
        
        // Si ya no está el centro de operación seleccionado, limpiarlo
        // PERO no limpiar si es la carga inicial con datos de la factura
        if (centroOperacion && !centros.find(c => c.id === centroOperacion) && centroOperacion !== factura.centro_operacion_id) {
          setCentroOperacion('');
        }
      } catch (error) {
        console.error('Error cargando centros de operación:', error);
        alert('Error al cargar centros de operación');
      }
    };

    cargarCentrosOperacion();
  }, [centroCosto]);

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

  // Guardar todos los campos de clasificación (CC, CO, UN, CA)
  const handleGuardarClasificacion = async () => {
    if (!centroCosto || !centroOperacion) {
      alert('Debe seleccionar Centro de Costo y Centro de Operación');
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

      alert('✅ Clasificación actualizada correctamente');
      
    } catch (error: any) {
      console.error('Error guardando clasificación:', error);
      alert(`❌ Error al guardar: ${error.message || 'Error desconocido'}`);
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
      alert(nuevoValor 
        ? '✅ Marcado como gasto administrativo. OC y Aprobación ya no son obligatorios.' 
        : '✅ Desmarcado como gasto administrativo. OC y Aprobación son obligatorios.');
    } catch (error: any) {
      console.error('Error actualizando es_gasto_adm:', error);
      alert(`❌ Error al actualizar: ${error.message || 'Error desconocido'}`);
    }
  };

  // Guardar novedad de producto
  const handleGuardarNovedad = async () => {
    // Validar que si tiene novedad, tenga el número de nota de crédito
    if (tieneNovedad && !numeroNotaCredito) {
      alert('❌ Debe ingresar el número de Nota de Crédito (NP)');
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
      
      alert('✅ Novedad actualizada correctamente');
    } catch (error: any) {
      console.error('Error guardando novedad:', error);
      alert(`❌ Error al guardar novedad: ${error.message || 'Error desconocido'}`);
    } finally {
      setSavingNovedad(false);
    }
  };

  // Guardar anticipo
  const handleGuardarAnticipo = async () => {
    // Validar que si tiene anticipo, tenga el porcentaje
    if (tieneAnticipo && !porcentajeAnticipo) {
      alert('❌ Debe ingresar el porcentaje de anticipo');
      return;
    }

    // Validar rango de porcentaje
    const porcentaje = parseFloat(porcentajeAnticipo);
    if (tieneAnticipo && (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
      alert('❌ El porcentaje de anticipo debe estar entre 0 y 100');
      return;
    }

    try {
      setSavingAnticipo(true);
      
      await updateFacturaAnticipo(factura.id, {
        tiene_anticipo: tieneAnticipo,
        porcentaje_anticipo: tieneAnticipo ? porcentaje : null,
        intervalo_entrega_contabilidad: intervaloEntrega
      });
      
      alert('✅ Anticipo actualizado correctamente');
    } catch (error: any) {
      console.error('Error guardando anticipo:', error);
      alert(`❌ Error al guardar anticipo: ${error.message || 'Error desconocido'}`);
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
      
      alert('✅ Intervalo de entrega actualizado correctamente');
    } catch (error: any) {
      console.error('Error guardando intervalo:', error);
      alert(`❌ Error al guardar intervalo: ${error.message || 'Error desconocido'}`);
    } finally {
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
        const downloadUrl = `${API_BASE_URL}/api/v1/facturas/${factura.id}/files/download?key=${encodeURIComponent(storagePath)}`;
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
          setArchivoOCExistente({
            id: response.file_id,
            filename: response.filename,
            doc_type: response.doc_type,
            content_type: response.content_type,
            uploaded_at: response.created_at
          });
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

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    // Validar Centro de Costo y Operación (siempre obligatorios)
    if (!centroCosto) {
      nuevosErrores.centroCosto = 'El Centro de Costo es obligatorio';
    }
    if (!centroOperacion) {
      nuevosErrores.centroOperacion = 'El Centro de Operación es obligatorio';
    }

    // Validar OC y APROBACIÓN solo si NO es gasto administrativo
    if (!esGastoAdm) {
      if (!archivoOCExistente) {
        nuevosErrores.oc = 'OC es obligatorio (o marque como gasto administrativo)';
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

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleEnviarContabilidad = async () => {
    setMostrarValidacion(true);
    
    if (!validarFormulario()) {
      // Crear mensaje más descriptivo
      const mensajesError = [];
      if (errores.centroCosto || errores.centroOperacion) {
        mensajesError.push('Centro de Costo/Operación');
      }
      if (!esGastoAdm && (errores.oc || errores.aprobacion)) {
        mensajesError.push('OC y Aprobación');
      }
      
      const mensaje = mensajesError.length > 0 
        ? `❌ Faltan campos obligatorios: ${mensajesError.join(', ')}`
        : '❌ Por favor complete todos los campos obligatorios';
      
      alert(mensaje);
      return;
    }

    try {
      setEnviandoContabilidad(true);
      
      // IDs de contabilidad
      const CONTABILIDAD_AREA_ID = '725f5e5a-49d3-4e44-800f-f5ff21e187ac';
      const CONTABILIDAD_USER_ID = '15d7b2c4-d4fa-4118-94a2-a0bd6782a2b7';
      
      await asignarFactura(factura.id, {
        area_id: CONTABILIDAD_AREA_ID,
        responsable_user_id: CONTABILIDAD_USER_ID
      });
      
      alert('✅ Factura enviada correctamente al área de Contabilidad');
      onClose(); // Cerrar modal después de enviar
    } catch (error: any) {
      console.error('Error enviando a contabilidad:', error);
      alert(`❌ Error al enviar factura: ${error.message || 'Error desconocido'}`);
    } finally {
      setEnviandoContabilidad(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-white z-40" />
      
      {/* Modal centrado */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-white shadow-2xl rounded-lg border border-gray-200 my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mt-2">
                  <h3 className="text-white mb-2 text-xl font-semibold">Detalle de Factura</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-red-900 font-semibold mb-1">Factura Devuelta por Contabilidad</h4>
                    <p className="text-red-700 text-sm mb-2">
                      Esta factura fue devuelta para correcciones. Por favor revise y corrija antes de reenviar.
                    </p>
                    <div className="bg-white border border-red-200 rounded p-3">
                      <p className="text-xs font-semibold text-red-900 mb-1">MOTIVO DE DEVOLUCIÓN:</p>
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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
                      <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 transition-colors"></div>
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
                  <span className="flex-shrink-0 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Activado
                  </span>
                )}
              </div>
            </div>

            {/* Botón Subir OC/OS */}
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
              ) : archivoOCExistente ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{archivoOCExistente.filename}</p>
                        <p className="text-xs text-gray-500">Documento cargado</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadFile(
                        archivoOCExistente.storage_provider || 's3',
                        archivoOCExistente.storage_path || '',
                        archivoOCExistente.filename
                      )}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Descargar archivo"
                    >
                      <Download className="w-4 h-4 text-green-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleFileUpload('oc')}
                    disabled={uploadingOC}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      uploadingOC 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingOC ? 'Subiendo...' : 'Subir OC / OS'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    {archivoOC ? (
                      <span className="text-green-600">✓ {archivoOC}</span>
                    ) : (
                      'No hay archivo cargado'
                    )}
                  </p>
                  {errores.oc && (
                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errores.oc}
                    </p>
                  )}
                </>
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
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleFileUpload('aprobacion')}
                    disabled={uploadingAprobacion}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      uploadingAprobacion 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
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

            {/* Clasificación Contable (CC, CO, UN, CA) - BLOQUE UNIFICADO */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-gray-900 font-semibold text-lg">Clasificación Contable</h4>
                {factura.centro_costo_id && factura.centro_operacion_id && factura.unidad_negocio_id && factura.cuenta_auxiliar_id && (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1 font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Completo
                  </span>
                )}
              </div>
              
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                {/* Centro de Costo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Centro de Costo (CC) <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={centroCosto}
                    onChange={(e) => setCentroCosto(e.target.value)}
                    disabled={loadingCentros}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      mostrarValidacion && errores.centroCosto ? 'border-red-500' : 'border-gray-300'
                    } ${loadingCentros ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  >
                    <option value="">{loadingCentros ? 'Cargando...' : 'Seleccione un centro de costo'}</option>
                    {centrosCosto.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                    ))}
                  </select>
                  {mostrarValidacion && errores.centroCosto && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errores.centroCosto}
                    </p>
                  )}
                </div>

                {/* Centro de Operación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Centro de Operación (CO) <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={centroOperacion}
                    onChange={(e) => setCentroOperacion(e.target.value)}
                    disabled={!centroCosto || loadingCentros}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      mostrarValidacion && errores.centroOperacion ? 'border-red-500' : 'border-gray-300'
                    } ${(!centroCosto || loadingCentros) ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  >
                    <option value="">
                      {!centroCosto ? 'Primero seleccione un centro de costo' : 'Seleccione un centro de operación'}
                    </option>
                    {centrosOperacion.map(co => (
                      <option key={co.id} value={co.id}>{co.nombre}</option>
                    ))}
                  </select>
                  {mostrarValidacion && errores.centroOperacion && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errores.centroOperacion}
                    </p>
                  )}
                </div>

                {/* Unidad de Negocio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidad de Negocio (UN)
                  </label>
                  <select
                    value={unidadNegocio}
                    onChange={(e) => setUnidadNegocio(e.target.value)}
                    disabled={loadingUnidades}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 ${
                      loadingUnidades ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                    }`}
                  >
                    <option value="">{loadingUnidades ? 'Cargando...' : 'Seleccione una unidad de negocio (opcional)'}</option>
                    {unidadesNegocio.map(un => (
                      <option key={un.id} value={un.id}>{un.codigo} - {un.descripcion}</option>
                    ))}
                  </select>
                </div>

                {/* Cuenta Auxiliar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuenta Auxiliar (CA)
                  </label>
                  <select
                    value={cuentaAuxiliar}
                    onChange={(e) => setCuentaAuxiliar(e.target.value)}
                    disabled={loadingCuentas}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 ${
                      loadingCuentas ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                    }`}
                  >
                    <option value="">{loadingCuentas ? 'Cargando...' : 'Seleccione una cuenta auxiliar (opcional)'}</option>
                    {cuentasAuxiliares.map(ca => (
                      <option key={ca.id} value={ca.id}>{ca.codigo} - {ca.descripcion}</option>
                    ))}
                  </select>
                </div>

                {/* Botón único para guardar todo */}
                <div className="pt-2">
                  <button
                    onClick={handleGuardarClasificacion}
                    disabled={!centroCosto || !centroOperacion || savingCentros}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md ${
                      (!centroCosto || !centroOperacion || savingCentros)
                        ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white'
                    }`}
                  >
                    {savingCentros ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Guardar Clasificación Contable
                      </>
                    )}
                  </button>
                </div>
              </div>
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
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      requiereInventario 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
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
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      !requiereInventario 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
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
                  
                  {/* Botón para guardar inventarios */}
                  <div className="pt-3 border-t border-gray-200 mt-4">
                    <button
                      onClick={handleGuardarInventarios}
                      disabled={savingInventarios}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md ${
                        savingInventarios
                          ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                          : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white'
                      }`}
                    >
                      {savingInventarios ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Guardar Datos de Inventarios
                        </>
                      )}
                    </button>
                  </div>
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
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      tieneNovedad 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      setTieneNovedad(false);
                      setNumeroNotaCredito('');
                      setArchivoNotaCredito('');
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      !tieneNovedad 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
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
                  
                  {/* Botón para guardar novedad */}
                  <div className="pt-3">
                    <button
                      onClick={handleGuardarNovedad}
                      disabled={savingNovedad}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md ${
                        savingNovedad
                          ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                          : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white'
                      }`}
                    >
                      {savingNovedad ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Guardar Novedad
                        </>
                      )}
                    </button>
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
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      tieneAnticipo 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      setTieneAnticipo(false);
                      setPorcentajeAnticipo('');
                    }}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      !tieneAnticipo 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
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

              {/* Botón Guardar Anticipo */}
              <div className="mt-4">
                <button
                  onClick={handleGuardarAnticipo}
                  disabled={savingAnticipo}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md ${
                    savingAnticipo
                      ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white'
                  }`}
                >
                  {savingAnticipo ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Anticipo
                    </>
                  )}
                </button>
              </div>

              {/* Intervalo de entrega (siempre visible) */}
              <div className="mb-4 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervalo entrega a contabilidad
                </label>
                <select
                  value={intervaloEntrega}
                  onChange={(e) => setIntervaloEntrega(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {INTERVALOS_ENTREGA.map(intervalo => (
                    <option key={intervalo.value} value={intervalo.value}>
                      {intervalo.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Guardar Intervalo */}
              <div className="mt-4">
                <button
                  onClick={handleGuardarIntervalo}
                  disabled={savingIntervalo}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md ${
                    savingIntervalo
                      ? 'bg-gray-400 cursor-not-allowed text-gray-700' 
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white'
                  }`}
                >
                  {savingIntervalo ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Intervalo
                    </>
                  )}
                </button>
              </div>
            </div>
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
                onClick={handleEnviarContabilidad}
                disabled={enviandoContabilidad}
                className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                  enviandoContabilidad
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
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
    </>
  );
}

