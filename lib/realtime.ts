import { io, type Socket } from 'socket.io-client';
import { SOCKET_TRANSPORTS, SOCKET_URL } from '@/lib/api';

type ArmadoUpdatedHandler = (evt: any) => void;

let socket: Socket | null = null;
let refs = 0;

const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: [...SOCKET_TRANSPORTS],
      reconnection: true,
    });
  }
  return socket;
};

export const subscribeArmadoUpdated = (handler: ArmadoUpdatedHandler) => {
  const s = getSocket();
  refs += 1;
  s.on('armado_updated', handler);

  return () => {
    s.off('armado_updated', handler);
    refs = Math.max(0, refs - 1);
    if (refs === 0) {
      s.disconnect();
      socket = null;
    }
  };
};

