import * as SecureStore from 'expo-secure-store';
import { createEquipo, saveMaterialesArmado, updateArmado, updateEquipo } from '@/lib/api';

type OpType = 'save_materiales' | 'update_equipo' | 'create_equipo' | 'update_armado';

type PendingOp = {
  id: string;
  type: OpType;
  payload: any;
  createdAt: string;
};

const QUEUE_KEY = 'offline_queue_v1';
const NOTICE_KEY = 'offline_notice_v1';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isNetworkError = (error: any) => {
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

export const clearOfflineNotice = async () => {
  await SecureStore.deleteItemAsync(NOTICE_KEY);
};

export const getPendingCount = async () => {
  const queue = await readQueue();
  return queue.length;
};

export const enqueueOfflineOp = async (type: OpType, payload: any) => {
  const queue = await readQueue();
  queue.push({ id: uid(), type, payload, createdAt: new Date().toISOString() });
  await writeQueue(queue);
  await setNotice('Sin red: queda pendiente subir armado.');
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
  return null;
};

export const syncOfflineQueue = async () => {
  const queue = await readQueue();
  if (!queue.length) return { synced: 0, pending: 0 };

  await setNotice('Red estable: se esta subiendo lo pendiente.');

  const remaining: PendingOp[] = [];
  let synced = 0;

  for (const op of queue) {
    try {
      await execOp(op);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        remaining.push(op, ...queue.slice(queue.indexOf(op) + 1));
        break;
      }
      // Si falla por validación/servidor, descartamos ese op para no bloquear toda la cola.
    }
  }

  await writeQueue(remaining);
  if (remaining.length === 0 && synced > 0) {
    await setNotice('Todo en linea y subido.');
  } else if (remaining.length > 0) {
    await setNotice('Sin red: queda pendiente subir armado.');
  }
  return { synced, pending: remaining.length };
};

