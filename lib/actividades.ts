import * as SecureStore from 'expo-secure-store';

import { fetchActividades, fetchActividadesMias } from '@/lib/api';

type ActividadAssignedOptions = {
  userId?: string | number | null;
  name?: string | null;
  allowGlobalFallback?: boolean;
};

const getCacheKey = (userId?: string | number | null) => `actividades_asignadas_cache_v1_${userId || 'anon'}`;

export const normalizeActividadText = (value: any) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const matchActividadTecnicoNombre = (candidate: any, currentName: any) => {
  const a = normalizeActividadText(candidate);
  const b = normalizeActividadText(currentName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = a.split(/\s+/).filter(Boolean);
  const tb = b.split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const commons = ta.filter((t) => tb.includes(t));
  return commons.length >= 2 || (commons.length >= 1 && (ta.length === 1 || tb.length === 1));
};

export const tipoActividadProgramada = (areaRaw?: string, nombreRaw?: string) => {
  const area = String(areaRaw || '').trim().toLowerCase();
  const nombre = String(nombreRaw || '').trim().toLowerCase();
  if (area.startsWith('reap') || nombre.includes('reap')) return 'reapuntamiento';
  if (area.startsWith('instal') || nombre.includes('instal')) return 'instalacion';
  if (area.startsWith('manten') || nombre.includes('manten')) return 'mantencion';
  if (area.startsWith('retir') || nombre.includes('retir')) return 'retiro';
  if (area.startsWith('levant') || nombre.includes('levant')) return 'levantamiento';
  return 'trabajo';
};

const filtrarNoCanceladas = (items: any[]) =>
  (Array.isArray(items) ? items : []).filter((item) => String(item?.estado || '').trim().toLowerCase() !== 'cancelado');

export const filtrarActividadesPorTecnico = (items: any[], options: ActividadAssignedOptions = {}) => {
  const userIdNum = Number(options?.userId || 0) || 0;
  const myName = String(options?.name || '').trim();
  return filtrarNoCanceladas(items).filter((item) => {
    const principalId = Number(item?.encargado_principal?.id_encargado || item?.tecnico_encargado || 0) || 0;
    const ayudanteId = Number(item?.encargado_ayudante?.id_encargado || item?.tecnico_ayudante || 0) || 0;
    if (userIdNum > 0 && (principalId === userIdNum || ayudanteId === userIdNum)) return true;
    if (!myName) return false;
    const nombres = [
      item?.encargado_principal?.nombre_encargado,
      item?.encargado_ayudante?.nombre_encargado,
      ...(Array.isArray(item?.tecnicos_asignados) ? item.tecnicos_asignados.map((t: any) => t?.nombre_encargado) : []),
    ]
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    return nombres.some((n) => matchActividadTecnicoNombre(n, myName));
  });
};

export const readCachedActividadesAsignadas = async (userId?: string | number | null) => {
  try {
    const raw = await SecureStore.getItemAsync(getCacheKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
};

export const writeCachedActividadesAsignadas = async (userId: string | number | null | undefined, items: any[]) => {
  try {
    await SecureStore.setItemAsync(
      getCacheKey(userId),
      JSON.stringify({
        items: Array.isArray(items) ? items : [],
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore cache write errors
  }
};

export const fetchActividadesAsignadasUsuario = async (options: ActividadAssignedOptions = {}) => {
  const listaMias = filtrarNoCanceladas(await fetchActividadesMias());
  if (listaMias.length > 0 || !options?.allowGlobalFallback) {
    return listaMias;
  }
  const all = await fetchActividades();
  return filtrarActividadesPorTecnico(all, options);
};
