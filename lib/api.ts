import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Base de API: toma .env primero; en dev usa localhost:5000; fallback prod.
const envBase = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
const devLocal =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api' // emulador Android
    : 'http://localhost:5000/api'; // iOS sim / web

export const BASE_URL =
  envBase ||
  (__DEV__ ? devLocal : 'https://orcagest.orcatecnologia.net/api');

export const SOCKET_URL = BASE_URL.replace(/\/api\/?$/i, '');
export const SOCKET_TRANSPORTS =
  __DEV__ || process.env.EXPO_PUBLIC_SOCKET_POLLING_ONLY === '1'
    ? (['polling'] as const)
    : (['websocket', 'polling'] as const);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Adjunta token si existe (excepto en /auth/login)
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  const isLogin = (config.url || '').includes('/auth/login');
  if (token && !isLogin) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data; // espera {access_token:...}
};

export const getArmados = async (params?: Record<string, any>) => {
  const res = await api.get('/armados/', { params });
  return res.data;
};

export const updateArmado = async (armadoId: string | number, payload: any) => {
  const res = await api.put(`/armados/${armadoId}`, payload);
  return res.data;
};

// Armado detalle: materiales, movimientos, etc.
export const getMaterialesArmado = async (armadoId: string | number) => {
  const res = await api.get(`/armados/${armadoId}/materiales`);
  return res.data;
};

export const saveMaterialesArmado = async (armadoId: string | number, materiales: any) => {
  const res = await api.put(`/armados/${armadoId}/materiales`, materiales);
  return res.data;
};

export const getMovimientosArmado = async (armadoId: string | number) => {
  const res = await api.get(`/armados/${armadoId}/movimientos`);
  return res.data;
};

// Equipos por centro (misma ruta que frontend web)
export const getEquipos = async (centro_id?: string | number) => {
  const res = await api.get('/equipos', { params: { centro_id } });
  return res.data;
};

export const createEquipo = async (payload: any) => {
  const res = await api.post('/equipos', payload);
  return res.data;
};

export const updateEquipo = async (id_equipo: string | number, payload: any) => {
  const res = await api.put(`/equipos/${id_equipo}`, payload);
  return res.data;
};

export const validarSerieEquipo = async (
  numero_serie: string,
  params?: { exclude_equipo_id?: string | number; centro_id?: string | number }
) => {
  const res = await api.get('/equipos/validar-serie', {
    params: {
      numero_serie,
      ...(params?.exclude_equipo_id ? { exclude_equipo_id: params.exclude_equipo_id } : {}),
      ...(params?.centro_id ? { centro_id: params.centro_id } : {}),
    },
  });
  return res.data;
};

// Consulta centro (mismos endpoints que el frontend web)
export const fetchClientes = async () => {
  try {
    const res = await api.get('/consultas_centro/clientes');
    return res.data;
  } catch {
    // Fallback para entornos donde consultas_centro aun no esta publicado.
    const res = await api.get('/clientes/');
    return res.data;
  }
};

export const fetchCentrosPorCliente = async (clienteId: string | number) => {
  try {
    const res = await api.get(`/consultas_centro/centros/${clienteId}`);
    return res.data;
  } catch {
    // Fallback: reconstruye centros por cliente desde /centros y /clientes.
    const [clientesRes, centrosRes] = await Promise.all([
      api.get('/clientes/'),
      api.get('/centros/', { params: { per_page: 0 } }),
    ]);
    const clientes = Array.isArray(clientesRes.data) ? clientesRes.data : [];
    const centros = Array.isArray(centrosRes.data?.centros) ? centrosRes.data.centros : [];
    const cliente = clientes.find((c: any) => Number(c?.id_cliente ?? c?.id ?? 0) === Number(clienteId));
    const nombreCliente = String(cliente?.nombre || '').trim().toLowerCase();
    return centros
      .filter((c: any) => String(c?.cliente || '').trim().toLowerCase() === nombreCliente)
      .map((c: any) => ({
        id_centro: c?.id,
        nombre: c?.nombre,
        cliente_id: Number(clienteId),
        ubicacion: c?.ubicacion,
        localidad: c?.ubicacion,
        direccion: c?.ubicacion,
        area: c?.area,
        region: c?.area,
        nombre_ponton: c?.nombre_ponton,
        correo_centro: c?.correo_centro ?? c?.correo,
        telefono: c?.telefono,
        base_tierra: c?.base_tierra,
        cantidad_radares: c?.cantidad_radares,
        estado: c?.estado,
      }));
  }
};

export const fetchHistorialCentro = async (centroId: string | number) => {
  const res = await api.get(`/consultas_centro/centro_historial/${centroId}`);
  return res.data;
};

// Informes centros - Actas de entrega
export const fetchActasEntrega = async (params?: Record<string, any>) => {
  const res = await api.get('/actas_entrega/', { params });
  return res.data;
};

export const createActaEntrega = async (payload: any) => {
  const res = await api.post('/actas_entrega/', payload);
  return res.data;
};

export const updateActaEntrega = async (idActa: string | number, payload: any) => {
  const res = await api.put(`/actas_entrega/${idActa}`, payload);
  return res.data;
};

export const deleteActaEntrega = async (idActa: string | number) => {
  const res = await api.delete(`/actas_entrega/${idActa}`);
  return res.data;
};

// Informes centros - Permisos de trabajo
export const fetchPermisosTrabajo = async (params?: Record<string, any>) => {
  const res = await api.get('/permisos_trabajo/', { params });
  return res.data;
};

export const createPermisoTrabajo = async (payload: any) => {
  const res = await api.post('/permisos_trabajo/', payload);
  return res.data;
};

export const updatePermisoTrabajo = async (idPermiso: string | number, payload: any) => {
  const res = await api.put(`/permisos_trabajo/${idPermiso}`, payload);
  return res.data;
};

export const deletePermisoTrabajo = async (idPermiso: string | number) => {
  const res = await api.delete(`/permisos_trabajo/${idPermiso}`);
  return res.data;
};

// Informes centros - Mantenciones en terreno
export const fetchMantencionesTerreno = async (params?: Record<string, any>) => {
  const res = await api.get('/mantenciones_terreno/', { params });
  return res.data;
};

export const createMantencionTerreno = async (payload: any) => {
  const res = await api.post('/mantenciones_terreno/', payload);
  return res.data;
};

export const updateMantencionTerreno = async (idMantencion: string | number, payload: any) => {
  const res = await api.put(`/mantenciones_terreno/${idMantencion}`, payload);
  return res.data;
};

export const deleteMantencionTerreno = async (idMantencion: string | number) => {
  const res = await api.delete(`/mantenciones_terreno/${idMantencion}`);
  return res.data;
};

export const fetchCambiosEquipoMantencion = async (idMantencion: string | number) => {
  const res = await api.get(`/mantenciones_terreno/${idMantencion}/cambios_equipo`);
  return res.data;
};

export const createCambioEquipoMantencion = async (
  idMantencion: string | number,
  payload: any
) => {
  const res = await api.post(`/mantenciones_terreno/${idMantencion}/cambios_equipo`, payload);
  return res.data;
};

// Informes centros - Retiros en terreno
export const fetchRetirosTerreno = async (params?: Record<string, any>) => {
  const res = await api.get('/retiros_terreno/', { params });
  return res.data;
};

export const createRetiroTerreno = async (payload: any) => {
  const res = await api.post('/retiros_terreno/', payload);
  return res.data;
};

export const updateRetiroTerreno = async (idRetiro: string | number, payload: any) => {
  const res = await api.put(`/retiros_terreno/${idRetiro}`, payload);
  return res.data;
};

export const deleteRetiroTerreno = async (idRetiro: string | number) => {
  const res = await api.delete(`/retiros_terreno/${idRetiro}`);
  return res.data;
};

// Programacion operativa (Calendario)
export const fetchActividadesMias = async (params?: Record<string, any>) => {
  const res = await api.get('/actividades/mias', { params });
  return res.data;
};

export const updateActividadCalendario = async (idActividad: string | number, payload: any) => {
  const res = await api.put(`/actividades/${idActividad}`, payload);
  return res.data;
};
