import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

export function KOBlessingStage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // 清除可能因 StrictMode 导致的残留 canvas
    if (containerRef.current.childNodes.length > 0) {
      containerRef.current.innerHTML = '';
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();

    // 相机的位置可以拉远点，类似抽奖球那样设置
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 5000);
    camera.position.set(0, 0, 1000); // 拉远到 1000 让模型肯定能被看到

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(ambientLight);
    
    // 增加一点更强的主光，防止模型太黑看不见
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(100, 200, 500);
    scene.add(dirLight);

    let mixer: THREE.AnimationMixer | null = null;
    let wrapperModel: THREE.Group | null = null;

    const loader = new GLTFLoader();
    loader.load('./whale.gltf', (gltf) => {
      const whaleModel = gltf.scene;
      console.log('模型加载完成:', whaleModel);
      
      // 自动计算大小并居中
      const box = new THREE.Box3().setFromObject(whaleModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      // 将模型缩放到合适的尺寸 (比如占满屏幕的一部分，这里设目标大小为 800)
      const targetSize = 800; 
      const scale = targetSize / maxDim;
      whaleModel.scale.setScalar(scale);

      // 将模型中心对齐到原点
      whaleModel.position.x = -center.x * scale;
      whaleModel.position.y = -center.y * scale;
      whaleModel.position.z = -center.z * scale;
      
      // 用一个 Group 包裹，以便我们在 Group 上做位移和动画
      const wrapper = new THREE.Group();
      wrapper.add(whaleModel);
      wrapperModel = wrapper;

      // 修正朝向：识别叫 jon1 的骨骼/网格，并将其对齐到游动方向 (-Z轴)
      wrapper.updateMatrixWorld(true);
      const headPos = new THREE.Vector3();
      let hasHead = false;
      whaleModel.traverse((child) => {
        if (child.name.toLowerCase().includes('jon1') && !hasHead) {
          child.getWorldPosition(headPos);
          hasHead = true;
        }
      });

      if (hasHead) {
        // 计算鱼头相对于模型中心（已经移至 wrapper 原点）的水平方向向量
        const dir = headPos.clone().setY(0).normalize();
        // wrapper.lookAt(0,0,0) 会将局部 -Z 轴指向朝前的移动方向
        const angle = Math.atan2(dir.x, dir.z);
        // 修正：去掉 + Math.PI 确保鱼头确实朝前（如果头尾反了的话）
        whaleModel.rotation.y = -angle;
        console.log('检测到 jon1 鱼头，已自动修正在前进方向:', dir);
      }

      // 动画处理，找到闲置动画 'ani_bipedPreV01_dance001'
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(whaleModel);
        let targetClip = gltf.animations.find(a => a.name === 'ani_bipedPreV01_dance001') || gltf.animations[0];
        if (targetClip) {
          const action = mixer.clipAction(targetClip);
          action.play();
        }
      }

      // 从屏幕随机方向出现 (从屏幕外)
      // 计算屏幕的可见范围 (在 z = 0 平面)
      const fov = camera.fov * (Math.PI / 180);
      const visibleHeight = 2 * Math.tan(fov / 2) * camera.position.z;
      const visibleWidth = visibleHeight * camera.aspect;

      // 让它从屏幕外极大范围进入，确保游出再出现的过程平滑不突兀
      const startRadius = Math.max(visibleWidth, visibleHeight) * 0.5 + 1500; 
      
      scene.add(wrapper);

      // 定义无限游动逻辑
      const swim = () => {
        // 随机生成起点（屏幕包围圈外远端）
        const randomStartAngle = Math.random() * Math.PI * 2;
        const startX = Math.cos(randomStartAngle) * startRadius;
        const startY = Math.sin(randomStartAngle) * startRadius;
        // z值增加一点随机景深，防止每次看起来大小一模一样，但不能太靠前或靠后导致剪裁
        const startZ = -500 + (Math.random() - 0.5) * 500;

        // 终点是对向偏移一个随机角度（也就是穿过屏幕到达另一端）
        const endAngle = randomStartAngle + Math.PI + (Math.random() - 0.5) * (Math.PI / 2);
        const endX = Math.cos(endAngle) * startRadius;
        const endY = Math.sin(endAngle) * startRadius;
        const endZ = startZ + (Math.random() - 0.5) * 200;

        // 放置到起点并面向终点
        wrapper.position.set(startX, startY, startZ);
        const targetPos = new THREE.Vector3(endX, endY, endZ);
        wrapper.lookAt(targetPos);

        // 计算持续时间（匀速：距离/速度）
        const distance = wrapper.position.distanceTo(targetPos);
        const speed = 300; // 每秒游动的单位
        const duration = distance / speed;

        // 游向终点
        gsap.to(wrapper.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: duration,
          delay: Math.random() * 2 + 1, // 重新入场前等待 1-3 秒
          ease: 'power1.inOut', // 进出都有缓慢的加速减速，视觉上更平滑和自然
          onComplete: () => {
            // 游出屏幕外彻底隐藏后重置并开始新的游动
            swim();
          }
        });
      };

      // 启动自动循游
      swim();
    });

    const clock = new THREE.Clock();
    let reqId: number;

    function animate() {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      
      if (mixer) mixer.update(delta);
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      if (wrapperModel) {
        gsap.killTweensOf(wrapperModel.position);
      }
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          zIndex: 1 
        }} 
      />
      
      <div style={{ 
        position: 'absolute', 
        top: '15%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)', 
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <h1 style={{ 
          fontSize: '4rem', 
          color: '#fff', 
          textShadow: '0 4px 20px rgba(0,0,0,0.5)' 
        }}>
          KO 祝福墙
        </h1>
      </div>
    </div>
  );
}
