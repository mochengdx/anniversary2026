import { useState, useEffect } from 'react';
import { SocketEvents } from '@pkg/shared-types';
import type { BlessingPayload, GameStateTick, UserInfo } from '@pkg/shared-types';
import { socket } from './socket.js';
import { AlbumViewer } from './components/AlbumViewer.js';
import { LotteryMarsStage } from './components/LotteryMarsStage.js';

type ScreenMode = 'lottery' | 'game' | 'album';

export default function App() {
  const [mode, setMode] = useState<ScreenMode>('lottery');
  const [blessings, setBlessings] = useState<BlessingPayload[]>([]);
  const [lotteryUsers, setLotteryUsers] = useState<UserInfo[]>([]);
  const [gameState, setGameState] = useState<GameStateTick | null>(null);

  useEffect(() => {
    // 祝福
    socket.on(SocketEvents.S2C_BROADCAST_BLESSING, (payload) => {
      setBlessings((prev) => [...prev.slice(-50), payload]); // 保留最新 50 条
    });

    socket.on(SocketEvents.S2C_LOTTERY_POOL_UPDATE, (payload) => {
      setLotteryUsers(payload.participants);
    });

    // 游戏状态
    socket.on(SocketEvents.S2C_GAME_STATE_TICK, (payload) => {
      setGameState(payload);
    });

    return () => {
      socket.off(SocketEvents.S2C_BROADCAST_BLESSING);
      socket.off(SocketEvents.S2C_LOTTERY_POOL_UPDATE);
      socket.off(SocketEvents.S2C_GAME_STATE_TICK);
    };
  }, []);

  return (
    <div className="screen-app">
      {/* 导航 */}
      <div className="screen-nav">
        <button
          className={mode === 'lottery' ? 'active' : ''}
          onClick={() => setMode('lottery')}
        >
          🎰 抽奖 / 能量球
        </button>
        <button
          className={mode === 'game' ? 'active' : ''}
          onClick={() => setMode('game')}
        >
          🎮 摇一摇排行
        </button>
        <button
          className={mode === 'album' ? 'active' : ''}
          onClick={() => setMode('album')}
        >
          📷 相册轮播
        </button>
      </div>

      {/* 抽奖 */}
      {mode === 'lottery' && (
        <LotteryMarsStage users={lotteryUsers} blessingsCount={blessings.length} />
      )}

      {/* 游戏排行 */}
      {mode === 'game' && gameState && (
        <div className="leaderboard">
          <h2>🏆 实时排行榜</h2>
          {gameState.players.slice(0, 10).map((player) => (
            <div className="leaderboard-item" key={player.userId}>
              <span className="rank">#{player.rank}</span>
              <img src={player.avatar} alt="" />
              <div className="player-info">
                <div className="player-name">{player.nickname}</div>
              </div>
              <span className="player-score">{player.score}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 14, opacity: 0.5 }}>
            倒计时: {gameState.countdown}s
          </div>
        </div>
      )}

      {/* 相册 */}
      {mode === 'album' && <AlbumViewer />}
    </div>
  );
}
