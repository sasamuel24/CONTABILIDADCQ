/**
 * API Client para comunicación con el backend FastAPI
 */

// Variables de entorno de Vite - definidas en vite-env.d.ts
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1';

// Tipos de respuesta del backend
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AreaInfo {
  id: string;
  code: string;
  nombre: string;
}

export interface UserMe {
  id: string;
  nombre: string;
  email: string;
  role: string;
  must_change_password: boolean;
  area: AreaInfo | null;
}

export interface DashboardMetrics {
  recibidas: number;
  asignadas: number;
  cerradas: number;
  pendientes: number;
}

export interface Area {
  id: string;
  nombre: string;
}

export interface FacturaAsignada {
  numero_factura: string;
  proveedor: string;
  area: string;
  quien_la_tiene: string;
  fecha_asignacion: string;
  estado: string;
}

export interface FileMiniOut {
  id: string;
  doc_type: string | null;
  filename: string;
  content_type: string;
  uploaded_at: string;
  download_url?: string;
  storage_provider?: string;
  storage_path?: string;
}

export interface CarpetaEnFactura {
  id: string;
  nombre: string;
  parent_id: string | null;
}

export interface FacturaListItem {
  id: string;
  proveedor: string;
  numero_factura: string;
  fecha_emision: string | null;
  area: string;
  total: number;
  estado: string;
  centro_costo: string | null;
  centro_operacion: string | null;
  centro_costo_id: string | null;
  centro_operacion_id: string | null;
  requiere_entrada_inventarios: boolean;
  destino_inventarios: string | null;
  presenta_novedad: boolean;
  inventarios_codigos: InventarioCodigo[];
  tiene_anticipo: boolean;
  porcentaje_anticipo: number | null;
  intervalo_entrega_contabilidad: string | null;
  es_gasto_adm: boolean;
  motivo_devolucion: string | null;
  area_origen_id: string | null;
  files: FileMiniOut[];
  carpeta_id: string | null;
  carpeta: CarpetaEnFactura | null;
  carpeta_tesoreria_id: string | null;
  carpeta_tesoreria: CarpetaEnFactura | null;
  unidad_negocio_id: string | null;
  unidad_negocio: string | null;
  cuenta_auxiliar_id: string | null;
  cuenta_auxiliar: string | null;
}

export interface FacturasPaginatedResponse {
  items: FacturaListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface FacturaDetail {
  id: string;
  proveedor: string;
  numero_factura: string;
  fecha_emision: string | null;
  area_id: string;
  area: string;
  total: number;
  estado_id: number;
  estado: string;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  centro_costo_id: string | null;
  centro_costo: string | null;
  centro_operacion_id: string | null;
  centro_operacion: string | null;
  created_at: string;
  updated_at: string;
  motivo_devolucion: string | null;
}

export interface FacturaUpdate {
  area_id?: string;
  estado_id?: number;
  assigned_to_user_id?: string;
  centro_costo_id?: string;
  centro_operacion_id?: string;
  es_gasto_adm?: boolean;
}

export interface User {
  id: string;
  email: string;
  nombre: string;
}

export interface UserListItem {
  id: string;
  nombre: string;
  email: string;
}

export interface ApiError {
  detail: string | { message: string; [key: string]: any };
}

// Tokens en localStorage
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Helper para hacer requests con manejo de errores
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Agregar Authorization header si existe token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si es 401 en login, no redirigir (es un error de credenciales)
    if (response.status === 401) {
      if (!skipAuthRedirect) {
        clearTokens();
        window.location.href = '/';
      }
      const error: ApiError = await response.json();
      const message = typeof error.detail === 'string' 
        ? error.detail 
        : error.detail?.message || 'No autorizado';
      throw new Error(message);
    }

    if (!response.ok) {
      const error: ApiError = await response.json();
      
      // Para errores de validación (422), mostrar detalles completos
      if (response.status === 422) {
        console.error('Error de validación:', error);
        const message = typeof error.detail === 'string' 
          ? error.detail 
          : JSON.stringify(error.detail);
        throw new Error(`Error de validación: ${message}`);
      }
      
      const message = typeof error.detail === 'string' 
        ? error.detail 
        : error.detail?.message || 'Error en la solicitud';
      throw new Error(message);
    }

    // Si es 204 No Content, retornar null
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error de conexión con el servidor');
  }
}

/**
 * Login con email y password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetchAPI<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    true // skipAuthRedirect = true para no redirigir en error de login
  );

  // Guardar tokens
  setTokens(response.access_token, response.refresh_token);

  return response;
}

/**
 * Obtener información del usuario autenticado
 */
export async function getMe(): Promise<UserMe> {
  return fetchAPI<UserMe>('/auth/me');
}

/**
 * Obtener información del usuario autenticado (alias para compatibilidad)
 */
export async function getCurrentUser(): Promise<UserMe> {
  return getMe();
}

/**
 * Logout (opcional: llamar endpoint de logout si existe)
 */
export async function logout(): Promise<void> {
  clearTokens();
  // Si el backend tiene endpoint de logout, llamarlo aquí
  // await fetchAPI('/auth/logout', { method: 'POST' });
}

/**
 * Cambiar contraseña del usuario
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await fetchAPI('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

/**
 * Verificar si hay una sesión activa
 */
export function hasValidSession(): boolean {
  return !!getAccessToken();
}

/**
 * Obtener métricas del dashboard
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return fetchAPI<DashboardMetrics>('/dashboard/facturas/metrics');
}

/**
 * Obtener lista de áreas
 */
export async function getAreas(): Promise<Area[]> {
  return fetchAPI<Area[]>('/areas/');
}

/**
 * Obtener facturas asignadas recientes
 */
export async function getFacturasAsignadas(): Promise<FacturaAsignada[]> {
  return fetchAPI<FacturaAsignada[]>('/dashboard/areas/recientes-asignadas');
}

/**
 * Obtener lista paginada de facturas
 */
export async function getFacturas(skip: number = 0, limit: number = 100, area_id?: string): Promise<FacturasPaginatedResponse> {
  const params = new URLSearchParams();
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  if (area_id) {
    params.append('area_id', area_id);
  }
  return fetchAPI<FacturasPaginatedResponse>(`/facturas/?${params.toString()}`);
}

/**
 * Obtener detalle de una factura por ID
 */
export async function getFacturaById(facturaId: string): Promise<FacturaDetail> {
  return fetchAPI<FacturaDetail>(`/facturas/${facturaId}`);
}

/**
 * Actualizar una factura
 */
export async function updateFactura(facturaId: string, data: FacturaUpdate): Promise<FacturaDetail> {
  return fetchAPI<FacturaDetail>(`/facturas/${facturaId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Obtener lista de usuarios
 */
export async function getUsers(): Promise<UserListItem[]> {
  return fetchAPI<UserListItem[]>('/users/');
}

/**
 * Obtener archivos de una factura filtrados por doc_type
 */
export async function getFacturaFilesByDocType(facturaId: string, docType: string): Promise<FileMiniOut[]> {
  return fetchAPI<FileMiniOut[]>(`/facturas/${facturaId}/files?doc_type=${docType}`);
}

/**
 * Subir archivo a una factura
 */
export interface FileUploadResponse {
  file_id: string;
  factura_id: string;
  doc_type: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_provider: string;
  storage_path: string;
  created_at: string;
  uploaded_by_user_id?: string;
  download_url?: string;
}

export async function uploadFacturaFile(
  facturaId: string, 
  docType: string, 
  file: File
): Promise<FileUploadResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const response = await fetch(`${API_BASE_URL}/facturas/${facturaId}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || error.detail || 'Error al subir el archivo');
  }

  return response.json();
}

/**
 * Descargar archivo de una factura desde S3 usando su key
 */
export async function downloadFacturaFile(
  facturaId: string,
  key: string
): Promise<Blob> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const encodedKey = encodeURIComponent(key);
  const response = await fetch(
    `${API_BASE_URL}/facturas/${facturaId}/files/download?key=${encodedKey}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al descargar el archivo');
  }

  return response.blob();
}

/**
 * Descargar archivo por ID (para descarga directa)
 */
export async function downloadFileById(fileId: string): Promise<Blob> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const response = await fetch(
    `${API_BASE_URL}/files/${fileId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al descargar el archivo');
  }

  return response.blob();
}

/**
 * Eliminar archivo por ID
 */
export async function deleteFacturaFile(fileId: string): Promise<void> {
  await fetchAPI(`/files/${fileId}`, {
    method: 'DELETE',
  });
}

/**
 * Obtener URL de vista previa de un archivo por ID
 */
export function getFilePreviewUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${fileId}/preview`;
}

// ============================================
// CENTROS DE COSTO Y OPERACIÓN
// ============================================

export interface CentroCosto {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroOperacion {
  id: string;
  nombre: string;
  centro_costo_id: string;
  centro_costo_nombre?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnidadNegocio {
  id: string;
  codigo: string;
  descripcion: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface CuentaAuxiliar {
  id: string;
  codigo: string;
  descripcion: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistribucionCCCO {
  id?: string;
  factura_id?: string;
  centro_costo_id: string;
  centro_operacion_id: string;
  unidad_negocio_id?: string | null;
  cuenta_auxiliar_id?: string | null;
  porcentaje: number;
  created_at?: string;
  updated_at?: string;
}

export interface DistribucionBulkUpdate {
  distribuciones: Omit<DistribucionCCCO, 'id' | 'factura_id' | 'created_at' | 'updated_at'>[];
}

/**
 * Obtener todos los centros de costo
 */
export async function getCentrosCosto(activosOnly: boolean = true): Promise<CentroCosto[]> {
  return fetchAPI<CentroCosto[]>(`/centros-costo?activos_only=${activosOnly}`);
}

/**
 * Obtener todos los centros de operación
 */
export async function getCentrosOperacion(
  centroCostoId?: string, 
  activosOnly: boolean = true
): Promise<CentroOperacion[]> {
  const params = new URLSearchParams();
  params.append('activos_only', activosOnly.toString());
  if (centroCostoId) {
    params.append('centro_costo_id', centroCostoId);
  }
  return fetchAPI<CentroOperacion[]>(`/centros-operacion?${params.toString()}`);
}

/**
 * Actualizar centros de costo y operación de una factura
 */
export interface UpdateCentrosRequest {
  centro_costo_id: string;
  centro_operacion_id: string;
}

export interface UpdateCentrosResponse {
  factura_id: string;
  centro_costo_id: string;
  centro_operacion_id: string;
}

export async function updateFacturaCentros(
  facturaId: string,
  data: UpdateCentrosRequest
): Promise<UpdateCentrosResponse> {
  return fetchAPI<UpdateCentrosResponse>(`/facturas/${facturaId}/centros`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

/**
 * Obtener todas las unidades de negocio
 */
export async function getUnidadesNegocio(activasOnly: boolean = true): Promise<UnidadNegocio[]> {
  return fetchAPI<UnidadNegocio[]>(`/unidades-negocio?activas_only=${activasOnly}`);
}

/**
 * Actualizar unidad de negocio de una factura
 */
export interface UpdateUnidadNegocioRequest {
  unidad_negocio_id: string | null;
}

export async function updateFacturaUnidadNegocio(
  facturaId: string,
  unidadNegocioId: string | null
): Promise<void> {
  await fetchAPI(`/facturas/${facturaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unidad_negocio_id: unidadNegocioId })
  });
}

/**
 * Obtener todas las cuentas auxiliares
 */
export async function getCuentasAuxiliares(activasOnly: boolean = true): Promise<CuentaAuxiliar[]> {
  return fetchAPI<CuentaAuxiliar[]>(`/cuentas-auxiliares?activas_only=${activasOnly}`);
}

/**
 * Actualizar cuenta auxiliar de una factura
 */
export interface UpdateCuentaAuxiliarRequest {
  cuenta_auxiliar_id: string | null;
}

export async function updateFacturaCuentaAuxiliar(
  facturaId: string,
  cuentaAuxiliarId: string | null
): Promise<void> {
  await fetchAPI(`/facturas/${facturaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cuenta_auxiliar_id: cuentaAuxiliarId })
  });
}

// ============================================
// INVENTARIOS
// ============================================

export interface InventarioCodigo {
  codigo: string;
  valor: string;
  created_at?: string;
}

export interface InventariosData {
  factura_id?: string;
  requiere_entrada_inventarios: boolean;
  destino_inventarios: string | null;
  codigos: InventarioCodigo[];
}

export interface UpdateInventariosRequest {
  requiere_entrada_inventarios: boolean;
  destino_inventarios?: string | null;
  presenta_novedad?: boolean | null;
  codigos?: InventarioCodigo[];
}

/**
 * Obtener inventarios de una factura
 */
export async function getFacturaInventarios(facturaId: string): Promise<InventariosData> {
  return fetchAPI<InventariosData>(`/facturas/${facturaId}/inventarios`);
}

/**
 * Actualizar inventarios de una factura
 */
export async function updateFacturaInventarios(
  facturaId: string,
  data: UpdateInventariosRequest
): Promise<InventariosData> {
  return fetchAPI<InventariosData>(`/facturas/${facturaId}/inventarios`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============================================
// ANTICIPO
// ============================================

export interface AnticipoData {
  factura_id: string;
  tiene_anticipo: boolean;
  porcentaje_anticipo: number | null;
  intervalo_entrega_contabilidad: string;
}

export interface UpdateAnticipoRequest {
  tiene_anticipo: boolean;
  porcentaje_anticipo: number | null;
  intervalo_entrega_contabilidad: string;
}

/**
 * Obtener anticipo de una factura
 */
export async function getFacturaAnticipo(facturaId: string): Promise<AnticipoData> {
  return fetchAPI<AnticipoData>(`/facturas/${facturaId}/anticipo`);
}

/**
 * Actualizar anticipo de una factura
 */
export async function updateFacturaAnticipo(
  facturaId: string,
  data: UpdateAnticipoRequest
): Promise<AnticipoData> {
  return fetchAPI<AnticipoData>(`/facturas/${facturaId}/anticipo`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============================================
// ASIGNACIONES
// ============================================

export interface AsignacionRequest {
  area_id: string;
  responsable_user_id: string;
}

export interface AsignacionResponse {
  asignacion_id: string;
  factura_id: string;
  numero_factura: string;
  proveedor: string;
  area: string;
  responsable: {
    id: string;
    nombre: string;
    email: string;
  };
  estado_factura: string;
  fecha_asignacion: string;
}

/**
 * Asignar factura a un área y responsable
 */
export async function asignarFactura(
  facturaId: string,
  data: AsignacionRequest
): Promise<AsignacionResponse> {
  const token = getAccessToken();
  
  return fetchAPI<AsignacionResponse>(`/facturas/${facturaId}/asignaciones`, {
    method: 'POST',
    headers: {
      'x-api-key': 'mi-api-key-secreta-2025',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
}

// ==================== ESTADOS ====================

export interface EstadoUpdateResponse {
  id: string;
  estado: string;
  updated_at: string;
}

/**
 * Actualizar el estado de una factura
 */
export async function updateFacturaEstado(
  facturaId: string,
  estadoId: number
): Promise<EstadoUpdateResponse> {
  const token = getAccessToken();
  
  return fetchAPI<EstadoUpdateResponse>(`/facturas/${facturaId}/estado`, {
    method: 'PATCH',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ estado_id: estadoId }),
  });
}

// ==================== DEVOLUCIÓN A RESPONSABLE ====================

export interface DevolverAResponsableRequest {
  motivo: string;
}

export interface DevolverAResponsableResponse {
  factura_id: string;
  estado_actual: string;
  motivo_devolucion: string;
}

/**
 * Devolver una factura de Contabilidad a Responsable
 */
export async function devolverAResponsable(
  facturaId: string,
  motivo: string
): Promise<DevolverAResponsableResponse> {
  const token = getAccessToken();
  
  return fetchAPI<DevolverAResponsableResponse>(`/facturas/${facturaId}/devolver-a-responsable`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ motivo }),
  });
}

// ==================== DEVOLUCIÓN A FACTURACIÓN ====================

export interface DevolverAFacturacionRequest {
  motivo: string;
}

export interface DevolverAFacturacionResponse {
  factura_id: string;
  estado_actual: string;
  motivo_devolucion: string;
  usuario_facturacion: string;
}

/**
 * Devolver una factura de Responsable a Facturación
 */
export async function devolverAFacturacion(
  facturaId: string,
  motivo: string
): Promise<DevolverAFacturacionResponse> {
  const token = getAccessToken();
  
  return fetchAPI<DevolverAFacturacionResponse>(`/facturas/${facturaId}/devolver-a-facturacion`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ motivo }),
  });
}


// ==================== CARPETAS ====================

export interface FacturaEnCarpeta {
  id: string;
  numero_factura: string;
  proveedor: string;
  total: number;
  carpeta_nombre?: string | null;
}

export interface Carpeta {
  id: string;
  nombre: string;
  parent_id: string | null;
  factura_id: string | null;
  created_at: string;
  updated_at: string;
  children: Carpeta[];
  facturas: FacturaEnCarpeta[];
}

export interface CarpetaCreate {
  nombre: string;
  parent_id?: string | null;
}

export interface CarpetaUpdate {
  nombre?: string;
  parent_id?: string | null;
  factura_id?: string | null;
}

export interface AsignarFacturaCarpetaRequest {
  carpeta_id: string;
}

export interface AsignarFacturaCarpetaResponse {
  factura_id: string;
  carpeta_id: string;
  carpeta_nombre: string;
}

/**
 * Obtener todas las carpetas raíz con su jerarquía completa
 */
export async function getCarpetas(): Promise<Carpeta[]> {
  return fetchAPI<Carpeta[]>('/carpetas/');
}

/**
 * Obtener una carpeta específica por ID con sus subcarpetas
 */
export async function getCarpetaById(carpetaId: string): Promise<Carpeta> {
  return fetchAPI<Carpeta>(`/carpetas/${carpetaId}`);
}

/**
 * Obtener subcarpetas de una carpeta específica
 */
export async function getCarpetasByParent(parentId: string): Promise<Carpeta[]> {
  return fetchAPI<Carpeta[]>(`/carpetas/parent/${parentId}`);
}

/**
 * Crear una nueva carpeta
 */
export async function createCarpeta(data: CarpetaCreate): Promise<Carpeta> {
  return fetchAPI<Carpeta>('/carpetas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualizar una carpeta existente
 */
export async function updateCarpeta(
  carpetaId: string,
  data: CarpetaUpdate
): Promise<Carpeta> {
  return fetchAPI<Carpeta>(`/carpetas/${carpetaId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Eliminar una carpeta
 */
export async function deleteCarpeta(carpetaId: string): Promise<void> {
  return fetchAPI<void>(`/carpetas/${carpetaId}`, {
    method: 'DELETE',
  });
}

/**
 * Asignar una factura a una carpeta
 */
export async function asignarFacturaACarpeta(
  facturaId: string,
  data: AsignarFacturaCarpetaRequest
): Promise<AsignarFacturaCarpetaResponse> {
  return fetchAPI<AsignarFacturaCarpetaResponse>(`/facturas/${facturaId}/carpeta`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== CARPETAS TESORERÍA ====================

export interface CarpetaTesoreria {
  id: string;
  nombre: string;
  parent_id: string | null;
  factura_id: string | null;
  created_at: string;
  updated_at: string;
  children: CarpetaTesoreria[];
  facturas: FacturaEnCarpeta[];
}

export interface CarpetaTesoreriaCreate {
  nombre: string;
  parent_id?: string | null;
}

export interface CarpetaTesoreriaUpdate {
  nombre?: string;
  parent_id?: string | null;
  factura_id?: string | null;
}

export interface AsignarFacturaCarpetaTesoreriaRequest {
  carpeta_id: string;
}

export interface AsignarFacturaCarpetaTesoreriaResponse {
  factura_id: string;
  carpeta_id: string;
  carpeta_nombre: string;
}

/**
 * Obtener todas las carpetas de tesorería raíz con su jerarquía completa
 */
export async function getCarpetasTesoreria(): Promise<CarpetaTesoreria[]> {
  return fetchAPI<CarpetaTesoreria[]>('/carpetas-tesoreria/');
}

/**
 * Obtener una carpeta de tesorería específica por ID con sus subcarpetas
 */
export async function getCarpetaTesoreriaById(carpetaId: string): Promise<CarpetaTesoreria> {
  return fetchAPI<CarpetaTesoreria>(`/carpetas-tesoreria/${carpetaId}`);
}

/**
 * Obtener subcarpetas de una carpeta de tesorería específica
 */
export async function getCarpetasTesoreriaByParent(parentId: string): Promise<CarpetaTesoreria[]> {
  return fetchAPI<CarpetaTesoreria[]>(`/carpetas-tesoreria/parent/${parentId}`);
}

/**
 * Crear una nueva carpeta de tesorería
 */
export async function createCarpetaTesoreria(data: CarpetaTesoreriaCreate): Promise<CarpetaTesoreria> {
  return fetchAPI<CarpetaTesoreria>('/carpetas-tesoreria/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualizar una carpeta de tesorería existente
 */
export async function updateCarpetaTesoreria(
  carpetaId: string,
  data: CarpetaTesoreriaUpdate
): Promise<CarpetaTesoreria> {
  return fetchAPI<CarpetaTesoreria>(`/carpetas-tesoreria/${carpetaId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Eliminar una carpeta de tesorería
 */
export async function deleteCarpetaTesoreria(carpetaId: string): Promise<void> {
  return fetchAPI<void>(`/carpetas-tesoreria/${carpetaId}`, {
    method: 'DELETE',
  });
}

/**
 * Asignar una factura a una carpeta de tesorería
 */
export async function asignarFacturaACarpetaTesoreria(
  facturaId: string,
  data: AsignarFacturaCarpetaTesoreriaRequest
): Promise<AsignarFacturaCarpetaTesoreriaResponse> {
  return fetchAPI<AsignarFacturaCarpetaTesoreriaResponse>(`/facturas/${facturaId}/carpeta-tesoreria`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Obtener distribución CC/CO de una factura
 */
export async function getDistribucionCCCO(facturaId: string): Promise<DistribucionCCCO[]> {
  return fetchAPI<DistribucionCCCO[]>(`/facturas/${facturaId}/distribucion-ccco`);
}

/**
 * Actualizar distribución CC/CO de una factura
 */
export async function updateDistribucionCCCO(
  facturaId: string,
  data: DistribucionBulkUpdate
): Promise<DistribucionCCCO[]> {
  return fetchAPI<DistribucionCCCO[]>(`/facturas/${facturaId}/distribucion-ccco`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

/**
 * Eliminar todas las distribuciones de una factura
 */
export async function deleteDistribucionCCCO(facturaId: string): Promise<void> {
  return fetchAPI<void>(`/facturas/${facturaId}/distribucion-ccco`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Tipos y funciones para Comentarios de Facturas
// ============================================================================

export interface UserInfo {
  id: string;
  email: string;
  nombre: string;
}

export interface ComentarioFactura {
  id: string;
  factura_id: string;
  user_id: string;
  user: UserInfo;
  contenido: string;
  created_at: string;
  updated_at: string;
}

export interface ComentarioListResponse {
  comentarios: ComentarioFactura[];
  total: number;
}

export interface ComentarioCreate {
  contenido: string;
}

export interface ComentarioUpdate {
  contenido: string;
}

/**
 * Obtener comentarios de una factura
 */
export async function getComentariosByFactura(
  facturaId: string,
  skip: number = 0,
  limit: number = 100
): Promise<ComentarioListResponse> {
  return fetchAPI<ComentarioListResponse>(
    `/facturas/${facturaId}/comentarios?skip=${skip}&limit=${limit}`
  );
}

/**
 * Crear un nuevo comentario en una factura
 */
export async function createComentario(
  facturaId: string,
  data: ComentarioCreate
): Promise<ComentarioFactura> {
  return fetchAPI<ComentarioFactura>(`/facturas/${facturaId}/comentarios`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualizar un comentario existente
 */
export async function updateComentario(
  comentarioId: string,
  data: ComentarioUpdate
): Promise<ComentarioFactura> {
  return fetchAPI<ComentarioFactura>(`/comentarios/${comentarioId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Eliminar un comentario
 */
export async function deleteComentario(comentarioId: string): Promise<void> {
  return fetchAPI<void>(`/comentarios/${comentarioId}`, {
    method: 'DELETE',
  });
}
