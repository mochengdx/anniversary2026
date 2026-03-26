

# 大屏互动系统：项目架构设计与技术方案说明书

## 1. 项目概述
本项目旨在构建一个跨平台的大屏互动应用程序，主要应用于年会、展会等高频互动场景。系统采用 **C/S (客户端-服务端)** 架构，大屏展示端基于 Electron 运行以获取本地系统权限和高性能渲染，移动交互端基于 H5 提供便捷的扫码接入，服务端负责核心状态同步与高并发消息转发。

**核心模块：**
1.  **3D 能量球抽奖模块：** 收集移动端祝福，实时渲染 3D 粒子聚能与爆炸效果，并滚动展示数据。
2.  **本地相册模块：** 读取本地系统图片文件，实现高性能的平滑轮播。
3.  **互动游戏模块：** 支持多用户低延迟、高频次操作的实时游戏（如摇一摇）。

## 2. 技术栈选型
* **工程化管理：** pnpm workspaces (Monorepo 架构)
* **大屏客户端 (Electron)：** React + TypeScript + Vite + **Three.js** (核心 3D 渲染) + GSAP (复杂补间动画)
* **服务端 (Node.js)：** Express (静态托管与 API) + Socket.io (WebSocket 实时通信)
* **移动端 (H5)：** React (或轻量级 Vanilla JS) + Vite
* **数据校验与协议：** JSON Schema / TypeScript Interfaces (前后端强类型共享)

## 3. 系统架构设计 (Monorepo 结构)
采用 Monorepo 确保前后端共享数据类型和通信协议，降低联调成本。

```text
interactive-event-app/
├── package.json                 # 根目录，配置工作区
├── pnpm-workspace.yaml          
├── packages/                    # 【公共依赖层】
│   ├── shared-types/            # 核心：前后端共享的 TS 接口、Socket 事件枚举
│   └── utils/                   # 核心：跨端复用的算法（如节流、插值计算）
└── apps/                        # 【应用逻辑层】
    ├── server/                  # Node.js 服务端 (状态权威中心)
    ├── h5-client/               # 移动端 H5 交互入口
    └── screen-electron/         # Electron 大屏展示端
        ├── electron-main/       # 主进程 (系统 API、本地文件)
        └── src/                 # 渲染进程 (React UI + Three.js 场景)
```

## 4. 核心模块技术实现方案

### 4.1 抽奖与能量球模块 (3D 视觉核心)
考虑到大屏需要处理成百上千的祝福消息并保持流畅的 60FPS 帧率，常规的 DOM 动画无法满足性能要求。

* **数据流转：** 用户 H5 提交 -> Server 接收并广播 -> Electron 渲染进程接收。
* **渲染方案：**
    * 使用 `THREE.BufferGeometry` 预分配大量粒子的顶点空间。
    * **聚能阶段：** 通过动态更新粒子的 `position` 属性，模拟引力场效果。中心能量球使用发光材质（如 `MeshBasicMaterial` 配合后期处理 Bloom 泛光效果），根据接收消息数量动态调整 `scale` 和颜色映射。
    * **爆炸阶段：** 摒弃 CPU 循环计算，采用 **自定义 ShaderMaterial (着色器材质)**。将爆炸方向向量写入几何体属性，通过传入统一的 `u_time` 变量，在 GPU 的顶点着色器（Vertex Shader）中完成所有粒子的瞬时抛物线与散射计算，确保视觉震撼且不卡顿。
* **结果展示：** 爆炸光影衰减后，前端 UI 层平滑淡入。对于大量文本结果，采用 React 虚拟列表 (Virtual List) 结合 CSS3 动画进行弹幕或瀑布流渲染，防止内存溢出。

### 4.2 本地相册轮播模块
此模块核心在于突破浏览器的沙箱安全限制，安全高效地加载本地庞大的媒体文件。

* **目录授权：** 在 Electron 主进程通过 `dialog.showOpenDialog` 获取用户选择的绝对路径。
* **文件遍历：** 主进程使用 Node.js `fs` 模块递归或单层读取图片文件列表。
* **安全渲染：** 严禁直接使用绝对路径渲染。采用自定义协议方案，在主进程通过 `protocol.registerFileProtocol` 注册如 `local-media://` 协议，将前端请求安全映射到本地物理路径。
* **性能优化：** 相册组件仅在 DOM 树中保留当前帧、上一帧和下一帧（共 3-5 个 DOM 节点），结合对象池理念复用 `<img>` 标签，避免大图轮播导致的内存泄漏。

### 4.3 游戏通信模块 (高频互动)
多人实时互动的难点在于网络波动和状态不一致。

* **权威状态 (Server-Authoritative)：** Node.js 服务端作为唯一真实的状态来源（Source of Truth）。分数的计算、排名的判定均在服务端闭环，防止客户端作弊或状态分叉。
* **防抖与节流 (Throttle)：** H5 端的高频操作（如摇动传感器数据）必须在本地进行时间窗口（如 100ms）内的聚合，再通过 WebSocket 发送，避免打满网络带宽。
* **固定帧率广播与插值平滑：** 服务端以固定频率（Tick Rate，如 20Hz/每秒20次）向大屏端广播全局状态快照。大屏端收到离散的坐标或分数后，不直接突变 UI，而是利用线性插值（Lerp）或动画库（GSAP）在两次状态接收之间进行视觉平滑过渡。

## 5. 数据协议规范 (shared-types 示例)
强类型的通信协议是 Monorepo 协同的基础。

```typescript
// packages/shared-types/src/index.ts
export enum SocketEvents {
  C2S_SEND_BLESSING = 'c2s_send_blessing',
  S2C_BROADCAST_BLESSING = 's2c_broadcast_blessing',
  C2S_GAME_ACTION = 'c2s_game_action',
  S2C_GAME_STATE_TICK = 's2c_game_state_tick'
}

export interface BlessingPayload {
  userId: string;
  avatar: string;
  content: string;
  timestamp: number;
}
```