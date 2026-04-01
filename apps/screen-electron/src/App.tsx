import { useState, useEffect } from 'react';
import { SocketEvents } from '@pkg/shared-types';
import type { BlessingPayload, GameStateTick, UserInfo } from '@pkg/shared-types';
import { socket } from './socket.js';
import { AlbumViewer } from './components/AlbumViewer.js';
import { LotteryMarsStage } from './components/LotteryMarsStage.js';
import { DanmakuOverlay } from './components/DanmakuOverlay.js';
import { KOBlessingStage } from './components/KOBlessingStage.js';

type ScreenMode = 'lottery' | 'game' | 'album' | 'ko';

export default function App() {
  const [mode, setMode] = useState<ScreenMode>('lottery');
  const [blessings, setBlessings] = useState<BlessingPayload[]>([]);
  const [lotteryUsers, setLotteryUsers] = useState<UserInfo[]>([]);
  const [gameState, setGameState] = useState<GameStateTick | null>(null);
  const [muyus, setMuyus] = useState<{id: string; x: number; delta: number}[]>([]);
  const [userAnimations, setUserAnimations] = useState<{id: string; avatar: string}[]>([]);

  useEffect(() => {
    // 祝福
    socket.on(SocketEvents.S2C_BROADCAST_BLESSING, (payload) => {
      setBlessings((prev) => [...prev.slice(-300), payload]); // 增加历史缓存以防丢失，并展示最新的
    });

    socket.on(SocketEvents.S2C_LOTTERY_POOL_UPDATE, (payload) => {
            console.log('S2C_LOTTERY_POOL_UPDATE:', payload);
      setLotteryUsers(payload.participants);
    });

    // 游戏状态
    socket.on(SocketEvents.S2C_GAME_STATE_TICK, (payload) => {
      setGameState(payload);
    });

    socket.on(SocketEvents.S2C_BROADCAST_USERINFO, (payload) => {
      console.log('S2C_BROADCAST_USERINFO:', payload);
      setUserAnimations((prev) => [...prev, { id: Date.now() + Math.random().toString(), avatar: payload.avatar }]);
      setTimeout(() => {
        setUserAnimations((prev) => prev.slice(1));
      }, 3000);
    });

    socket.on(SocketEvents.S2C_BROADCAST_MUYU, (payload) => {
      console.log('S2C_BROADCAST_MUYU:', payload);
      // 底部的木鱼漂浮飞行动画依然保留，但可以修改为“许愿+1”
      setMuyus((prev) => [...prev, { id: Date.now() + Math.random().toString(), x: 10 + Math.random() * 80, delta: payload.muyuDelta || 1 }]);
      setTimeout(() => {
        setMuyus((prev) => prev.slice(1));
      }, 2000);

      // 发射同款弹幕，将消息内容定为“许愿 + 1”（其中1即count/muyuDelta）
      const pseudoBlessing: BlessingPayload = {
        userId: payload.userId,
        avatar: payload.avatar,
        nickname: payload.nickname,
        content: `许愿 + ${payload.muyuDelta || 1}`,
        timestamp: payload.timestamp || Date.now(),
        category: payload.category || mode, // 挂靠在当前 mode 或者 payload 带过来的 tab 上
      };
      setBlessings((prev) => [...prev.slice(-300), pseudoBlessing]);
    });

    return () => {
      socket.off(SocketEvents.S2C_BROADCAST_BLESSING);
      socket.off(SocketEvents.S2C_LOTTERY_POOL_UPDATE);
      socket.off(SocketEvents.S2C_GAME_STATE_TICK);
      socket.off(SocketEvents.S2C_BROADCAST_MUYU);
      socket.off(SocketEvents.S2C_BROADCAST_USERINFO);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      await window.electronAPI.toggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }
  };

  // 根据当前模块过滤弹幕 (兼容老数据或未分类数据则都显示在 lottery 或者默认)
  const currentCategoryBlessings = blessings.filter(b => {
    if (!b.category) return mode === 'lottery'; // 之前的默认为抽奖
    if (mode === 'ko') return b.category === 'ko';
    if (mode === 'album') return b.category === 'album';
    if (mode === 'lottery') return b.category === 'lottery';
    return false;
  });

  return (
    <div className="screen-app">
      {/* 导航 */}
      <div className="screen-nav-right">
        <button
          className={mode === 'lottery' ? 'active' : ''}
          onClick={() => setMode('lottery')}
          title="抽奖 / 能量球"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8-4.5 7.5h9Z"/></svg>
        </button>
        <button
          className={mode === 'album' ? 'active' : ''}
          onClick={() => setMode('album')}
          title="相册轮播"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </button>
        <button
          className={mode === 'ko' ? 'active' : ''}
          onClick={() => setMode('ko')}
          title="KO祝福语"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a5 5 0 0 1 10-2 5 5 0 0 1 10 2Z"/></svg>
        </button>

        {/* 全局全屏按钮 */}
        <button onClick={toggleFullscreen} title="全屏切换">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>

      {/* 弹幕浮层 (全局按类过滤) */}
      <DanmakuOverlay blessings={currentCategoryBlessings} mode={mode} />

      {/* 入场飞行动画 */}
      {userAnimations.map((u) => (
        <img
          key={u.id}
          src={u.avatar}
          alt=""
          style={{
            position: 'absolute',
            left: '-100px',
            bottom: '-100px',
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '4px solid #fff',
            boxShadow: '0 0 15px rgba(255,255,255,0.8)',
            animation: 'flyToPlanet 2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        />
      ))}
      <style>{`
        @keyframes flyToPlanet {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          20% { opacity: 1; transform: translate(25vw, -25vh) scale(1.5); }
          80% { opacity: 1; transform: translate(50vw, -45vh) scale(2); }
          100% { transform: translate(60vw, -60vh) scale(0); opacity: 0; }
        }
      `}</style>

      {/* 木鱼动画层 */}
      {muyus.map((m) => (
        <div
          key={m.id}
          style={{
            position: 'absolute',
            left: `${m.x}%`,
            bottom: '20%',
            fontSize: '40px',
            animation: 'floatUp 2s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          🐟 许愿+{m.delta}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }
      `}</style>
      
      {/* 抽奖 */}
      {mode === 'lottery' && (
        <LotteryMarsStage users={lotteryUsers} blessingsCount={currentCategoryBlessings.length} />
      )}

      {/* KO 祝福区域 */}
      {mode === 'ko' && <KOBlessingStage />}

      {/* 游戏排行 (之前的老逻辑暂存，如果不玩游戏了可以移除，这里保留以免破坏老结构) */}
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
