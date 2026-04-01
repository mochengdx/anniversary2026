import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@pkg/shared-types';

const urlParams = new URLSearchParams(window.location.search);
const serverFromUrl = urlParams.get('server');

// Inside electron, window.location.origin might be file:// or something weird.
// Fallback safely to localhost if it's not starting with http
const defaultOrigin = (typeof window !== 'undefined' && window.location.origin.startsWith('http')) 
  ? window.location.origin 
  : 'ws://localhost:3000';

const SERVER_URL = serverFromUrl || import.meta.env.VITE_SERVER_URL || defaultOrigin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  {
    transports: ['websocket'], // 强制使用 ws 协议，跳过 http 轮询
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  }
);
