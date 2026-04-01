import { useState, useEffect, useRef } from 'react';
import { SocketEvents } from '@pkg/shared-types';
import type { BlessingPayload, GameStateTick, UserInfo } from '@pkg/shared-types';
import { socket } from './socket.js';
import { AlbumViewer } from './components/AlbumViewer.js';
import { LotteryMarsStage } from './components/LotteryMarsStage.js';
import { DanmakuOverlay } from './components/DanmakuOverlay.js';
import { KOBlessingStage } from './components/KOBlessingStage.js';

type ScreenMode = 'lottery' | 'game' | 'album' | 'ko';

const AVATARS = [
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*HfJHQ6LqG2QAAAAARSAAAAgAet58AQ/original',  
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*H5olTLPpQQkAAAAATEAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*61MXSpLhHMoAAAAAQlAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*ReoxQqecl8wAAAAARdAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*cdrPTYH2iEAAAAAARHAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*05SoSKPKvcQAAAAARzAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*UOfFRLxl810AAAAARNAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*mJYDToDk1osAAAAARYAAAAgAet58AQ/original'
];



export default function App() {
  const [mode, setMode] = useState<ScreenMode>('lottery');
  const [blessings, setBlessings] = useState<BlessingPayload[]>([]);
  const [lotteryUsers, setLotteryUsers] = useState<UserInfo[]>([]);
  console.log('lotteryUsers', lotteryUsers);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserInfo>>(() => {
    try {
      const cached = localStorage.getItem('mars_userProfiles');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  const [interactionStats, setInteractionStats] = useState<Record<string, { muyu: number; danmaku: number }>>(() => {
    try {
      const cached = localStorage.getItem('mars_interactionStats');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  const [gameState, setGameState] = useState<GameStateTick | null>(null);
  const [muyus, setMuyus] = useState<{id: string; x: number; delta: number}[]>([]);
  const [userAnimations, setUserAnimations] = useState<{id: string; avatar: string}[]>([]);

  useEffect(() => {
    localStorage.setItem('mars_interactionStats', JSON.stringify(interactionStats));
  }, [interactionStats]);

  useEffect(() => {
    localStorage.setItem('mars_userProfiles', JSON.stringify(userProfiles));
  }, [userProfiles]);

  useEffect(() => {
    // 加载默认用户数据
    fetch('./user.json')
      .then((res) => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const initUsers: UserInfo[] = data.map((item) => ({
            userId: item.userId,
            nickname: item.realName || `用户${item.userId.slice(-4)}`,
            avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], // 提供一个默认头像
          }));
          setLotteryUsers(initUsers);
        }
      })
      .catch((e) => console.error('Failed to load user.json:', e));

    // 祝福
    socket.on(SocketEvents.S2C_BROADCAST_BLESSING, (payload) => {
      if (!payload || typeof payload.userId !== 'string') return;
      
      const newBlessing = { ...payload, category: '*' }; // 强制标记为全局显示弹幕
      setBlessings((prev) => [...prev.slice(-300), newBlessing]); // 增加历史缓存以防丢失，并展示最新的      
      setInteractionStats((prev) => ({
        ...prev,
        [payload.userId]: {
          muyu: prev[payload.userId]?.muyu || 0,
          danmaku: (prev[payload.userId]?.danmaku || 0) + 1,
        }
      }));

      // 也将用户最新的头像和昵称同步到本地存档
      setUserProfiles((prev) => ({
        ...prev,
        [payload.userId]: {
          userId: payload.userId,
          nickname: payload.nickname || prev[payload.userId]?.nickname || `用户${payload.userId.slice(-4)}`,
          avatar: payload.avatar || prev[payload.userId]?.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
        }
      }));

      // 收到祝福时触发飞向中间动画
      // const animId = Date.now() + Math.random().toString();
      // setUserAnimations((prev) => [...prev, { id: animId, avatar: payload.avatar }]);
      // setTimeout(() => {
      //   setUserAnimations((prev) => prev.filter(u => u.id !== animId));
      // }, 3000);
    });

    socket.on(SocketEvents.S2C_LOTTERY_POOL_UPDATE, (payload) => {
      console.log('S2C_LOTTERY_POOL_UPDATE:', payload);
      if (!payload || !Array.isArray(payload.participants)) return;
      
      // 增量更新：仅添加当前列表中不存在的 userId
      setLotteryUsers(prev => {
        const existingIds = new Set(prev.map(u => u.userId));
        const newUsers = payload.participants.filter((u: any) => !existingIds.has(u.userId));
        if (newUsers.length > 0) {
          return [...prev, ...newUsers];
        }
        return prev;
      });
    });

    // 游戏状态
    socket.on(SocketEvents.S2C_GAME_STATE_TICK, (payload) => {
      if (!payload) return;
      setGameState(payload);
    });

    socket.on(SocketEvents.S2C_BROADCAST_USERINFO, (payload) => {
      console.log('S2C_BROADCAST_USERINFO:', payload);
      if (!payload || typeof payload.userId !== 'string') return;

      const updateList = (prev: UserInfo[]) => {
        const exists = prev.find((u) => u.userId === payload.userId);
        if (exists) {
          return prev.map((u) => {
            if (u.userId === payload.userId) {
              return {
                ...u,
                nickname: payload.nickname || `用户${payload.userId.slice(-4)}`,
                avatar: payload.avatar,
              };
            }
            return u;
          });
        } else {
          return [...prev, {
            userId: payload.userId,
            nickname: payload.nickname || `用户${payload.userId.slice(-4)}`,
            avatar: payload.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
          }];
        }
      };
      setLotteryUsers(updateList);

      // const animId = Date.now() + Math.random().toString();
      // setUserAnimations((prev) => [...prev, { id: animId, avatar: payload.avatar }]);
      // setTimeout(() => {
      //   setUserAnimations((prev) => prev.filter(u => u.id !== animId));
      // }, 3000);
    });

    socket.on(SocketEvents.S2C_BROADCAST_MUYU, (payload) => {
      console.log('S2C_BROADCAST_MUYU:', payload);
      if (!payload || typeof payload.userId !== 'string') return;
      
      // 发射同款弹幕，将消息内容定为“许愿 + count”
      const pseudoBlessing: BlessingPayload = {
        userId: payload.userId,
        avatar: payload.avatar,
        nickname: payload.nickname,
        content: `许愿 + ${payload.muyuDelta || 1}`,
        timestamp: payload.timestamp || Date.now(),
        // 强制挂靠在当前大屏的 mode，以便无论用户在哪个页面敲木鱼，大屏都能直接飘弹幕
        category: '*', // 全局飘屏
      };
      setBlessings((prev) => [...prev.slice(-300), pseudoBlessing]);

      setInteractionStats((prev) => ({
        ...prev,
        [payload.userId]: {
          muyu: (prev[payload.userId]?.muyu || 0) + (payload.muyuDelta || 1),
          danmaku: prev[payload.userId]?.danmaku || 0,
        }
      }));

      // 也将用户最新的头像和昵称同步到本地存档
      setUserProfiles((prev) => ({
        ...prev,
        [payload.userId]: {
          userId: payload.userId,
          nickname: payload.nickname || prev[payload.userId]?.nickname || `用户${payload.userId.slice(-4)}`,
          avatar: payload.avatar || prev[payload.userId]?.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
        }
      }));

      //木鱼消息同样触发飞向中间动画
      const animId = Date.now() + Math.random().toString();
      setUserAnimations((prev) => [...prev, { id: animId, avatar: payload.avatar }]);
      setTimeout(() => {
        setUserAnimations((prev) => prev.filter(u => u.id !== animId));
      }, 3000);
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
    if (b.category === '*') return true; // 全局强行显示的弹幕
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
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 10px rgba(255,255,255,0.8)',
            animation: 'flyToPlanet 2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        />
      ))}
      <style>{`
        @keyframes flyToPlanet {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          20% { opacity: 1; transform: translate(25vw, -25vh) scale(1); }
          80% { opacity: 1; transform: translate(50vw, -45vh) scale(1.5); }
          100% { transform: translate(60vw, -60vh) scale(0); opacity: 0; }
        }
      `}</style>

      {/* 木鱼动画层 */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }
      `}</style>
      
      {/* 抽奖 */}
      {mode === 'lottery' && (
        <LotteryMarsStage 
          users={(lotteryUsers).map(u => ({
            ...u,
            nickname: userProfiles[u.userId]?.nickname || u.nickname,
            avatar: userProfiles[u.userId]?.avatar || u.avatar
          }))} 
          blessingsCount={currentCategoryBlessings.length}
          interactionStats={interactionStats}
        />
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
