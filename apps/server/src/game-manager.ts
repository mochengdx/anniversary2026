import type {
  PlayerState,
  GameStateTick,
  EnergyUpdate,
  BlessingPayload,
  GameActionPayload,
  UserInfo,
  LotteryResult,
} from '@pkg/shared-types';

/**
 * 游戏管理器 - 服务端权威状态中心
 * 所有分数计算、排名判定均在服务端闭环
 */
export class GameManager {
  private players: Map<string, PlayerState> = new Map();
  private blessings: BlessingPayload[] = [];
  private lotteryParticipants: Map<string, UserInfo> = new Map();
  private gameRunning = false;
  private gameCountdown = 0;
  private tickCount = 0;
  private energyLevel = 0;
  private energyPhase: EnergyUpdate['phase'] = 'gathering';

  // ===== 祝福/能量球 =====
  addBlessing(blessing: BlessingPayload) {
    this.blessings.push(blessing);
    // 能量值根据祝福数量递增，上限为 1
    this.energyLevel = Math.min(1, this.blessings.length / 100);
  }

  getEnergyState(): EnergyUpdate {
    return {
      totalBlessings: this.blessings.length,
      energyLevel: this.energyLevel,
      phase: this.energyPhase,
    };
  }

  setEnergyPhase(phase: EnergyUpdate['phase']) {
    this.energyPhase = phase;
  }

  // ===== 游戏 =====
  addPlayer(user: UserInfo) {
    this.players.set(user.userId, {
      ...user,
      score: 0,
      rank: 0,
    });
  }

  handleGameAction(action: GameActionPayload) {
    const player = this.players.get(action.userId);
    if (!player || !this.gameRunning) return;

    // 服务端权威计分
    player.score += action.value;
  }

  startGame(duration: number = 30) {
    this.gameRunning = true;
    this.gameCountdown = duration;
    this.tickCount = 0;

    // 重置所有玩家分数
    for (const player of this.players.values()) {
      player.score = 0;
      player.rank = 0;
    }

    // 倒计时
    const timer = setInterval(() => {
      this.gameCountdown -= 1;
      if (this.gameCountdown <= 0) {
        this.gameRunning = false;
        clearInterval(timer);
      }
    }, 1000);
  }

  isGameRunning(): boolean {
    return this.gameRunning;
  }

  getGameState(): GameStateTick {
    this.tickCount++;

    // 排名：按分数降序
    const sorted = Array.from(this.players.values()).sort(
      (a, b) => b.score - a.score
    );
    sorted.forEach((p, i) => {
      p.rank = i + 1;
    });

    return {
      players: sorted,
      countdown: this.gameCountdown,
      tick: this.tickCount,
    };
  }

  // ===== 抽奖 =====
  addLotteryParticipant(user: UserInfo) {
    this.lotteryParticipants.set(user.userId, user);
  }

  getLotteryParticipants(): UserInfo[] {
    return Array.from(this.lotteryParticipants.values());
  }

  drawLottery(winnerCount: number, prizeName: string): LotteryResult {
    const participants = Array.from(this.lotteryParticipants.values());
    // Fisher-Yates 洗牌
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    const winners: PlayerState[] = participants
      .slice(0, winnerCount)
      .map((p, i) => ({
        ...p,
        score: 0,
        rank: i + 1,
      }));

    return { winners, prizeName };
  }
}
