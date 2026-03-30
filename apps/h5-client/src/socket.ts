import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@pkg/shared-types';

const urlParams = new URLSearchParams(window.location.search);
const serverFromUrl = urlParams.get('server');

const SERVER_URL = serverFromUrl || import.meta.env.VITE_SERVER_URL || 'ws://localhost:3000';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  {
    transports: ['websocket'], // 强制使用 ws 协议，跳过 http 轮询，避免 https 下的 Mixed Content 拦截
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  }
);
