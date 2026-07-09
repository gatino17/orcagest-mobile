import * as SecureStore from 'expo-secure-store';
import {
  createActaEntrega,
  createCambioEquipoMantencion,
  createEquipo,
  createLevantamientoTerreno,
  createMantencionTerreno,
  createPermisoTrabajo,
  createRendicion,
  createRetiroTerreno,
  enviarRendicion,
  saveMaterialesArmado,
  updateActaEntrega,
  updateArmado,
  updateEquipo,
  updateLevantamientoTerreno,
  updateMantencionTerreno,
  updatePermisoTrabajo,
  updateRendicion,
  updateRetiroTerreno,
} from '@/lib/api';

type OpType =
  | 'save_materiales'
  | 'update_equipo'
  | 'create_equipo'
  | 'update_armado'
  | 'create_acta'
  | 'update_acta'
  | 'create_permiso'
  | 'update_permiso'
  | 'create_mantencion'
  | 'update_mantencion'
  | 'create_retiro'
  | 'update_retiro'
  | 'create_levantamiento'
  | 'update_levantamiento'
  | 'create_rendicion'
  | 'update_rendicion';

type PendingOp = {
  id: string;
  type: OpType;
  payload: any;
  createdAt: string;
};

type OfflineQueueStatus = {
  pending: number;
  notice: string;
};

const QUEUE_KEY = 'offline_queue_v2';
const NOTICE_KEY = 'offline_notice_v1';
const SYNC_MIN_INTERVAL_MS = 4000;

let syncingPromise: Promise<{ synced: number; pending: number }> | null = null;
let lastSyncAt = 0;
const statusListeners = new Set<(status: OfflineQueueStatus) => void>();

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const isOfflineQueueableError = (error: any) => {
  if (!error) return false;
  if (error?.response) return false;
  if (error?.code === 'ECONNABORTED') return true;
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('timeout') || msg.includes('offline');
};

const readQueue = async (): Promise<PendingOp[]> => {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: PendingOp[]) => {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
};

const setNotice = async (message: string) => {
  await SecureStore.setItemAsync(NOTICE_KEY, message);
};

export const getOfflineNotice = async () => {
  return (await SecureStore.getItemAsync(NOTICE_KEY)) || '';
};

const emitStatus = (status: OfflineQueueStatus) => {
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // ignore listener errors
    }
  });
};

export const getOfflineStatus = async (): Promise<OfflineQueueStatus> => {
  const [pending, notice] = await Promise.all([getPendingCount(), getOfflineNotice()]);
  return { pending, notice };
};

export const refreshOfflineStatus = async () => {
  const status = await getOfflineStatus();
  emitStatus(status);
  return status;
};

export const subscribeOfflineQueueStatus = (listener: (status: OfflineQueueStatus) => void) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};

export const clearOfflineNotice = async () => {
  await SecureStore.deleteItemAsync(NOTICE_KEY);
  await refreshOfflineStatus();
};

export const getPendingCount = async () => {
  const queue = await readQueue();
  return queue.length;
};

export const listPendingOfflineOps = async () => {
  return readQueue();
};

export const enqueueOfflineOp = async (type: OpType, payload: any) => {
  const queue = await readQueue();
  queue.push({ id: uid(), type, payload, createdAt: new Date().toISOString() });
  await writeQueue(queue);
  const notice = 'Sin red: hay cambios pendientes por sincronizar.';
  await setNotice(notice);
  emitStatus({ pending: queue.length, notice });
};

const execOp = async (op: PendingOp) => {
  if (op.type === 'save_materiales') {
    return saveMaterialesArmado(op.payload.armadoId, op.payload.materiales);
  }
  if (op.type === 'update_equipo') {
    return updateEquipo(op.payload.id_equipo, op.payload.data);
  }
  if (op.type === 'create_equipo') {
    return createEquipo(op.payload.data);
  }
  if (op.type === 'update_armado') {
    return updateArmado(op.payload.armadoId, op.payload.data);
  }
  if (op.type === 'create_acta') {
    return createActaEntrega(op.payload.data);
  }
  if (op.type === 'update_acta') {
    return updateActaEntrega(op.payload.id, op.payload.data);
  }
  if (op.type === 'create_permiso') {
    return createPermisoTrabajo(op.payload.data);
  }
  if (op.type === 'update_permiso') {
    return updatePermisoTrabajo(op.payload.id, op.payload.data);
  }
  if (op.type === 'create_mantencion') {
    const result = await createMantencionTerreno(op.payload.data);
    const mantId = Number(result?.mantencion?.id_mantencion_terreno || 0) || 0;
    if (mantId > 0 && op.payload.cambioEquipo) {
      await createCambioEquipoMantencion(mantId, op.payload.cambioEquipo);
    }
    return result;
  }
  if (op.type === 'update_mantencion') {
    const result = await updateMantencionTerreno(op.payload.id, op.payload.data);
    if (Number(op.payload.id || 0) > 0 && op.payload.cambioEquipo) {
      await createCambioEquipoMantencion(op.payload.id, op.payload.cambioEquipo);
    }
    return result;
  }
  if (op.type === 'create_retiro') {
    return createRetiroTerreno(op.payload.data);
  }
  if (op.type === 'update_retiro') {
    return updateRetiroTerreno(op.payload.id, op.payload.data);
  }
  if (op.type === 'create_levantamiento') {
    return createLevantamientoTerreno(op.payload.data);
  }
  if (op.type === 'update_levantamiento') {
    return updateLevantamientoTerreno(op.payload.id, op.payload.data);
  }
  if (op.type === 'create_rendicion') {
    const result = await createRendicion(op.payload.data);
    const rendicionId = Number(result?.rendicion?.id_rendicion || 0) || 0;
    if (op.payload.sendAfter && rendicionId > 0) {
      await enviarRendicion(rendicionId);
    }
    return result;
  }
  if (op.type === 'update_rendicion') {
    const result = await updateRendicion(op.payload.id, op.payload.data);
    if (op.payload.sendAfter && Number(op.payload.id || 0) > 0) {
      await enviarRendicion(op.payload.id);
    }
    return result;
  }
  return null;
};

export const syncOfflineQueue = async () => {
  const now = Date.now();
  if (syncingPromise) return syncingPromise;
  if (now - lastSyncAt < SYNC_MIN_INTERVAL_MS) {
    return { synced: 0, pending: await getPendingCount() };
  }

  const run = async () => {
    const queue = await readQueue();
    if (!queue.length) {
      await SecureStore.deleteItemAsync(NOTICE_KEY);
      lastSyncAt = Date.now();
      emitStatus({ pending: 0, notice: '' });
      return { synced: 0, pending: 0 };
    }

    const syncingNotice = 'Red estable: se esta subiendo lo pendiente.';
    await setNotice(syncingNotice);
    emitStatus({ pending: queue.length, notice: syncingNotice });

    const remaining: PendingOp[] = [];
    let synced = 0;

    for (let idx = 0; idx < queue.length; idx += 1) {
      const op = queue[idx];
      try {
        await execOp(op);
        synced += 1;
      } catch (error) {
        if (isOfflineQueueableError(error)) {
          remaining.push(op, ...queue.slice(idx + 1));
          break;
        }
        // Si falla por validacion/servidor, descartamos ese op para no bloquear toda la cola.
      }
    }

    await writeQueue(remaining);
    let finalNotice = '';
    if (remaining.length === 0 && synced > 0) {
      finalNotice = 'Todo en linea y subido.';
      await setNotice(finalNotice);
    } else if (remaining.length > 0) {
      finalNotice = 'Sin red: hay cambios pendientes por sincronizar.';
      await setNotice(finalNotice);
    } else {
      await SecureStore.deleteItemAsync(NOTICE_KEY);
    }
    emitStatus({ pending: remaining.length, notice: finalNotice });
    lastSyncAt = Date.now();
    return { synced, pending: remaining.length };
  };

  syncingPromise = run();
  try {
    return await syncingPromise;
  } finally {
    syncingPromise = null;
  }
};
