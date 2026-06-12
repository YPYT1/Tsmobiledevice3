# tsmobiledevice

[English](./README.md) | **中文**

第四代 TypeScript iOS 设备通信库 —— [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) 的完整 Node.js 重写版，内置多设备连接池、热插拔事件和完整 CLI 工具。

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

## 为什么选择 tsmobiledevice？

> **完整对比文档 →** [docs/comparison-with-pymobiledevice3.md](./docs/comparison-with-pymobiledevice3.md)

| | pymobiledevice3 | tsmobiledevice |
|---|---|---|
| 运行时 | Python 3 | Node.js ≥ 18 |
| 类型安全 | ❌ | ✅ 完整 TypeScript |
| 多设备连接池 | ❌ | ✅ `DevicePool` |
| 热插拔事件 | ❌ | ✅ `device:connected / disconnected` |
| 并行广播 | ❌ | ✅ `pool.broadcast()` |
| npm 包 | ❌ | ✅ `@tsmobiledevice/core` |
| 协议覆盖 | 5 层 | 5 层 ✅ |

**性能基准**（iPhone 14 Pro / iOS 16.7 / USB / Windows 11）：

| 操作 | pymobiledevice3 | tsmobiledevice |
|------|-----------------|----------------|
| Lockdown 连接 | 95 ms | **81 ms**（快 15%）|
| AFC listdir `/` | 6 ms | **5 ms**（快 17%）|
| 截图 | 1967 ms | 2065 ms（USB 瓶颈，基本持平）|
| 2 台设备并行截图 | ~4100 ms | **~2100 ms**（pool.broadcast）|

## 协议覆盖

| 层级 | 协议 | 状态 |
|------|------|------|
| 1 | usbmux — 设备发现与 TCP 端口转发 | ✅ |
| 2 | lockdown — 配对、TLS 会话、服务代理 | ✅ |
| 3 | 30+ 服务 — AFC、诊断、syslog、截图… | ✅ |
| 4 | DTX — Instruments / DVT 二进制协议 | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ 隧道服务发现 | ✅ |

## CLI 快速上手

```bash
npm install -g @tsmobiledevice/cli

tsmobiledevice usbmux list           # 列出已连接设备
tsmobiledevice lockdown info         # 显示设备信息
tsmobiledevice afc ls /              # 浏览设备文件系统
tsmobiledevice apps list             # 列出已安装应用
tsmobiledevice syslog live           # 实时系统日志
tsmobiledevice developer screenshot  # 截图
tsmobiledevice pool devices          # 所有设备 + 连接类型
tsmobiledevice pool watch            # 热插拔事件监听
tsmobiledevice pool screenshot       # 并行截图所有设备
```

## 库使用示例

```bash
npm install @tsmobiledevice/core
```

```typescript
import { DevicePool } from '@tsmobiledevice/core';

const pool = await DevicePool.connect();

pool.on('device:connected', (device) => {
  console.log('新设备:', device.udid);
});

// 一次性截图所有连接设备
const results = await pool.broadcast(async (device) => {
  return await device.screenshot();
});

pool.close();
```

## CLI 命令

```
usbmux:
  tsmobiledevice usbmux list            列出连接设备
  tsmobiledevice usbmux listen          实时监听插拔事件

lockdown:
  tsmobiledevice lockdown info          设备信息
  tsmobiledevice lockdown pair          配对状态

afc:
  tsmobiledevice afc ls <路径>          列出目录
  tsmobiledevice afc pull <远端> <本地> 下载文件/目录
  tsmobiledevice afc push <本地> <远端> 上传文件/目录
  tsmobiledevice afc shell              交互式 AFC Shell

apps:
  tsmobiledevice apps list              列出用户应用
  tsmobiledevice apps install <ipa>     安装 IPA
  tsmobiledevice apps uninstall <id>    卸载应用

syslog:
  tsmobiledevice syslog live            实时日志流（--match <正则>）

developer:  （需要 DDI，自动挂载）
  tsmobiledevice developer screenshot   截图（--all 全部设备并行）
  tsmobiledevice developer processes    进程列表（--all）
  tsmobiledevice developer perf         CPU/内存实时监控

pool:  （第4代多设备 API）
  tsmobiledevice pool devices           列出所有设备
  tsmobiledevice pool screenshot        并行截图所有设备
  tsmobiledevice pool watch             热插拔事件监听

webinspector:
  tsmobiledevice webinspector list      列出 Safari 页面
  tsmobiledevice webinspector open      在 Safari 打开 URL
```

## 环境要求

- Node.js ≥ 18
- **Windows**：已安装 iTunes（提供 `127.0.0.1:27015` 上的 AMDS）
- **macOS / Linux**：usbmuxd 正在运行
- iOS 设备通过 USB 连接（已信任）

## 从源码构建

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd Tsmobiledevice3
pnpm install
pnpm run build
```

## 项目结构

```
packages/
├── core/   @tsmobiledevice/core — 协议库（npm 包）
└── cli/    @tsmobiledevice/cli  — CLI 工具（tsmobiledevice 命令）
```

## 致谢

协议研究与原始实现：[pymobiledevice3](https://github.com/doronz88/pymobiledevice3)，作者 [@doronz88](https://github.com/doronz88)。

## 许可证

GPL-3.0-or-later
