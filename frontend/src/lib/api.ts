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

export interface AreaDetail {
  id: string;
  code: string;
  nombre: string;
}

export interface AreaCreatePayload {
  code: string;
  nombre: string;
}

export interface AreaUpdatePayload {
  code?: string;
  nombre?: string;
}

export interface Estado {
  id: number;
  code: string;
  label: string;
  order: number;
  is_final: boolean;
  is_active: boolean;
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
  fecha_vencimiento: string | null;
  area: string;
  area_id: string | null;
  total: number;
  estado: string;
  nit_proveedor: string | null;
  pendiente_confirmacion: boolean;
  ai_area_confianza: string | null;
  ai_area_razonamiento: string | null;
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
  fecha_envio_gerencia: string | null;
  fecha_aprobacion_email: string | null;
  aprobado_por_nombre: string | null;
  aprobado_por_email: string | null;
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
  fecha_envio_gerencia: string | null;
  fecha_aprobacion_email: string | null;
  aprobado_por_nombre: string | null;
  aprobado_por_email: string | null;
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
  role: string;
  area: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserDetail {
  id: string;
  nombre: string;
  email: string;
  role: string;
  area_id: string | null;
  area: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UsersPaginatedResponse {
  items: UserListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserCreatePayload {
  nombre: string;
  email: string;
  role: string;
  area_id?: string;
  password: string;
}

export interface UserUpdatePayload {
  nombre?: string;
  email?: string;
  role?: string;
  area_id?: string | null;
  is_active?: boolean;
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

// Evita múltiples llamadas simultáneas al endpoint de refresh
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper para hacer requests con manejo de errores
 */
export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const token = getAccessToken();

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

    // Si es 401 intentar renovar el token antes de cerrar sesión
    if (response.status === 401) {
      if (!skipAuthRedirect) {
        // Reutilizar el mismo refresh si ya hay uno en curso
        if (!refreshPromise) {
          refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null; });
        }
        const refreshed = await refreshPromise;
        if (refreshed) {
          // Reintentar la petición original con el nuevo token
          const newToken = getAccessToken();
          const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
          const retry = await fetch(url, { ...options, headers: retryHeaders });
          if (retry.ok) {
            if (retry.status === 204) return null as T;
            return retry.json();
          }
        }
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
export async function getAreas(): Promise<AreaDetail[]> {
  return fetchAPI<AreaDetail[]>('/areas/');
}

export async function confirmarIngestaFactura(facturaId: string, areaId: string): Promise<void> {
  await fetchAPI(`/facturas/${facturaId}/confirmar-ingesta?area_id=${areaId}`, { method: 'POST' });
}

/**
 * Crear una nueva área
 */
export async function createArea(data: AreaCreatePayload): Promise<AreaDetail> {
  return fetchAPI<AreaDetail>('/areas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Actualizar un área existente
 */
export async function updateArea(areaId: string, data: AreaUpdatePayload): Promise<AreaDetail> {
  return fetchAPI<AreaDetail>(`/areas/${areaId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Eliminar un área
 */
export async function deleteArea(areaId: string): Promise<void> {
  return fetchAPI<void>(`/areas/${areaId}`, {
    method: 'DELETE',
  });
}

/**
 * Obtener lista de estados
 */
export async function getEstados(): Promise<Estado[]> {
  return fetchAPI<Estado[]>('/estados/');
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
export async function getFacturas(skip: number = 0, limit: number = 100, area_id?: string, area_origen_id?: string): Promise<FacturasPaginatedResponse> {
  const params = new URLSearchParams();
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  if (area_id) params.append('area_id', area_id);
  if (area_origen_id) params.append('area_origen_id', area_origen_id);
  return fetchAPI<FacturasPaginatedResponse>(`/facturas/?${params.toString()}`);
}

/**
 * Confirmar área de ingesta para una factura
 */
export async function confirmarIngestaFactura(facturaId: string, areaId: string): Promise<void> {
  const params = new URLSearchParams({ area_id: areaId });
  await fetchAPI<void>(`/facturas/${facturaId}/confirmar-ingesta?${params.toString()}`, {
    method: 'POST',
  });
}

export async function submitGadminTesoreria(facturaId: string): Promise<{ factura_id: string; area_actual: string; estado_actual: string }> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/facturas/${facturaId}/submit-gadmin-tesoreria`, {
    method: 'POST',
    headers: { 'Authorization': token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
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

/** Listar usuarios con paginación */
export async function getUsers(skip = 0, limit = 200): Promise<UsersPaginatedResponse> {
  return fetchAPI<UsersPaginatedResponse>(`/users/?skip=${skip}&limit=${limit}`);
}

/** Crear usuario */
export async function createUser(data: UserCreatePayload): Promise<UserDetail> {
  return fetchAPI<UserDetail>('/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Actualizar usuario */
export async function updateUser(userId: string, data: UserUpdatePayload): Promise<UserDetail> {
  return fetchAPI<UserDetail>(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Admin resetea contraseña sin requerir la actual */
export async function adminResetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
  return fetchAPI(`/users/${userId}/admin-reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPassword }),
  });
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
  archivo_egreso_url: string | null;
  created_at: string;
  updated_at: string;
  children: CarpetaTesoreria[];
  facturas: FacturaEnCarpeta[];
}

export interface CarpetaTesoreriaCreate {
  nombre: string;
  parent_id?: string | null;
  archivo_egreso_url?: string | null;
}

export interface CarpetaTesoreriaUpdate {
  nombre?: string;
  parent_id?: string | null;
  factura_id?: string | null;
  archivo_egreso_url?: string | null;
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
 * Subir archivo PDF de control de egresos a una carpeta de tesorería
 */
export async function uploadArchivoEgresoCarpeta(
  carpetaId: string,
  file: File
): Promise<CarpetaTesoreria> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/carpetas-tesoreria/${carpetaId}/archivo-egreso`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al subir archivo' }));
    throw new Error(error.detail || `Error HTTP: ${response.status}`);
  }

  return response.json();
}

/**
 * Eliminar archivo PDF de control de egresos de una carpeta de tesorería
 */
export async function deleteArchivoEgresoCarpeta(carpetaId: string): Promise<CarpetaTesoreria> {
  return fetchAPI<CarpetaTesoreria>(`/carpetas-tesoreria/${carpetaId}/archivo-egreso`, {
    method: 'DELETE',
  });
}

/**
 * Obtener URL prefirmada para descargar archivo PDF de control de egresos
 */
export async function getArchivoEgresoUrl(carpetaId: string): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>(`/carpetas-tesoreria/${carpetaId}/archivo-egreso-url`);
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

export async function asignarFacturasACarpetaTesoreriaMasivo(
  facturaIds: string[],
  carpetaId: string
): Promise<{ exitosos: number; errores: number }> {
  const results = await Promise.allSettled(
    facturaIds.map(id => asignarFacturaACarpetaTesoreria(id, { carpeta_id: carpetaId }))
  );
  return {
    exitosos: results.filter(r => r.status === 'fulfilled').length,
    errores: results.filter(r => r.status === 'rejected').length,
  };
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

// ============================================================================
// MÓDULO GASTOS / LEGALIZACIÓN DE TÉCNICOS DE MANTENIMIENTO
// ============================================================================

export type EstadoPaquete = 'borrador' | 'en_revision' | 'devuelto' | 'aprobado' | 'en_tesoreria' | 'pagado';

export type CategoriaGasto =
  | 'Combustible'
  | 'Hospedaje'
  | 'Alimentacion'
  | 'Viaticos / Casetas'
  | 'Materiales'
  | 'Otro';

export interface ArchivoGastoOut {
  id: string;
  gasto_id: string;
  paquete_id: string;
  filename: string;
  s3_key: string;
  categoria: CategoriaGasto;
  content_type: string;
  size_bytes: number;
  download_url?: string;
  created_at: string;
}

export interface GastoOut {
  id: string;
  paquete_id: string;
  fecha: string;
  no_identificacion: string;
  pagado_a: string;
  concepto: string;
  no_recibo: string | null;
  centro_costo_id: string | null;
  centro_operacion_id: string | null;
  cuenta_auxiliar_id: string | null;
  centro_costo: { id: string; nombre: string } | null;
  centro_operacion: { id: string; nombre: string } | null;
  cuenta_auxiliar: { id: string; codigo: string; descripcion: string } | null;
  valor_pagado: number;
  orden: number;
  archivos: ArchivoGastoOut[];
  estado_gasto: string;
  motivo_devolucion_gasto?: string | null;
  cm_pdf_filename: string | null;
  cm_pdf_s3_key: string | null;
  created_at: string;
  updated_at: string;
  aviso_buzon?: string | null;
}

export interface ComentarioPaqueteOut {
  id: string;
  paquete_id: string;
  user: { id: string; nombre: string; email: string } | null;
  texto: string;
  tipo: 'observacion' | 'devolucion' | 'aprobacion' | 'pago';
  created_at: string;
}

export interface HistorialEstadoOut {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  user: { id: string; nombre: string; email: string } | null;
  created_at: string;
}

export interface PaqueteOut {
  id: string;
  semana: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPaquete;
  monto_total: number;
  monto_a_pagar: number | null;
  total_documentos: number;
  fecha_envio: string | null;
  fecha_envio_gerencia: string | null;
  fecha_aprobacion: string | null;
  fecha_pago: string | null;
  folio?: string | null;
  tecnico: { id: string; nombre: string; email: string };
  area: { id: string; nombre: string };
  revisado_por: { id: string; nombre: string; email: string } | null;
  gastos: GastoOut[];
  comentarios: ComentarioPaqueteOut[];
  historial_estados: HistorialEstadoOut[];
  aprobacion_gerencia_filename: string | null;
  aprobacion_gerencia_s3_key: string | null;
  doc_contable_filename: string | null;
  doc_contable_s3_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaqueteListItem {
  id: string;
  semana: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPaquete;
  monto_total: number;
  monto_a_pagar: number | null;
  total_documentos: number;
  fecha_envio: string | null;
  fecha_envio_tesoreria: string | null;
  comentario_devolucion: string | null;
  tiene_gastos_devueltos: boolean;
  folio?: string | null;
  tecnico: { id: string; nombre: string; email: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PaqueteListResponse {
  paquetes: PaqueteListItem[];
  total: number;
}

export interface GastoCreate {
  fecha: string;
  no_identificacion: string;
  pagado_a: string;
  concepto: string;
  no_recibo?: string;
  centro_costo_id?: string;
  centro_operacion_id?: string;
  cuenta_auxiliar_id?: string;
  valor_pagado: number;
  orden?: number;
}

export interface GastoUpdate {
  fecha?: string;
  no_identificacion?: string;
  pagado_a?: string;
  concepto?: string;
  no_recibo?: string;
  centro_costo_id?: string;
  centro_operacion_id?: string;
  cuenta_auxiliar_id?: string;
  valor_pagado?: number;
  orden?: number;
}

// --- Paquetes ---------------------------------------------------------------

/** Listar paquetes (técnico ve los suyos; admin ve todos) */
export async function listPaquetesGastos(
  params: { skip?: number; limit?: number; estado?: EstadoPaquete } = {}
): Promise<PaqueteListResponse> {
  const q = new URLSearchParams();
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  if (params.estado) q.set('estado', params.estado);
  return fetchAPI<PaqueteListResponse>(`/gastos/paquetes?${q.toString()}`);
}

/** Obtener detalle completo de un paquete */
export async function getPaqueteGasto(paqueteId: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}`);
}

/** Crear nuevo paquete semanal */
export async function createPaqueteGasto(semana: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>('/gastos/paquetes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semana }),
  });
}

// --- Workflow ---------------------------------------------------------------

/** Técnico envía el paquete para revisión */
export async function enviarPaquete(paqueteId: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}/enviar`, { method: 'POST' });
}

/** Admin aprueba el paquete */
export async function aprobarPaquete(paqueteId: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}/aprobar`, { method: 'POST' });
}

/** Admin devuelve el paquete con un motivo */
export async function devolverPaquete(paqueteId: string, motivo: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}/devolver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
}

/** Facturación envía el paquete aprobado a Tesorería */
export async function enviarATesoreria(paqueteId: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}/enviar-tesoreria`, { method: 'POST' });
}

/** Tesorería marca el paquete como pagado */
export async function pagarPaquete(paqueteId: string, fechaPago?: string): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(`/gastos/paquetes/${paqueteId}/pagar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha_pago: fechaPago ?? null }),
  });
}

/** Tesorería marca múltiples paquetes como pagados en una sola operación */
export async function pagarPaquetesMasivo(
  paqueteIds: string[],
  fechaPago?: string,
): Promise<{ pagados: number; errores: string[] }> {
  return fetchAPI(`/gastos/paquetes/pagar-masivo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paquete_ids: paqueteIds, fecha_pago: fechaPago ?? null }),
  });
}

// --- Gastos (líneas de detalle) ---------------------------------------------

/** Verifica si un número de recibo existe en el buzón de facturas */
export async function checkBuzon(noRecibo: string): Promise<{ existe: boolean; proveedor: string | null }> {
  return fetchAPI(`/gastos/check-buzon?no_recibo=${encodeURIComponent(noRecibo)}`);
}

/** Agregar línea de gasto */
export async function agregarGasto(paqueteId: string, data: GastoCreate): Promise<GastoOut> {
  return fetchAPI<GastoOut>(`/gastos/paquetes/${paqueteId}/gastos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Editar línea de gasto */
export async function editarGasto(
  paqueteId: string,
  gastoId: string,
  data: GastoUpdate
): Promise<GastoOut> {
  return fetchAPI<GastoOut>(`/gastos/paquetes/${paqueteId}/gastos/${gastoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Eliminar línea de gasto */
export async function eliminarGasto(paqueteId: string, gastoId: string): Promise<void> {
  return fetchAPI<void>(`/gastos/paquetes/${paqueteId}/gastos/${gastoId}`, {
    method: 'DELETE',
  });
}

// --- Archivos soporte -------------------------------------------------------

/** Subir soporte (PDF o imagen) para un gasto */
export async function subirArchivoGasto(
  paqueteId: string,
  gastoId: string,
  categoria: CategoriaGasto,
  file: File
): Promise<ArchivoGastoOut> {
  const formData = new FormData();
  formData.append('categoria', categoria);
  formData.append('file', file);
  return fetchAPI<ArchivoGastoOut>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/archivos`,
    { method: 'POST', body: formData }
  );
}

/** Eliminar soporte de un gasto por archivoId */
export async function eliminarArchivoGasto(
  paqueteId: string,
  gastoId: string,
  archivoId: string
): Promise<void> {
  return fetchAPI<void>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/archivos/${archivoId}`,
    { method: 'DELETE' }
  );
}

// --- IA: Extracción de datos desde imagen de factura -------------------

export interface ExtraccionDatosOut {
  no_identificacion: string | null;
  pagado_a: string | null;
  concepto: string | null;
  no_recibo: string | null;
  valor_pagado: string | null;
  fecha: string | null;
  confianza: 'alta' | 'media' | 'baja';
  campos_detectados: string[];
}

/** Extraer datos de factura desde imagen usando Claude Haiku */
export async function extraerDatosImagen(file: File): Promise<ExtraccionDatosOut> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI<ExtraccionDatosOut>('/gastos/extraer-datos-imagen', {
    method: 'POST',
    body: formData,
  });
}

/** Obtener URL de descarga del soporte por archivoId */
export async function getDownloadUrlArchivoGasto(
  paqueteId: string,
  gastoId: string,
  archivoId: string
): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/archivos/${archivoId}/download`
  );
}

/** Descargar soporte de un gasto vía proxy del backend (evita CORS con S3) */
export async function proxyDownloadArchivoGasto(
  paqueteId: string,
  gastoId: string,
  archivoId: string,
  filename: string
): Promise<void> {
  const token = getAccessToken();
  const url = `${API_BASE_URL}/gastos/paquetes/${paqueteId}/gastos/${gastoId}/archivos/${archivoId}/proxy-download`;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Error al descargar el archivo');
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// --- Aprobación de gerencia (nivel paquete) ----------------------------------

/** Subir aprobación de gerencia para un paquete */
export async function subirAprobacionGerencia(
  paqueteId: string,
  file: File
): Promise<PaqueteOut> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI<PaqueteOut>(
    `/gastos/paquetes/${paqueteId}/aprobacion`,
    { method: 'POST', body: formData }
  );
}

/** Obtener URL de descarga de la aprobación de gerencia */
export async function getAprobacionGerenciaDownloadUrl(
  paqueteId: string
): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>(
    `/gastos/paquetes/${paqueteId}/aprobacion/download`
  );
}

// --- Documento Contable General (nivel paquete) ------------------------------

/** Subir documento contable general para un paquete (solo Facturación, estado aprobado) */
export async function subirDocContable(
  paqueteId: string,
  file: File
): Promise<PaqueteOut> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI<PaqueteOut>(
    `/gastos/paquetes/${paqueteId}/doc-contable`,
    { method: 'POST', body: formData }
  );
}

/** Obtener URL de descarga del documento contable general */
export async function getDocContableDownloadUrl(
  paqueteId: string
): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>(
    `/gastos/paquetes/${paqueteId}/doc-contable/download`
  );
}

/** Eliminar el documento contable general de un paquete */
export async function eliminarDocContable(
  paqueteId: string
): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(
    `/gastos/paquetes/${paqueteId}/doc-contable`,
    { method: 'DELETE' }
  );
}

// --- CM PDF por gasto individual ---------------------------------------------

/** Subir CM PDF para un gasto individual (solo Facturación, estado aprobado) */
export async function subirCmPdfGasto(
  paqueteId: string,
  gastoId: string,
  file: File
): Promise<PaqueteOut> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI<PaqueteOut>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/cm-pdf`,
    { method: 'POST', body: formData }
  );
}

/** Obtener URL de descarga del CM PDF de un gasto */
export async function getCmPdfGastoDownloadUrl(
  paqueteId: string,
  gastoId: string
): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/cm-pdf/download`
  );
}

/** Eliminar el CM PDF de un gasto individual */
export async function eliminarCmPdfGasto(
  paqueteId: string,
  gastoId: string
): Promise<PaqueteOut> {
  return fetchAPI<PaqueteOut>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/cm-pdf`,
    { method: 'DELETE' }
  );
}

/** Reenviar correo de solicitud de aprobación al aprobador */
export async function reenviarCorreoAprobacion(
  paqueteId: string
): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(
    `/gastos/paquetes/${paqueteId}/reenviar-correo-aprobacion`,
    { method: 'POST' }
  );
}

// --- Devolución individual de gasto (Fase 3) ---------------------------------

/** Facturación devuelve un gasto individual con motivo */
export async function devolverGasto(
  paqueteId: string,
  gastoId: string,
  motivo: string
): Promise<GastoOut> {
  return fetchAPI<GastoOut>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/devolver`,
    {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }
  );
}

/** Técnico reenvía un gasto devuelto después de corregirlo */
export async function reenviarGasto(
  paqueteId: string,
  gastoId: string
): Promise<GastoOut> {
  return fetchAPI<GastoOut>(
    `/gastos/paquetes/${paqueteId}/gastos/${gastoId}/reenviar`,
    { method: 'POST' }
  );
}

/** Aprobar paquete por token (endpoint público, no requiere auth) */
export async function aprobarPaquetePorToken(token: string): Promise<PaqueteOut> {
  const API_BASE_URL_PUBLIC = (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    'https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1';
  const resp = await fetch(`${API_BASE_URL_PUBLIC}/gastos/paquetes/aprobar-por-token?token=${encodeURIComponent(token)}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(err.detail || `Error ${resp.status}`);
  }
  return resp.json();
}

// ─── Extracción IA desde PDF de factura pública ──────────────────────────────

export interface ExtraccionFacturaPdfOut {
  proveedor: string | null;
  numero_factura: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  total: string | null;
  confianza: 'alta' | 'media' | 'baja';
  campos_detectados: string[];
}

/** Extrae datos de una factura electrónica colombiana (PDF) usando Claude Sonnet */
export async function extraerDatosFacturaPdf(file: File): Promise<ExtraccionFacturaPdfOut> {
  const formData = new FormData();
  formData.append('file', file);
  return fetchAPI<ExtraccionFacturaPdfOut>('/facturas/extraer-datos-pdf', {
    method: 'POST',
    body: formData,
  });
}

// ─── Aprobadores de Gerencia ──────────────────────────────────────────────────

export interface AprobadorGerencia {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface AprobadorGerenciaCreate {
  nombre: string;
  cargo: string;
  email: string;
}

export interface AprobadorGerenciaUpdate {
  nombre?: string;
  cargo?: string;
  email?: string;
}

/** Lista todos los aprobadores (activos e inactivos) — para el panel admin */
export async function getAprobadoresGerencia(): Promise<AprobadorGerencia[]> {
  return fetchAPI<AprobadorGerencia[]>('/aprobadores-gerencia/');
}

/** Lista solo los aprobadores activos — para el selector al enviar correo */
export async function getAprobadoresActivos(): Promise<AprobadorGerencia[]> {
  return fetchAPI<AprobadorGerencia[]>('/aprobadores-gerencia/activos');
}

/** Crea un aprobador nuevo */
export async function crearAprobadorGerencia(data: AprobadorGerenciaCreate): Promise<AprobadorGerencia> {
  return fetchAPI<AprobadorGerencia>('/aprobadores-gerencia/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Edita un aprobador existente */
export async function actualizarAprobadorGerencia(
  id: string,
  data: AprobadorGerenciaUpdate,
): Promise<AprobadorGerencia> {
  return fetchAPI<AprobadorGerencia>(`/aprobadores-gerencia/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Activa o desactiva un aprobador */
export async function toggleAprobadorGerencia(id: string): Promise<AprobadorGerencia> {
  return fetchAPI<AprobadorGerencia>(`/aprobadores-gerencia/${id}/toggle`, { method: 'PATCH' });
}

/** Elimina un aprobador permanentemente */
export async function eliminarAprobadorGerencia(id: string): Promise<void> {
  return fetchAPI<void>(`/aprobadores-gerencia/${id}`, { method: 'DELETE' });
}

// ─── Aprobación de Facturas por Correo ───────────────────────────────────────

export interface AprobacionEmailOut {
  factura_id: string;
  numero_factura: string;
  proveedor: string;
  total: number;
  aprobado_por_nombre: string;
  aprobado_por_email: string;
  fecha_aprobacion_email: string;
}

/** Envía correo de aprobación al gerente seleccionado */
export async function enviarCorreoAprobacionFactura(
  facturaId: string,
  aprobadorId: string,
  comentario?: string,
): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(`/facturas/${facturaId}/enviar-correo-aprobacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobador_id: aprobadorId, ...(comentario ? { comentario } : {}) }),
  });
}

/** Aprueba una factura usando el token del correo (endpoint público, sin auth) */
export async function aprobarFacturaPorToken(token: string): Promise<AprobacionEmailOut> {
  const API_BASE_URL_PUBLIC =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    'https://r5k8qt1z4e.execute-api.us-east-2.amazonaws.com/v1/api/v1';
  const resp = await fetch(
    `${API_BASE_URL_PUBLIC}/facturas/aprobar-por-token?token=${encodeURIComponent(token)}`,
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Error desconocido' }));
    const detalle = Array.isArray(err.detail)
      ? 'El enlace de aprobación es inválido o ha expirado (72 horas).'
      : typeof err.detail === 'string'
      ? err.detail
      : `Error ${resp.status}`;
    throw new Error(detalle);
  }
  return resp.json();
}
