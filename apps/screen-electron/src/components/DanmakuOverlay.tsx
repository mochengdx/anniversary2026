import { useEffect, useState } from 'react';
import type { BlessingPayload } from '@pkg/shared-types';

interface DanmakuItem extends BlessingPayload {
  id: string;
  top: number;
  duration: number;
}

export function DanmakuOverlay({ blessings }: { blessings: BlessingPayload[] }) {
  const [items, setItems] = useState<DanmakuItem[]>([]);

  useEffect(() => {
    if (blessings.length === 0) return;
    const latest = blessings[blessings.length - 1];

    // Every time a new blessing arrives, spawn a danmaku item
    const newItem: DanmakuItem = {
      ...latest,
      id: `${latest.userId}-${Date.now()}-${Math.random()}`,
      top: Math.random() * 60 + 10, // Random height from 10% to 70% from top
      duration: Math.random() * 6 + 10, // Takes between 10s and 16s to cross the screen
    };

    setItems((prev) => [...prev, newItem].slice(-40)); // Max 40 items active on screen
  }, [blessings]);

  // Remove items that have finished their animation to avoid memory leaks
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
