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

// Consulta centro (mismos endpoints que el frontend web)
export const fetchClientes = async () => {
  const res = await api.get('/consultas_centro/clientes');
  return res.data;
};

export const fetchCentrosPorCliente = async (clienteId: string | number) => {
  const res = await api.get(`/consultas_centro/centros/${clienteId}`);
  return res.data;
};

export const fetchHistorialCentro = async (centroId: string | number) => {
  const res = await api.get(`/consultas_centro/centro_historial/${centroId}`);
  return res.data;
};
