import { useState, useEffect, useCallback, useRef } from 'react';
import { SocketEvents } from '@pkg/shared-types';
import type { BlessingPayload, GameActionPayload } from '@pkg/shared-types';
import { throttle } from '@pkg/utils';
import { socket } from './socket.js';

type Tab = 'blessing' | 'game' | 'lottery';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('blessing');
  const [blessingText, setBlessingText] = useState('');
  const [score, setScore] = useState(0);
  const [sent, setSent] = useState(false);
  const [joinedLottery, setJoinedLottery] = useState(false);

  // 节流发送游戏动作 (100ms)
  const throttledSendAction = useRef(
    throttle((action: GameActionPayload) => {
      socket.emit(SocketEvents.C2S_GAME_ACTION, action);
    }, 100)
  ).current;

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(SocketEvents.S2C_CONNECTED, ({ userId: id }) => {
      setUserId(id);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off(SocketEvents.S2C_CONNECTED);
    };
  }, []);

  // ===== 祝福 =====
  const sendBlessing = useCallback(() => {
    if (!blessingText.trim()) return;

    const payload: BlessingPayload = {
      userId,
      avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${userId}`,
      nickname: `用户${userId.slice(-4)}`,
      content: blessingText.trim(),
      timestamp: Date.now(),
    };

    socket.emit(SocketEvents.C2S_SEND_BLESSING, payload);
    setBlessingText('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }, [blessingText, userId]);

  // ===== 摇一摇游戏 =====
  useEffect(() => {
    if (activeTab !== 'game') return;

    // 加入游戏
    socket.emit(SocketEvents.C2S_JOIN_GAME, {
      userId,
      nickname: `用户${userId.slice(-4)}`,
      avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${userId}`,
    });

    let lastShakeTime = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const force = Math.sqrt(
        (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2
      );

      // 摇动阈值
      if (force > 15 && Date.now() - lastShakeTime > 100) {
        lastShakeTime = Date.now();
        setScore((s) => s + 1);
        throttledSendAction({
          userId,
          actionType: 'shake',
          value: 1,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [activeTab, userId, throttledSendAction]);

  // 点击模拟摇一摇 (desktop fallback)
  const handleTap = useCallback(() => {
    setScore((s) => s + 1);
    throttledSendAction({
      userId,
      actionType: 'tap',
      value: 1,
      timestamp: Date.now(),
    });
  }, [userId, throttledSendAction]);

  const joinLottery = useCallback(() => {
    if (!userId) return;
    socket.emit(SocketEvents.C2S_JOIN_LOTTERY, {
      userId,
      nickname: `用户${userId.slice(-4)}`,
      avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${userId}`,
    });
    setJoinedLottery(true);
  }, [userId]);

  return (
    <div className="app">
      <h1>🎉 KO 互动</h1>

      <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● 已连接' : '○ 连接中...'}
      </span>

      <div className="tab-bar">
        <button
          className={activeTab === 'blessing' ? 'active' : ''}
          onClick={() => setActiveTab('blessing')}
        >
          抽奖许愿
        </button>
        <button
          className={activeTab === 'game' ? 'active' : ''}
          onClick={() => setActiveTab('game')}
        >
          摇一摇
        </button>
        <button
          className={activeTab === 'lottery' ? 'active' : ''}
          onClick={() => setActiveTab('lottery')}
        >
          抽奖报名
        </button>
      </div>

      <div className="panel">
        {activeTab === 'blessing' && (
          <div className="blessing-input">
            <textarea
              placeholder="写下你的请愿..."
              value={blessingText}
              onChange={(e) => setBlessingText(e.target.value)}
              maxLength={200}
            />
            <button className="btn-primary" onClick={sendBlessing}>
              {sent ? '✅ 已发送！' : '🚀 发送请愿'}
            </button>
          </div>
        )}

        {activeTab === 'game' && (
          <div className="shake-area" onClick={handleTap}>
            <div className="shake-score">{score}</div>
            <p className="shake-hint">📱 摇动手机或点击屏幕加分！</p>
          </div>
        )}

        {activeTab === 'lottery' && (
          <div className="lottery-join-box">
            <h3>🎰 鲸探五周年 · KO大会抽奖</h3>
            <p>点击下方按钮加入大屏抽奖池</p>
            <button className="btn-primary" onClick={joinLottery}>
              {joinedLottery ? '✅ 已报名成功' : '🚀 立即报名'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
