// ==========================================
// Socket.io 事件枚举
// ==========================================
export enum SocketEvents {
  // 祝福相关
  C2S_SEND_BLESSING = 'c2s_send_blessing',
  S2C_BROADCAST_BLESSING = 's2c_broadcast_blessing',

  // 游戏相关
  C2S_GAME_ACTION = 'c2s_game_action',
  S2C_GAME_STATE_TICK = 's2c_game_state_tick',
  C2S_JOIN_GAME = 'c2s_join_game',
  S2C_GAME_START = 's2c_game_start',
  S2C_GAME_END = 's2c_game_end',

  // 抽奖相关
  C2S_JOIN_LOTTERY = 'c2s_join_lottery',
  S2C_LOTTERY_RESULT = 's2c_lottery_result',
  S2C_LOTTERY_POOL_UPDATE = 's2c_lottery_pool_update',
  S2C_ENERGY_UPDATE = 's2c_energy_update',

  // 系统
  S2C_CONNECTED = 's2c_connected',
  S2C_ERROR = 's2c_error',

  // 新增互动
  C2S_BROADCAST_USERINFO = 'c2s_broadcast_userinfo',
  S2C_BROADCAST_USERINFO = 's2c_broadcast_userinfo',

  C2S_BROADCAST_MUYU = 'c2s_broadcast_muyu',
  S2C_BROADCAST_MUYU = 's2c_broadcast_muyu',
}

// ==========================================
// 数据载荷类型定义
// ==========================================

/** 祝福消息载荷 */
export interface BlessingPayload {
  userId: string;
  avatar: string;
  nickname: string;
  content: string; 
  category?: string;
  timestamp: number;
}

/** 游戏动作载荷 (如摇一摇) */
export interface GameActionPayload {
  userId: string;
  actionType: 'shake' | 'tap' | 'swipe';
  value: number; // 聚合后的动作值
  timestamp: number;
}

/** 游戏状态快照 (服务端广播) */
export interface GameStateTick {
  players: PlayerState[];
  countdown: number; // 剩余时间 (秒)
  tick: number;
}

/** 玩家状态 */
export interface PlayerState {
  userId: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
}

/** 能量球更新 */
export interface EnergyUpdate {
  totalBlessings: number;
  energyLevel: number; // 0-1
  phase: 'gathering' | 'exploding' | 'result';
}

/** 抽奖结果 */
export interface LotteryResult {
  winners: PlayerState[];
  prizeName: string;
}

/** 抽奖池更新 */
export interface LotteryPoolUpdate {
  participants: UserInfo[];
  total: number;
}

/** 用户信息 */
export interface UserInfo {
  userId: string;
  nickname: string;
  avatar: string;
}

/** 服务端->客户端 事件映射 */
export interface ServerToClientEvents {
  [SocketEvents.S2C_BROADCAST_BLESSING]: (payload: BlessingPayload) => void;
  [SocketEvents.S2C_GAME_STATE_TICK]: (payload: GameStateTick) => void;
  [SocketEvents.S2C_GAME_START]: (payload: { countdown: number }) => void;
  [SocketEvents.S2C_GAME_END]: (payload: GameStateTick) => void;
  [SocketEvents.S2C_LOTTERY_RESULT]: (payload: LotteryResult) => void;
  [SocketEvents.S2C_LOTTERY_POOL_UPDATE]: (payload: LotteryPoolUpdate) => void;
  [SocketEvents.S2C_ENERGY_UPDATE]: (payload: EnergyUpdate) => void;
  [SocketEvents.S2C_CONNECTED]: (payload: { userId: string }) => void;
  [SocketEvents.S2C_ERROR]: (payload: { message: string }) => void;
  [SocketEvents.S2C_BROADCAST_USERINFO]: (payload: UserInfo) => void;
  [SocketEvents.S2C_BROADCAST_MUYU]: (payload: UserInfo) => void;
}

/** 客户端->服务端 事件映射 */
export interface ClientToServerEvents {
  [SocketEvents.C2S_SEND_BLESSING]: (payload: BlessingPayload) => void;
  [SocketEvents.C2S_GAME_ACTION]: (payload: GameActionPayload) => void;
  [SocketEvents.C2S_JOIN_GAME]: (payload: UserInfo) => void;
  [SocketEvents.C2S_JOIN_LOTTERY]: (payload: UserInfo) => void;
  [SocketEvents.C2S_BROADCAST_USERINFO]: (payload: UserInfo) => void;
  [SocketEvents.C2S_BROADCAST_MUYU]: (payload: UserInfo) => void;
}
