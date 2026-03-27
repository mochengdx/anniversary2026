import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import type { UserInfo } from '@pkg/shared-types';

type LotteryState = 'IDLE' | 'COUNTDOWN' | 'SPINNING' | 'PAUSED' | 'STOPPING' | 'RESULT';

interface Props {
  users: UserInfo[];
  blessingsCount: number;
}

const THEME_TEXT = {
  title: '鲸探五周年 · KO大会',
  subTitle: 'Mars Lucky Draw / 星球抽奖',
  status: {
    IDLE: '就绪',
    COUNTDOWN: '启动中...',
    SPINNING: '抽奖进行中...',
    PAUSED: '已暂停',
    STOPPING: '正在聚焦中奖者...',
    RESULT: '中奖结果',
  },
  modalTag: 'KO荣耀时刻',
  modalTitle: '鲸探五周年幸运得主',
  modalSubTitle: '恭喜上榜',
  modalMessage: '感谢每一位与鲸探同频共振的伙伴',
};

const FALLBACK_AVATAR =
  'https://gw.alipayobjects.com/mdn/rms_47f090/afts/img/A*ti0gQIRkBd0AAAAAAAAAAAAAARQnAQ';

function getDemoUsers(count = 120): UserInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `demo-${i + 1}`,
    nickname: `鲸友${String(i + 1).padStart(3, '0')}`,
    avatar: FALLBACK_AVATAR,
  }));
}

function createCardTexture(user: UserInfo): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const themes = [
    { border: '#FFFFFF', background: '#0C4A6E' },
    { border: '#FFFFFF', background: '#1D4ED8' },
    { border: '#FFFFFF', background: '#7C3AED' },
    { border: '#FFFFFF', background: '#B45309' },
  ];
  const theme = themes[Math.floor(Math.random() * themes.length)];

  ctx.fillStyle = theme.background;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(5, 5, 246, 130, 14);
  else ctx.rect(5, 5, 246, 130);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F5F3FF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(user.nickname.slice(0, 8), 100, 60);

  ctx.fillStyle = '#C4B5FD';
  ctx.font = '16px sans-serif';
  ctx.fillText(`ID: ${user.userId.slice(0, 4)}***`, 100, 90);

  ctx.beginPath();
  ctx.arc(58, 70, 34, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(58, 70, 34, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 24, 36, 68, 68);
    ctx.restore();
    tex.needsUpdate = true;
  };
  img.src = user.avatar || FALLBACK_AVATAR;

  return tex;
}

export function LotteryMarsStage({ users, blessingsCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const cardsRef = useRef<THREE.Mesh[]>([]);
  const animRef = useRef<number | null>(null);

  const [state, setState] = useState<LotteryState>('IDLE');
  const stateRef = useRef<LotteryState>('IDLE');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<UserInfo | null>(null);
  const [autoNextCount, setAutoNextCount] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const sourceUsers = useMemo(() => {
    if (users.length > 0) return users;
    return getDemoUsers();
  }, [users]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        setControlsVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    // Removed fog to allow pure background visibility
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.set(0, 0, 1200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x8b5cf6, 1.5, 3000);
    pointLight.position.set(500, 500, 500);
    scene.add(pointLight);

    const planetGroup = new THREE.Group();
    planetGroup.position.set(0, 0, 0); // Leave some space at the top (shift the whole planet down)
    planetGroupRef.current = planetGroup;

    const coreGeo = new THREE.SphereGeometry(300, 32, 32);
    planetGroup.add(
      new THREE.Mesh(
        coreGeo,
        new THREE.MeshBasicMaterial({ color: 0x1e1b4b, wireframe: true, transparent: true, opacity: 0.16 })
      )
    );
    planetGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(320, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x4f46e5, transparent: true, opacity: 0.06, side: THREE.BackSide })
      )
    );
    scene.add(planetGroup);

    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 1200; i++) {
      starPos.push(
        THREE.MathUtils.randFloatSpread(4000),
        THREE.MathUtils.randFloatSpread(4000),
        THREE.MathUtils.randFloatSpread(4000)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9ca3af, size: 2 })));

    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', onResize);

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      if (planetGroupRef.current) {
        if (stateRef.current === 'SPINNING') {
          planetGroupRef.current.rotation.y -= 0.07;
        } else if (stateRef.current === 'IDLE') {
          planetGroupRef.current.rotation.y -= 0.002;
        }
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!planetGroupRef.current) return;

    cardsRef.current.forEach((card) => {
      planetGroupRef.current?.remove(card);
      const material = card.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
      card.geometry.dispose();
    });
    cardsRef.current = [];

    const radius = 420;
    const count = Math.min(180, sourceUsers.length);

    for (let i = 0; i < count; i++) {
      const user = sourceUsers[i % sourceUsers.length];
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      const texture = createCardTexture(user);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 65),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true })
      );

      mesh.position.set(x, y, z);
      mesh.lookAt(x * 2, y * 2, z * 2);
      mesh.userData = { user };
      cardsRef.current.push(mesh);
      planetGroupRef.current.add(mesh);
    }
  }, [sourceUsers]);

  const resetView = useCallback((onComplete?: () => void) => {
    if (!cameraRef.current || !planetGroupRef.current) {
      onComplete?.();
      return;
    }

    const p1 = gsap.to(cameraRef.current.position, {
      x: 0,
      y: 0,
      z: 1200,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => cameraRef.current?.lookAt(0, 0, 0),
    });

    const p2 = gsap.to(planetGroupRef.current.rotation, {
      x: 0,
      duration: 1.1,
      ease: 'power2.out',
      onComplete: () => onComplete?.(),
    });

    const p3 = gsap.to(planetGroupRef.current.position, {
      y: 0,
      duration: 1.1,
      ease: 'power2.out',
    });

    return () => {
      p1.kill();
      p2.kill();
      p3.kill();
    };
  }, []);

  const stopLottery = useCallback(() => {
    if (!planetGroupRef.current || !cameraRef.current || cardsRef.current.length === 0) return;

    setState('STOPPING');
    stateRef.current = 'STOPPING'; // Immediate update for animation loop to stop manipulating rotation
    const winnerCard = cardsRef.current[Math.floor(Math.random() * cardsRef.current.length)];
    const picked = winnerCard.userData.user as UserInfo;
    setWinner(picked);

    const targetPos = winnerCard.position.clone();
    const angleY = Math.atan2(targetPos.x, targetPos.z);
    let targetY = -angleY;
    const currentY = planetGroupRef.current.rotation.y;
    const TWO_PI = Math.PI * 2;
    while (targetY - currentY > Math.PI) targetY -= TWO_PI;
    while (targetY - currentY < -Math.PI) targetY += TWO_PI;
    
    // Add extra spins to make roulette slow-down effect (simulate momentum)
    targetY -= TWO_PI * 2;

    const xzLen = Math.sqrt(targetPos.x * targetPos.x + targetPos.z * targetPos.z);
    const targetX = Math.atan2(targetPos.y, xzLen);

    gsap.to(planetGroupRef.current.rotation, {
      y: targetY,
      x: targetX,
      duration: 3.5, // slightly longer for the extra spins
      ease: 'power3.out',
    });

    gsap.to(planetGroupRef.current.position, {
      y: 0, // 聚焦时将整个球体回正到屏幕居中
      duration: 3.5,
      ease: 'power3.out',
    });

    gsap.to(cameraRef.current.position, {
      x: 0,
      y: 0,
      z: 550, // Card is at radius 620, so 800 places camera in front of the card!
      duration: 3.5,
      ease: 'power3.out',
      onUpdate: () => cameraRef.current?.lookAt(0, 0, 0),
      onComplete: () => {
        const flashGeo = new THREE.PlaneGeometry(210, 120);
        const flashMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.z = 2;
        winnerCard.add(flash);

        gsap.to(flashMat, {
          opacity: 0,
          duration: 0.5,
          onComplete: () => {
            winnerCard.remove(flash);
          },
        });

        setState('RESULT');
      },
    });
  }, []);

  const handleStart = useCallback((withCountdown = true) => {
    if (state === 'SPINNING' || state === 'COUNTDOWN') return;
    setWinner(null);

    if (withCountdown) {
      setState('COUNTDOWN');
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          setCountdown(null);
          setState('SPINNING');
        }
      }, 1000);
      return;
    }

    setState('SPINNING');
  }, [state]);

  const handlePause = useCallback(() => {
    if (state === 'SPINNING') setState('PAUSED');
    else if (state === 'PAUSED') setState('SPINNING');
  }, [state]);

  const handleCloseResult = useCallback((startNext: boolean) => {
    setAutoNextCount(null);
    setState('IDLE');
    resetView(() => {
      if (startNext) {
        setTimeout(() => handleStart(false), 200);
      }
    });
  }, [handleStart, resetView]);

  useEffect(() => {
    if (state !== 'RESULT') return;

    let count = 5;
    setAutoNextCount(count);
    const timer = setInterval(() => {
      count -= 1;
      setAutoNextCount(count);
      if (count <= 0) {
        clearInterval(timer);
        handleCloseResult(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [state, handleCloseResult]);

  return (
    <div className="lottery-mars-root">
      <div ref={containerRef} className="three-canvas" />

      <div className="lottery-top-info">
        <div className="lottery-top-title">{THEME_TEXT.title}</div>
        <div className="lottery-top-subtitle">{THEME_TEXT.subTitle}</div>
        <div className="lottery-top-meta">
          <span>状态：{THEME_TEXT.status[state]}</span>
          <span>抽奖池：{sourceUsers.length}</span>
          <span>祝福：{blessingsCount}</span>
        </div>
      </div>

      {state === 'COUNTDOWN' && countdown !== null && (
        <div className="lottery-countdown">{countdown}</div>
      )}

      {controlsVisible && (
        <div className="lottery-control-bar">
          <button onClick={() => handleStart(true)} disabled={state === 'SPINNING' || state === 'COUNTDOWN'}>
            开始
          </button>
          <button onClick={handlePause} disabled={state !== 'SPINNING' && state !== 'PAUSED'}>
            {state === 'PAUSED' ? '继续' : '暂停'}
          </button>
          <button onClick={stopLottery} disabled={state !== 'SPINNING' && state !== 'PAUSED'}>
            停止并聚焦
          </button>
          <button onClick={() => { setState('IDLE'); resetView(); }}>
            重置视角
          </button>
        </div>
      )}

      {state === 'RESULT' && winner && (
        <div className="lottery-result-modal">
          <div className="lottery-result-card">
            <div className="lottery-result-tag">{THEME_TEXT.modalTag}</div>
            <h2>{THEME_TEXT.modalTitle}</h2>
            <p className="lottery-result-sub">{THEME_TEXT.modalSubTitle}</p>
            <img src={winner.avatar || FALLBACK_AVATAR} alt="winner" />
            <div className="lottery-result-name">{winner.nickname}</div>
            <p className="lottery-result-msg">{THEME_TEXT.modalMessage}</p>
            <div className="lottery-result-actions">
              <button onClick={() => handleCloseResult(false)}>稍后</button>
              <button onClick={() => handleCloseResult(true)}>下一轮</button>
            </div>
            {autoNextCount !== null && (
              <div className="lottery-result-auto">{autoNextCount}s 后自动开始下一轮</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
