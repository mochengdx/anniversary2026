import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@pkg/shared-types';

const urlParams = new URLSearchParams(window.location.search);
const serverFromUrl = urlParams.get('server');

const SERVER_URL = serverFromUrl || import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  }
);
