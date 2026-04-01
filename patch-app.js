const fs = require('fs');

function patch(file) {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('const [muyus, setMuyus]')) {
    content = content.replace(
      'const [blessings, setBlessings] = useState<BlessingPayload[]>([]);',
      `const [blessings, setBlessings] = useState<BlessingPayload[]>([]);
  const [muyus, setMuyus] = useState<{id: string; x: number}[]>([]);`
    );

    content = content.replace(
      'socket.on(SocketEvents.S2C_GAME_STATE_TICK, (payload) => {',
      `socket.on(SocketEvents.S2C_BROADCAST_MUYU, (payload) => {
      setMuyus(prev => [...prev, { id: Date.now() + Math.random().toString(), x: 10 + Math.random() * 80 }]);
      setTimeout(() => {
        setMuyus(prev => prev.slice(1));
      }, 2000);
    });

    socket.on(SocketEvents.S2C_GAME_STATE_TICK, (payload) => {`
    );

    content = content.replace(
      'socket.off(SocketEvents.S2C_GAME_STATE_TICK);',
      `socket.off(SocketEvents.S2C_GAME_STATE_TICK);
      socket.off(SocketEvents.S2C_BROADCAST_MUYU);`
    );

    content = content.replace(
      '{/* 抽�� */}',
      `{/* 木鱼动画层 */}
      {muyus.map(m => (
        <div key={m.id} style={{
          position: 'absolute',
          left: \\${m.x}%\\,
          bottom: '20%',
          fontSize: '40px',
          animation: 'floatUp 2s0ease-out forwards',
          pointerEvents: 'none',
          zIndex: 9999
        }}>
          🐟 功忷+1
        </div>
      ))}
      <style>{\\@(keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-200px) scale(1.5); opacity: 0; } }\\`}`.replace('(\\', '').replace(')\\', '') + `</style>

      {/* 抽�� */}`
    );
    
    fs.writeFileSync(file, content);
  }
}

patch('apps/screen-electron/src/App.tsx');
patch('apps/screen-web/src/App.tsx');
