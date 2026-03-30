import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

export function KOBlessingStage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
        // wrapper.lookAt(0,0,0) 会将局部 -Z 轴指向朝前的移动方向，因此我们要把鱼头对齐到 -Z 轴
        const angle = Math.atan2(dir.x, dir.z);
        whaleModel.rotation.y = -angle + Math.PI;
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

      // 让它从屏幕边缘外进入
      const startRadius = Math.max(visibleWidth, visibleHeight) * 0.8; 
      const randomAngle = Math.random() * Math.PI * 2;
      const startX = Math.cos(randomAngle) * startRadius;
      const startY = Math.sin(randomAngle) * startRadius;
      
      wrapper.position.set(startX, startY, -500);
      wrapper.lookAt(0, 0, 0);

      scene.add(wrapper);

      // 上场动画
      gsap.to(wrapper.position, {
        x: 0,
        y: 0,
        z: 0,
        duration: 5,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(wrapper.position, {
            y: "+=30",
            duration: 2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut"
          });
        }
      });
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
