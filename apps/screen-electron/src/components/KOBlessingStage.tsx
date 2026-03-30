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

      // 用一个 Group 包裹，以便我们在 Group 上做位移和动画
      const wrapper = new THREE.Group();
      wrapper.add(whaleModel);
      wrapperModel = wrapper;

      // 修正朝向与中心：以骨骼节点 jon1 为控制和移动的基准基点 (pivot)
      wrapper.updateMatrixWorld(true);
      let jon1Node: THREE.Object3D | null = null;
      whaleModel.traverse((child) => {
        if (child.name.toLowerCase().includes('jon1') && !jon1Node) {
          jon1Node = child as THREE.Object3D;
        }
      });

      if (jon1Node) {
        // 先获取原本在世界坐标下鱼头(jon1)相对原本中心的朝向向量
        const headPos = new THREE.Vector3();
        (jon1Node as THREE.Object3D).getWorldPosition(headPos);
        
        // 计算原本鱼头在模型里的水面朝向
        const dir = headPos.clone().setY(0).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        // 如果尾巴在前，说明朝向反了，去掉 + Math.PI 或者修改角度以确保其指向正确的方向。
        // Math.atan2给出的角度是相对于Z轴的，调整为直接对准
        whaleModel.rotation.y = -angle;

        // 重新更新因为旋转产生的新世界矩阵
        wrapper.updateMatrixWorld(true);
        (jon1Node as THREE.Object3D).getWorldPosition(headPos);

        // 将模型平移，使得骨架节点 jon1 这个鱼头成为确切的几何原点(0,0,0)
        // 这样一来，我们每次移动和施加 LookAt 到 wrapper 时，就是在直接“控制” jon1
        whaleModel.position.x -= headPos.x;
        whaleModel.position.y -= headPos.y;
        whaleModel.position.z -= headPos.z;
        
        console.log('检测到 jon1 鱼头，已将其设为控制基点并修正头尾朝向');
      } else {
        // 如果没找到骨架节点，降级为普通的包围盒居中
        whaleModel.position.x = -center.x * scale;
        whaleModel.position.y = -center.y * scale;
        whaleModel.position.z = -center.z * scale;
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

      // 让它从屏幕外极大范围进入，只需一个稍大于屏幕的半径，防止消失时间过长
      const startRadius = Math.max(visibleWidth, visibleHeight) * 0.5 + 500; 
      
      scene.add(wrapper);

      // 保存每次游出时的终点和角度，下一次从原路附近回去
      let lastTargetPos: THREE.Vector3 | null = null;
      let lastEndAngle: number | null = null;

      // 定义无限游动逻辑
      const swim = () => {
        let startX, startY, startZ;
        let randomStartAngle;

        // 起点逻辑：如果是续接上次，从上次离开的地点开始；否则随机选个边
        if (lastTargetPos && lastEndAngle !== null) {
          startX = lastTargetPos.x;
          startY = lastTargetPos.y;
          startZ = lastTargetPos.z;
          randomStartAngle = lastEndAngle;
        } else {
          randomStartAngle = Math.random() * Math.PI * 2;
          startX = Math.cos(randomStartAngle) * startRadius;
          startY = Math.sin(randomStartAngle) * startRadius;
          startZ = -500 + (Math.random() - 0.5) * 400;
        }

        // 终点是对向偏移一个随机角度（也就是穿过屏幕到达另一端）
        const endAngle = randomStartAngle + Math.PI + (Math.random() - 0.5) * (Math.PI / 2);
        const endX = Math.cos(endAngle) * startRadius;
        const endY = Math.sin(endAngle) * startRadius;
        const endZ = -500 + (Math.random() - 0.5) * 400;

        // 放置到起点并面向终点
        wrapper.position.set(startX, startY, startZ);
        const targetPos = new THREE.Vector3(endX, endY, endZ);
        wrapper.lookAt(targetPos);
        
        // 清除上一轮旋转状态
        wrapper.rotation.z = 0;

        // 计算持续时间（匀速：距离/速度）并加上 0.8 到 1.2 的系数浮动
        const distance = wrapper.position.distanceTo(targetPos);
        const baseSpeed = 350; // 每秒游动的基准单位，从300稍微加快一点减少枯燥
        // 生成 0.8 到 1.2 之间的随机乘数
        const speedMultiplier = 0.8 + Math.random() * 0.4;
        const currentSpeed = baseSpeed * speedMultiplier;
        const duration = distance / currentSpeed;

        // 同步修改动画骨骼速率（加入随机性）
        if (mixer) {
          mixer.timeScale = speedMultiplier;
        }

        // 判定是否“从下向上”（Y轴显著增加，作为飞跃水面的条件）
        const isUpward = (targetPos.y - startY) > visibleHeight * 0.3;
        // 如果是抬头向上的大幅游动，随机给 3 到 5 圈滚动
        const rolls = isUpward ? Math.floor(Math.random() * 3) + 3 : 0;
        
        const delay = Math.random() * 0.5 + 0.2; // 让离场后等待时间极大缩短，不会觉得失踪太久

        // 游向终点
        gsap.to(wrapper.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: duration,
          delay: delay,
          ease: 'power1.inOut', // 进出都有缓慢的加速减速，视觉上更平滑和自然
          onUpdate: () => {
             // 赋予骨骼速度波动感：随时间按正弦轻微脉动
             if (mixer) {
               mixer.timeScale = speedMultiplier + Math.sin(Date.now() / 200) * 0.3;
             }
          },
          onComplete: () => {
            // 保存状态，下次从这里游回去
            lastTargetPos = targetPos.clone();
            lastEndAngle = endAngle;
            // 游出屏幕外彻底隐藏后重置并开始新的游动
            swim();
          }
        });

        // 旋转动效
        if (rolls > 0) {
          // 在当前朝向的局部Z轴（前进轴）进行滚动
          gsap.to(wrapper.rotation, {
            z: Math.PI * 2 * rolls,
            duration: duration,
            delay: delay,
            ease: 'power2.inOut',
          });
        }
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
