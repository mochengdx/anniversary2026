import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import type { UserInfo } from '@pkg/shared-types';

type LotteryState = 'IDLE' | 'COUNTDOWN' | 'SPINNING' | 'PAUSED' | 'STOPPING' | 'RESULT';

export interface LotteryMarsConfig {
  bgmUrl?: string;
  radius?: number;
  displayCount?: number;
  replaceInterval?: number;
  modelUrl?: string;
  usersUrl?: string;
  autoNext?: boolean;
  h5ClientUrl?: string;
}

interface Props {
  users: UserInfo[];
  blessingsCount: number;
  config?: LotteryMarsConfig;
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
    { border: '#FFFFFF', background: '#A855F7' },
    { border: '#FFFFFF', background: '#22D3EE' },
    { border: '#FFFFFF', background: '#22D3EE' },
    { border: '#FFFFFF', background: '#04040F' },
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

export function LotteryMarsStage({ users, blessingsCount, config = {} }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const cardsRef = useRef<THREE.Mesh[]>([]);
  const gltfMaterialsRef = useRef<THREE.Material[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [localConfig, setLocalConfig] = useState<LotteryMarsConfig>(() => {
    let baseConfig = { usersUrl: '/users.json', bgmUrl: './music.mp3', ...config };
    try {
      const stored = localStorage.getItem('mars_lottery_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.bgmUrl) parsed.bgmUrl = './music.mp3';
        return { ...baseConfig, ...parsed };
      }
    } catch (e) {}
    return baseConfig;
  });

  const nextUserIdxRef = useRef<number>(localConfig.displayCount || 180);
  const replaceCardIdxRef = useRef<number>(0);
  const animRef = useRef<number | null>(null);

  const [state, setState] = useState<LotteryState>('IDLE');
  const stateRef = useRef<LotteryState>('IDLE');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<UserInfo | null>(null);
  const [autoNextCount, setAutoNextCount] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fetchedUsers, setFetchedUsers] = useState<UserInfo[]>([]);
  const [drawnUserIds, setDrawnUserIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('mars_lottery_drawn');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [showSettings, setShowSettings] = useState(false);
  const [localIP, setLocalIP] = useState<string>('127.0.0.1');

  useEffect(() => {
    if (window.electronAPI?.getLocalIP) {
      window.electronAPI.getLocalIP().then((ip: string) => {
        setLocalIP(ip);
      }).catch((err: any) => console.error('Failed to get local IP', err));
    }
  }, []);

  useEffect(() => {
    if (localConfig.usersUrl) {
      fetch(localConfig.usersUrl)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setFetchedUsers(data);
          } else if (data && Array.isArray(data.data)) {
            setFetchedUsers(data.data);
          }
        })
        .catch(err => console.error('Failed to fetch remote users:', err));
    } else {
      setFetchedUsers([]);
    }
  }, [localConfig.usersUrl]);

  const sourceUsers = useMemo(() => {
    let pool = [];
    if (fetchedUsers.length > 0) pool = fetchedUsers;
    else if (users.length > 0) pool = users;
    else pool = getDemoUsers();

    // 过滤掉已经中奖的用户
    const filtered = pool.filter(u => !drawnUserIds.includes(u.userId));
    if (filtered.length > 0) return filtered;
    
    // 如果全部中奖了，为了不让球空着，退回全量或空（这里选择全量兜底显示）
    return pool;
  }, [users, fetchedUsers, drawnUserIds]);

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

    const initialRadius = localConfig.radius || 600;
    const cameraZ = initialRadius * (1200 / 600); // 动态视角距离，防止球体过大包住镜头

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, Math.max(5000, initialRadius * 10));
    camera.position.set(0, 0, cameraZ);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Brightened ambient light
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Add directional for more pop
    dirLight.position.set(100, 200, 500);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x8b5cf6, 3.5, 3000); // Brightened point light
    pointLight.position.set(500, 500, 500);
    scene.add(pointLight);

    const planetGroup = new THREE.Group();
    
    let mixer: THREE.AnimationMixer | null = null;
    const clock = new THREE.Clock();

    // Load requested GLTF model into the center
    const loader = new GLTFLoader();
    loader.setRequestHeader({ 'Access-Control-Allow-Origin': '*' });
    loader.setCrossOrigin('anonymous');
    loader.load(
      localConfig.modelUrl || 'https://mdn.alipayobjects.com/chain_myent/uri/file/as/mynftmerchant/202512090720240187.gltf',
      (gltf) => {
        console.log('GLTF loaded successfully:', gltf);
        // Shrink to 1/3 of previous size (450 -> 150)
        gltf.scene.scale.set(150, 150, 150); 
        gltf.scene.position.set(0, -30, 0); 
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            // Update materials to receive lighting, ensure double side just in case
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => {
                  m.needsUpdate = true;
                  m.side = THREE.DoubleSide;
                  gltfMaterialsRef.current.push(m);
                });
              } else {
                mesh.material.needsUpdate = true;
                mesh.material.side = THREE.DoubleSide;
                gltfMaterialsRef.current.push(mesh.material);
              }
            }
          }
        });
        planetGroup.add(gltf.scene);

        // Play animations if available
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          gltf.animations.forEach((clip) => {
            if (mixer) mixer.clipAction(clip).play();
          });
        }
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('An error happened loading the GLTF model:', error);
      }
    );
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
      
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      if (mixer) {
        mixer.update(delta);
      }

      // 更新中奖卡片的高光动画效果
      cardsRef.current.forEach((card) => {
        if (card.userData.highlightMat) {
          card.userData.highlightMat.uniforms.time.value = time;
        }
      });

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

    const radius = localConfig.radius || 600;
    const limit = localConfig.displayCount || 180;
    // 如果实际人数小于卡片数据(limit)，也生成 limit 张卡片，通过 i % length 依次重复
    const count = sourceUsers.length > 0 ? limit : 0;

    // 球体大小(radius)保持不变，纯动态计算卡片的合理缩放比例以避免重叠
    // 假设以在球面上铺 180 张卡片且不重叠的状态为基准：scale = 1.0
    // 当数量增加时，单张卡片所占面积需成比例缩小，因此卡片边长的缩放比例应为(180/count)的平方根
    // 我们将其限制在 0.2 ~ 2.0 之间，防止极端数量时卡片过小或过大看不清
    const dynamicScale = Math.min(Math.max(Math.sqrt(180 / Math.max(1, count)), 0.2), 2.0);

    // Reset pointers for polling replacement
    nextUserIdxRef.current = sourceUsers.length > limit ? limit : 0;
    replaceCardIdxRef.current = 0;

    for (let i = 0; i < count; i++) {
      const user = sourceUsers[i % sourceUsers.length];
      // 使用斐波那契球面算法 (Fibonacci sphere) 原理，让卡片更加均匀分布在球面上
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
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
      mesh.scale.set(dynamicScale, dynamicScale, dynamicScale);
      mesh.userData = { user, baseScale: dynamicScale };
      cardsRef.current.push(mesh);
      planetGroupRef.current.add(mesh);
    }
  }, [sourceUsers, localConfig.radius, localConfig.displayCount]);

  // 实现轮询替换逻辑：每秒替换一个卡片，实现全员轮显
  useEffect(() => {
    const limit = localConfig.displayCount || 180;
    const intervalTime = localConfig.replaceInterval || 1000;
    
    if (sourceUsers.length <= limit || cardsRef.current.length === 0) return;

    const interval = setInterval(() => {
      // 只有在空闲或旋转时才替换卡片，停下或正在对焦时不替换
      if (stateRef.current !== 'IDLE' && stateRef.current !== 'SPINNING') return;

      const replaceMesh = cardsRef.current[replaceCardIdxRef.current];
      const nextUser = sourceUsers[nextUserIdxRef.current];
      
      if (replaceMesh && nextUser) {
        const material = replaceMesh.material as THREE.MeshBasicMaterial;
        if (material.map) material.map.dispose();
        
        material.map = createCardTexture(nextUser);
        material.needsUpdate = true;
        replaceMesh.userData.user = nextUser;

        const baseScale = replaceMesh.userData.baseScale || 1;

        // 让替换时的卡片有明显的缩放动画，增强用户感知
        gsap.fromTo(replaceMesh.scale, 
          { x: 0.1, y: 0.1, z: 0.1 },
          { x: baseScale, y: baseScale, z: baseScale, duration: 0.6, ease: 'back.out(1.5)' }
        );
      }

      // 指针后移并循环
      nextUserIdxRef.current = (nextUserIdxRef.current + 1) % sourceUsers.length;
      replaceCardIdxRef.current = (replaceCardIdxRef.current + 1) % cardsRef.current.length;
    }, intervalTime);

    // 清理定时器
    return () => clearInterval(interval);
  }, [sourceUsers, localConfig.displayCount, localConfig.replaceInterval]);

  const resetView = useCallback((onComplete?: () => void) => {
    if (!cameraRef.current || !planetGroupRef.current) {
      onComplete?.();
      return;
    }

    const p1 = gsap.to(cameraRef.current.position, {
      x: 0,
      y: 0,
      z: (localConfig.radius || 600) * (1200 / 600),
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
      z: (localConfig.radius || 600) * (750 / 600), // 动态调整聚焦距离，防过大的球体遮挡镜头
      duration: 3.5,
      ease: 'power3.out',
      onUpdate: () => cameraRef.current?.lookAt(0, 0, 0),
      onComplete: () => {
        // 原有的闪白光过渡效果
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
            flashGeo.dispose();
            flashMat.dispose();
          },
        });

        // 新增：多元色彩环绕效果
        const highlightGeo = new THREE.PlaneGeometry(150, 95);
        const highlightMat = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
              vec2 center = vUv - 0.5;
              float angle = atan(center.y, center.x);
              // 动态生成霓虹渐变色
              vec3 color = 0.5 + 0.5 * cos(time * 3.0 + angle + vec3(0.0, 2.0, 4.0));
              
              // 边缘往内渐隐，中心留给真正的卡片
              float edgeX = smoothstep(0.5, 0.40, abs(center.x));
              float edgeY = smoothstep(0.5, 0.35, abs(center.y));
              float alpha = edgeX * edgeY;
              
              gl_FragColor = vec4(color, alpha * 2.0);
            }
          `
        });
        const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
        highlightMesh.position.z = -2; // 放到卡片背部
        winnerCard.add(highlightMesh);
        
        // 绑定在 userData 用于动画每一帧更新 time
        winnerCard.userData.highlightMesh = highlightMesh;
        winnerCard.userData.highlightMat = highlightMat;

        // 触发自下而上的烟花效果
        const duration = 4000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 60, spread: 120, ticks: 100, zIndex: 100 };

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }
          const particleCount = 40 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: 0.3, y: 1 }, angle: 60 });
          confetti({ ...defaults, particleCount, origin: { x: 0.7, y: 1 }, angle: 120 });
        }, 250);

        // 延时 1s 让光环展示一小会儿，再弹出中奖窗口
        setTimeout(() => {
          setState('RESULT');
        }, 1000);
      },
    });
  }, []);

  const handleStart = useCallback((withCountdown = true) => {
    if (state === 'SPINNING' || state === 'COUNTDOWN') return;
    setWinner(null);

    // 清空现有的高光效果
    cardsRef.current.forEach((card) => {
      if (card.userData.highlightMesh) {
        card.remove(card.userData.highlightMesh);
        card.userData.highlightMesh.geometry.dispose();
        if (card.userData.highlightMat) card.userData.highlightMat.dispose();
        card.userData.highlightMesh = null;
        card.userData.highlightMat = null;
      }
    });

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

    if (winner && !drawnUserIds.includes(winner.userId)) {
      const newDrawn = [...drawnUserIds, winner.userId];
      setDrawnUserIds(newDrawn);
      localStorage.setItem('mars_lottery_drawn', JSON.stringify(newDrawn));
    }

    resetView(() => {
      if (startNext) {
        setTimeout(() => handleStart(false), 200);
      }
    });
  }, [handleStart, resetView, winner, drawnUserIds]);

  useEffect(() => {
    if (state !== 'RESULT') return;

    let count = 5;
    setAutoNextCount(count);
    const timer = setInterval(() => {
      count -= 1;
      setAutoNextCount(count);
      if (count <= 0) {
        clearInterval(timer);
        handleCloseResult(localConfig.autoNext ?? false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [state, handleCloseResult, localConfig.autoNext]);

  // 中间模型球形网格颜色轮换 (每500ms，和卡片的颜色一致)
  useEffect(() => {
    // 这里使用卡片生成的背景色调
    const cardColors = ['#A855F7', '#22D3EE', '#04040F'];
    let colorIdx = 0;
    
    const interval = setInterval(() => {
      if (gltfMaterialsRef.current.length > 0) {
        const threeColor = new THREE.Color(cardColors[colorIdx]);
        gltfMaterialsRef.current.forEach(mat => {
          if ('color' in mat) {
            (mat as any).color.copy(threeColor);
          }
          if ('emissive' in mat) {
            (mat as any).emissive.copy(threeColor);
          }
        });
        colorIdx = (colorIdx + 1) % cardColors.length;
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="lottery-mars-root">
      {localConfig.bgmUrl && (
        <audio
          ref={audioRef}
          src={localConfig.bgmUrl}
          autoPlay
          loop
        />
      )}
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

      <div className="lottery-bottom-qrcode" style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 60
      }}>
        <QRCodeSVG 
          value={localConfig.h5ClientUrl || `http://${localIP}:5173/?server=http://${localIP}:3000`}
          size={120} 
          bgColor="#ffffff" 
          fgColor="#000000" 
          level="L" 
        />
        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>扫码许愿（内网）</div>
      </div>

      {state === 'COUNTDOWN' && countdown !== null && (
        <div className="lottery-countdown">{countdown}</div>
      )}

      {controlsVisible && (
        <div className="lottery-control-bar">
          <button onClick={() => setShowSettings(true)}>⚙️ 设置</button>
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
              <div className="lottery-result-auto">{autoNextCount}s 后自动{localConfig.autoNext ? '开始下一轮' : '关闭窗口'}</div>
            )}
          </div>
        </div>
      )}
      {showSettings && (
        <div className="lottery-settings-modal">
          <div className="lottery-settings-card">
            <h3>抽奖配置</h3>
            <div className="settings-field">
              <label>背景音乐(URL):</label>
              <input type="text" defaultValue={localConfig.bgmUrl || ''} id="cfg_bgmUrl" />
            </div>
            <div className="settings-field">
              <label>星球半径:</label>
              <input type="number" defaultValue={localConfig.radius || 600} id="cfg_radius" />
            </div>
            <div className="settings-field">
              <label>显示卡片数:</label>
              <input type="number" defaultValue={localConfig.displayCount || 180} id="cfg_displayCount" />
            </div>
            <div className="settings-field">
              <label>替牌间隔(ms):</label>
              <input type="number" defaultValue={localConfig.replaceInterval || 1000} id="cfg_replaceInterval" />
            </div>
            <div className="settings-field">
              <label>模型(URL):</label>
              <input type="text" defaultValue={localConfig.modelUrl || ''} id="cfg_modelUrl" />
            </div>
            <div className="settings-field">
              <label>人员名单(URL):</label>
              <input type="text" defaultValue={localConfig.usersUrl || ''} id="cfg_usersUrl" placeholder="返回 UserInfo[] 结构的JSON" />
            </div>
            <div className="settings-field">
              <label>H5 链接(含server参数):</label>
              <input type="text" defaultValue={localConfig.h5ClientUrl || ''} id="cfg_h5Url" placeholder={`如: http://${localIP}:5173/?server=http://${localIP}:3000`} />
            </div>
            <div className="settings-field">
              <label>自动下一轮:</label>
              <input type="checkbox" defaultChecked={localConfig.autoNext ?? false} id="cfg_autoNext" style={{ flex: 'none', width: '20px', height: '20px' }} />
            </div>
            <div className="settings-actions">
              <button onClick={() => {
                setDrawnUserIds([]);
                localStorage.removeItem('mars_lottery_drawn');
                alert('已清空中奖记录！');
              }} style={{ marginRight: 'auto', background: '#e02424' }}>清空中奖</button>

              <button onClick={() => setShowSettings(false)}>取消</button>
              <button className="primary" onClick={() => {
                const newCfg = {
                  bgmUrl: (document.getElementById('cfg_bgmUrl') as HTMLInputElement).value,
                  radius: Number((document.getElementById('cfg_radius') as HTMLInputElement).value) || 600,
                  displayCount: Number((document.getElementById('cfg_displayCount') as HTMLInputElement).value) || 180,
                  replaceInterval: Number((document.getElementById('cfg_replaceInterval') as HTMLInputElement).value) || 1000,
                  modelUrl: (document.getElementById('cfg_modelUrl') as HTMLInputElement).value,
                  usersUrl: (document.getElementById('cfg_usersUrl') as HTMLInputElement).value,
                  h5ClientUrl: (document.getElementById('cfg_h5Url') as HTMLInputElement).value,
                  autoNext: (document.getElementById('cfg_autoNext') as HTMLInputElement).checked,
                };
                setLocalConfig(newCfg);
                localStorage.setItem('mars_lottery_config', JSON.stringify(newCfg));
                setShowSettings(false);
                // 重载页面以使模型或卡片重新初始化生效
                window.location.reload();
              }}>保存并重载</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
