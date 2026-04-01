import { useState, useEffect, useCallback, useMemo } from 'react';
import { SocketEvents } from '@pkg/shared-types';
import type { BlessingPayload, GameActionPayload } from '@pkg/shared-types';
import { socket } from './socket.js';

type Tab = 'lottery' | 'album' | 'ko';

const AVATARS = [
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*HfJHQ6LqG2QAAAAARSAAAAgAet58AQ/original',  
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*H5olTLPpQQkAAAAATEAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*H5olTLPpQQkAAAAATEAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*H5olTLPpQQkAAAAATEAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*61MXSpLhHMoAAAAAQlAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*61MXSpLhHMoAAAAAQlAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*ReoxQqecl8wAAAAARdAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*cdrPTYH2iEAAAAAARHAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*05SoSKPKvcQAAAAARzAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*UOfFRLxl810AAAAARNAAAAgAet58AQ/original',
  'https://mdn.alipayobjects.com/huamei_b5s5sy/afts/img/A*mJYDToDk1osAAAAARYAAAAgAet58AQ/original'
];

export default function App() {
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('2088102516742495');
  const [activeTab, setActiveTab] = useState<Tab>('lottery');
  const [blessingText, setBlessingText] = useState('');
  const [nickname, setNickname] = useState('');
  const [sent, setSent] = useState(false);

  const randomAvatar = useMemo(() => AVATARS[Math.floor(Math.random() * AVATARS.length)], []);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(SocketEvents.S2C_CONNECTED, ({ userId: id }) => {
      setUserId(id);
      socket.emit(SocketEvents.C2S_BROADCAST_USERINFO, {
        userId: id,
        nickname: nickname.trim() || `用户${id.slice(-4)}`,
        avatar: randomAvatar
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off(SocketEvents.S2C_CONNECTED);
    };
  }, []);

  const sendMuyu = useCallback(() => {
    if (!userId) return;
    const userInfo = {
      userId,
      nickname: nickname.trim() || `用户${userId.slice(-4)}`,
      avatar: randomAvatar
    };
    socket.emit(SocketEvents.C2S_BROADCAST_USERINFO, userInfo);
    socket.emit(SocketEvents.C2S_BROADCAST_MUYU, userInfo);
  }, [userId, nickname, randomAvatar]);

  const sendBlessing = useCallback(() => {
    if (!blessingText.trim()) return;

    const userInfo = {
      userId,
      nickname: nickname.trim() || `用户${userId.slice(-4)}`,
      avatar: randomAvatar
    };
    
    // 更新一次用户信息
    socket.emit(SocketEvents.C2S_BROADCAST_USERINFO, userInfo);

    const payload: BlessingPayload = {
      ...userInfo,
      content: blessingText.trim(),
      timestamp: Date.now(),
      category: activeTab,
    };

    socket.emit(SocketEvents.C2S_SEND_BLESSING, payload);
    setBlessingText('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }, [blessingText, userId, nickname, randomAvatar, activeTab]);

  return (
    <div className="app">
      <h1>🎉 KO 互动</h1>

      <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● 已连接' : '○ 连接中...'}
      </span>

      <div className="tab-bar">
        <button
          className={activeTab === 'lottery' ? 'active' : ''}
          onClick={() => setActiveTab('lottery')}
        >
          抽奖许愿
        </button>
        <button
          className={activeTab === 'album' ? 'active' : ''}
          onClick={() => setActiveTab('album')}
        >
          相册弹幕
        </button>
        <button
          className={activeTab === 'ko' ? 'active' : ''}
          onClick={() => setActiveTab('ko')}
        >
          KO祝福语
        </button>
      </div>

      <div className="panel">
        <div className="blessing-input">
          <input
            type="text"
            className="nickname-input"
            maxLength={10}
            placeholder="花名 (选填)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: 8, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 6 }}
          />
          <textarea
            placeholder={`写下你的${activeTab === 'lottery' ? '许愿内容' : activeTab === 'album' ? '相册弹幕' : 'KO祝福'}...`}
            value={blessingText}
            onChange={(e) => setBlessingText(e.target.value)}
            maxLength={200}
          />
          <button className="btn-primary" onClick={sendMuyu} style={{ marginBottom: 10, background: '#ff9800' }}>
            🐟 敲木鱼
          </button>
          <button className="btn-primary" onClick={sendBlessing}>
            {sent ? '✅ 已发送！' : '🚀 发送消息'}
          </button>
        </div>
      </div>
    </div>
  );
}

