import { useEffect, useState, useRef } from 'react';
import type { BlessingPayload } from '@pkg/shared-types';

interface DanmakuItem extends BlessingPayload {
  id: string;
  top: number;
  duration: number;
}

export function DanmakuOverlay({ blessings, mode }: { blessings: BlessingPayload[], mode?: string }) {
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const prevModeRef = useRef<string | undefined>(mode);
  const prevLatestRef = useRef<BlessingPayload | null>(null);

  useEffect(() => {
    // If the mode has switched, clear the current danmaku to isolate modules
    if (mode !== prevModeRef.current) {
      setItems([]);
      prevModeRef.current = mode;
      
      // We skip rendering the existing 'latest' upon switch to avoid re-triggering old messages
      if (blessings.length > 0) {
        prevLatestRef.current = blessings[blessings.length - 1];
      }
      return;
    }

    if (blessings.length === 0) {
      prevLatestRef.current = null;
      return;
    }

    const latest = blessings[blessings.length - 1];

    // If there is a completely new message arrived in the current mode
    if (latest && latest !== prevLatestRef.current) {
      const newItem: DanmakuItem = {
        ...latest,
        id: `${latest.userId}-${Date.now()}-${Math.random()}`,
        top: Math.random() * 60 + 10,
        duration: Math.random() * 6 + 10,
      };
      setItems((prev) => [...prev, newItem].slice(-40));
      prevLatestRef.current = latest;
    }
  }, [blessings, mode]);

  const handleAnimationEnd = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="danmaku-container">
      {items.map((item) => (
        <div
          key={item.id}
          className="danmaku-item"
          style={{
            top: `${item.top}%`,
            animationDuration: `${item.duration}s`,
          }}
          onAnimationEnd={() => handleAnimationEnd(item.id)}
        >
          <img src={item.avatar} alt="avatar" />
          <span className="name">{item.nickname}: </span>
          <span className="text">{item.content}</span>
        </div>
      ))}
    </div>
  );
}
