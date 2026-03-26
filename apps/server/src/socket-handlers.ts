import type { Server } from 'socket.io';
import {
  SocketEvents,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type BlessingPayload,
  type GameActionPayload,
  type UserInfo,
} from '@pkg/shared-types';
import { generateId } from '@pkg/utils';
import type { GameManager } from './game-manager.js';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gameManager: GameManager
) {
  io.on('connection', (socket) => {
    const userId = generateId();
    console.log(`✅ Client connected: ${socket.id} -> userId: ${userId}`);

    // 发送连接确认
    socket.emit(SocketEvents.S2C_CONNECTED, { userId });

    // ===== 祝福模块 =====
    socket.on(SocketEvents.C2S_SEND_BLESSING, (payload: BlessingPayload) => {
      console.log(`💌 Blessing from ${payload.nickname}: ${payload.content}`);

      // 广播给所有客户端（含大屏）
      io.emit(SocketEvents.S2C_BROADCAST_BLESSING, payload);

      // 更新能量球
      gameManager.addBlessing(payload);
      io.emit(SocketEvents.S2C_ENERGY_UPDATE, gameManager.getEnergyState());

      // 祝福用户默认加入抽奖池
      gameManager.addLotteryParticipant({
        userId: payload.userId,
        nickname: payload.nickname,
        avatar: payload.avatar,
      });
      io.emit(SocketEvents.S2C_LOTTERY_POOL_UPDATE, {
        participants: gameManager.getLotteryParticipants(),
        total: gameManager.getLotteryParticipants().length,
      });
    });

    // ===== 游戏模块 =====
    socket.on(SocketEvents.C2S_JOIN_GAME, (payload: UserInfo) => {
      gameManager.addPlayer(payload);
      console.log(`🎮 Player joined: ${payload.nickname}`);
    });

    socket.on(SocketEvents.C2S_GAME_ACTION, (payload: GameActionPayload) => {
      gameManager.handleGameAction(payload);
    });

    // ===== 抽奖模块 =====
    socket.on(SocketEvents.C2S_JOIN_LOTTERY, (payload: UserInfo) => {
      gameManager.addLotteryParticipant(payload);
      console.log(`🎰 Lottery join: ${payload.nickname}`);
      io.emit(SocketEvents.S2C_LOTTERY_POOL_UPDATE, {
        participants: gameManager.getLotteryParticipants(),
        total: gameManager.getLotteryParticipants().length,
      });
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  // 游戏状态广播 (固定 Tick Rate: 20Hz)
  const TICK_RATE = 20;
  setInterval(() => {
    if (gameManager.isGameRunning()) {
      const state = gameManager.getGameState();
      io.emit(SocketEvents.S2C_GAME_STATE_TICK, state);
    }
  }, 1000 / TICK_RATE);
}
