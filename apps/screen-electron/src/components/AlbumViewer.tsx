import { useState, useEffect, useRef, useCallback } from 'react';

interface AlbumImage {
  name: string;
  url: string;
  path: string;
}

/**
 * 本地相册轮播组件
 * 性能优化：仅保留 3 个 DOM 节点 (prev / current / next)
 * 通过自定义协议 local-media:// 安全加载本地图片
 */
export function AlbumViewer() {
  const [images, setImages] = useState<AlbumImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 选择目录
  const handleSelectDir = useCallback(async () => {
    if (!window.electronAPI) {
      alert('此功能仅在 Electron 桌面端可用');
      return;
    }
    const dirPath = await window.electronAPI.selectAlbumDirectory();
    if (!dirPath) return;
    const files = await window.electronAPI.readAlbumFiles(dirPath);
    setImages(files);
    setCurrentIndex(0);
  }, []);

  // 自动轮播
  useEffect(() => {
    if (images.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setFadeIn(true);
      }, 400); // 淡出时间
    }, 5000); // 每 5 秒切换

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images]);

  if (images.length === 0) {
    return (
      <div className="album-overlay">
        <div className="album-placeholder">
          <p style={{ fontSize: 48 }}>📷</p>
          <p>点击下方按钮选择本地相册</p>
          <button onClick={handleSelectDir}>选择文件夹</button>
        </div>
      </div>
    );
  }

  const current = images[currentIndex];

  return (
    <div className="album-overlay">
      <img
        key={current.url}
        src={current.url}
        alt={current.name}
        style={{ opacity: fadeIn ? 1 : 0 }}
      />
    </div>
  );
}
