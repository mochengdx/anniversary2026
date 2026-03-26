import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { EnergyUpdate } from '@pkg/shared-types';
import { lerp, clamp } from '@pkg/utils';

// 自定义爆炸粒子着色器
const explosionVertexShader = `
  attribute vec3 velocity;
  uniform float u_time;
  uniform float u_active;

  varying float vAlpha;

  void main() {
    // 抛物线运动: pos = pos0 + v*t + 0.5*g*t^2
    vec3 pos = position + velocity * u_time * u_active;
    pos.y -= 0.5 * 4.9 * u_time * u_time * u_active;

    vAlpha = max(0.0, 1.0 - u_time * 0.5);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = max(1.0, 4.0 * (300.0 / -mvPosition.z)) * vAlpha;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const explosionFragmentShader = `
  varying float vAlpha;

  void main() {
    // 圆形粒子
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float glow = 1.0 - dist * 2.0;
    gl_FragColor = vec4(1.0, 0.6, 0.2, glow * vAlpha);
  }
`;

interface Props {
  energy: EnergyUpdate;
}

export function EnergyBallScene({ energy }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points;
    explosionParticles: THREE.Points;
    coreMesh: THREE.Mesh;
    animId: number;
    clock: THREE.Clock;
    explosionTime: number;
    isExploding: boolean;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.01);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 60);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ===== 聚能粒子 =====
    const PARTICLE_COUNT = 2000;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 随机分布在球形空间周围
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 20 + Math.random() * 30;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      colors[i * 3] = 0.2 + Math.random() * 0.3; // R
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.5; // G
      colors[i * 3 + 2] = 1.0; // B
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ===== 中心能量球 =====
    const coreGeo = new THREE.SphereGeometry(3, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x3388ff,
      transparent: true,
      opacity: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // 发光层
    const glowGeo = new THREE.SphereGeometry(4, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x6644ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // ===== 爆炸粒子 (GPU Shader) =====
    const EXP_COUNT = 3000;
    const expGeo = new THREE.BufferGeometry();
    const expPos = new Float32Array(EXP_COUNT * 3);
    const expVel = new Float32Array(EXP_COUNT * 3);

    for (let i = 0; i < EXP_COUNT; i++) {
      expPos[i * 3] = 0;
      expPos[i * 3 + 1] = 0;
      expPos[i * 3 + 2] = 0;

      // 随机径向爆炸方向
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 5 + Math.random() * 20;
      expVel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      expVel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      expVel[i * 3 + 2] = speed * Math.cos(phi);
    }

    expGeo.setAttribute('position', new THREE.BufferAttribute(expPos, 3));
    expGeo.setAttribute('velocity', new THREE.BufferAttribute(expVel, 3));

    const expMat = new THREE.ShaderMaterial({
      vertexShader: explosionVertexShader,
      fragmentShader: explosionFragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_active: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const explosionParticles = new THREE.Points(expGeo, expMat);
    scene.add(explosionParticles);

    const clock = new THREE.Clock();

    const state = {
      scene,
      camera,
      renderer,
      particles,
      explosionParticles,
      coreMesh,
      animId: 0,
      clock,
      explosionTime: 0,
      isExploding: false,
    };

    // Animation loop
    const animate = () => {
      state.animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // 聚能粒子向中心吸引
      const posArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const x = posArr[ix], y = posArr[ix + 1], z = posArr[ix + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);

        if (dist > 5) {
          const speed = 0.02 + energy.energyLevel * 0.05;
          posArr[ix] -= (x / dist) * speed;
          posArr[ix + 1] -= (y / dist) * speed;
          posArr[ix + 2] -= (z / dist) * speed;
        } else {
          // 重新生成到外围
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 25 + Math.random() * 25;
          posArr[ix] = r * Math.sin(phi) * Math.cos(theta);
          posArr[ix + 1] = r * Math.sin(phi) * Math.sin(theta);
          posArr[ix + 2] = r * Math.cos(phi);
        }
      }
      pGeo.attributes.position.needsUpdate = true;

      // 能量球脉动
      const scale = 1 + energy.energyLevel * 2 + Math.sin(elapsed * 2) * 0.3;
      coreMesh.scale.setScalar(scale);
      glowMesh.scale.setScalar(scale * 1.3);

      // 颜色映射：低能量蓝 -> 高能量紫/粉
      const r = lerp(0.2, 1.0, energy.energyLevel);
      const g = lerp(0.5, 0.3, energy.energyLevel);
      const b = lerp(1.0, 0.8, energy.energyLevel);
      (coreMat as THREE.MeshBasicMaterial).color.setRGB(r, g, b);

      // 爆炸 shader 更新
      if (state.isExploding) {
        state.explosionTime += clock.getDelta();
        (expMat.uniforms.u_time as { value: number }).value = state.explosionTime;
        (expMat.uniforms.u_active as { value: number }).value = 1;
      }

      // 旋转
      particles.rotation.y += 0.001;

      renderer.render(scene, camera);
    };

    animate();
    sceneRef.current = state;

    // Resize
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(state.animId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 响应 energy phase 变化触发爆炸
  useEffect(() => {
    if (energy.phase === 'exploding' && sceneRef.current) {
      sceneRef.current.isExploding = true;
      sceneRef.current.explosionTime = 0;
    }
  }, [energy.phase]);

  return <div ref={containerRef} className="three-canvas" />;
}
