import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@pkg/shared-types';
import { setupSocketHandlers } from './socket-handlers.js';
import { GameManager } from './game-manager.js';

const PORT = Number(process.env.PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 由于编译后放在 dist 目录，往上跳一层就是 app/server，再进入 public
app.use('/h5', express.static(path.join(__dirname, '../public/h5')));
app.use('/screen', express.static(path.join(__dirname, '../public/screen')));

// HTTP 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 支持 HTTPS 配置
let server;
try {
  const privateKey = fs.readFileSync(path.join(__dirname, '../certs/server.key'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, '../certs/server.cert'), 'utf8');
  server = createHttpsServer({ key: privateKey, cert: certificate }, app);
  console.log('🔒 HTTPS certificates loaded successfully.');
} catch (error) {
  console.warn('⚠️  Could not load HTTPS certificates, falling back to HTTP. Please ensure certs/server.key and certs/server.cert exist.');
  server = createHttpServer(app);
}

// Socket.io 服务端，强类型事件
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // 高频互动场景优化
  pingInterval: 10000,
  pingTimeout: 5000,
});

// 初始化游戏管理器
const gameManager = new GameManager();

// 注册 Socket 事件处理
setupSocketHandlers(io, gameManager);

server.listen(PORT, () => {
  const protocol = server instanceof createHttpServer ? 'HTTP' : 'HTTPS';
  console.log(`🚀 ${protocol} Server running at ${protocol.toLowerCase()}://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for connections over ${protocol}`);
});
