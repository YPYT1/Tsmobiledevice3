<div align="center">

# ts-mobiledevice

**专业级 TypeScript iOS 设备通信 SDK**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[English](./README.md) | **中文简体** | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## 简介

为 Node.js 生态系统完整重写 [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)，生产就绪，提供完整的 TypeScript 类型支持。无需 Python 依赖，直接访问所有 iOS 通信协议。

| 特性 | pymobiledevice3 | **ts-mobiledevice** |
|------|----------------|---------------------|
| 运行时 | Python 3 | Node.js ≥ 18 |
| 类型安全 | ❌ | ✅ 完整 TypeScript |
| 多设备连接池 | ❌ | ✅ `DevicePool` |
| 热插拔事件 | ❌ | ✅ EventEmitter |
| 并行广播 | ❌ | ✅ `pool.broadcast()` |
| REST API 服务器 | ❌ | ✅ NestJS |
| Web 管理界面 | ❌ | ✅ React |
| Wi-Fi 设备发现 | ❌ | ✅ Bonjour mDNS |
| 流式取消 | ❌ | ✅ AbortSignal |

---

## 架构

```
┌─────────────────────────────────────────────────────┐
│                   ts-mobiledevice                   │
├───────────────┬──────────────────┬──────────────────┤
│  @core 协议库  │  @server NestJS  │  @web React 界面  │
├───────────────┴──────────────────┴──────────────────┤
│              @cli  tsmobiledevice 命令行             │
├─────────────────────────────────────────────────────┤
│  第5层 │ RemoteXPC / RSD (iOS 17+)                  │
│  第4层 │ DTX / DVT — Instruments 二进制协议           │
│  第3层 │ 30+ 服务（AFC · 诊断 · Syslog · DVT …）     │
│  第2层 │ Lockdown — 配对 · TLS · 服务代理             │
│  第1层 │ usbmux + Bonjour mDNS                       │
└─────────────────────────────────────────────────────┘
                      ↕ USB / Wi-Fi
                   iOS 设备（iPhone/iPad）
```

---

## 快速开始

### 安装

```bash
npm install @tsmobiledevice/core
```

```typescript
import { LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

// 单设备
const lockdown = await LockdownService.create();
const factory = new ServiceFactory(lockdown);

const afc = await factory.afc();
const files = await afc.listdir('/');
console.log(files);
await afc.close();
await lockdown.close();

// 多设备并行截图
const pool = await DevicePool.connect({ enableBonjour: true });
pool.on('device:connected', d => console.log('[+]', d.serial));

const results = await pool.broadcast(async (device) => {
  const lock = await LockdownService.create(device.serial);
  const fac = new ServiceFactory(lock);
  const svc = await fac.screenshot();
  const png = await svc.takeScreenshot();
  await svc.close(); await lock.close();
  return png;
});

await pool.close();
```

### CLI

```bash
npm install -g @tsmobiledevice/cli

tsmobiledevice usbmux list              # 列出连接的设备
tsmobiledevice lockdown info            # 显示设备信息
tsmobiledevice lockdown pair            # 配对设备
tsmobiledevice afc ls /                 # 浏览设备文件系统
tsmobiledevice afc pull <远程> <本地>   # 下载文件
tsmobiledevice afc push <本地> <远程>   # 上传文件
tsmobiledevice apps list                # 列出应用
tsmobiledevice apps install <ipa>       # 安装 IPA
tsmobiledevice syslog live --pid <pid>  # 实时日志（按PID过滤）
tsmobiledevice developer screenshot     # 截图
tsmobiledevice developer perf --pid <p> # 进程性能监控
tsmobiledevice developer energy --pid <p> # 能耗监控
tsmobiledevice developer network        # 网络监控
tsmobiledevice developer graphics       # GPU/FPS 监控
tsmobiledevice location set <lat> <lng> # 设置 GPS 位置
tsmobiledevice location reset           # 重置 GPS
tsmobiledevice crash list               # 崩溃日志列表
tsmobiledevice crash pull <远程> <本地> # 下载崩溃日志
tsmobiledevice springboard icon <id>    # 获取应用图标
tsmobiledevice condition list           # 网络条件列表
tsmobiledevice condition set <id>       # 启用弱网模拟
tsmobiledevice profile list             # 描述文件列表
tsmobiledevice pool devices             # 所有设备状态
tsmobiledevice pool screenshot -o <dir> # 并行截图所有设备
tsmobiledevice pool watch               # 热插拔事件监控
tsmobiledevice webinspector list        # Safari 页面列表
tsmobiledevice diag battery             # 电池信息
```

---

## REST API 服务器

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core

cp packages/server/.env.example packages/server/.env
# 编辑 .env，设置 API_KEY=your-secret（可选）

pnpm dev:server   # http://localhost:3000/api
# 文档：http://localhost:3000/docs
```

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/devices` | GET | 设备列表 |
| `/api/devices/:udid` | GET | 设备详情 |
| `/api/devices/:udid/screenshot` | GET | 截图 PNG |
| `/api/devices/:udid/apps?type=User\|System\|Any` | GET | 应用列表 |
| `/api/devices/:udid/battery` | GET | 电池信息 |
| `/api/devices/:udid/crashes` | GET | 崩溃报告列表 |
| `/api/devices/:udid/location` | POST/DELETE | GPS 模拟 |
| `/api/events` | SSE | 设备连接/断开事件 |
| `/api/health` | GET | 健康检查 |
| `/docs` | GET | Redocly API 文档 |

**WebSocket（socket.io）：**

```js
const socket = io('http://localhost:3000');
socket.emit('subscribe:logs', '<udid>');
socket.on('log:line', line => console.log(line));

socket.emit('subscribe:perf', '<udid>');
socket.on('perf:sample', sample => console.log(sample));
```

---

## Web 管理界面

```bash
pnpm dev   # 同时启动服务器和 Web
# 访问 http://localhost:5173
```

功能：设备列表 · 实时截图 · 应用浏览 · 实时日志流 · CPU/内存折线图 · GPS 设置 · 崩溃报告管理。

---

## 性能基准

> **测试设备：** iPhone 14 Pro · iOS 16.7.16 · USB · Windows 11 Pro

| 操作 | pymobiledevice3 | ts-mobiledevice | 差值 |
|------|-----------------|-----------------|------|
| Lockdown 连接 | 95 ms | **81 ms** | +15% |
| AFC `listdir /` | 6 ms | **5 ms** | +17% |
| 截图 | 1,967 ms | 2,065 ms | ≈ 相当 |
| 2 台设备并行截图 | ~4,100 ms | **~2,100 ms** | **+95%** |

---

## 环境要求

| 平台 | 要求 |
|------|------|
| 全平台 | Node.js ≥ 18 |
| Windows | iTunes（提供 AMDS，`127.0.0.1:27015`） |
| macOS / Linux | `usbmuxd` 已运行 |
| iOS 设备 | USB 可信连接 或 Wi-Fi（Bonjour 发现） |

---

## 从源码构建

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd Tsmobiledevice3
pnpm install
pnpm build:core && pnpm build:server
pnpm test   # 65 个测试，无需真机
```

---

## 贡献指南

1. Fork 本仓库并创建功能分支
2. 在对应的 `__tests__/` 或 `tests/` 目录下编写测试
3. 确保全部测试通过：`pnpm test`
4. 提交 Pull Request

---

## 致谢

协议研究参考：[@doronz88](https://github.com/doronz88) 的 [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)。

## 许可证

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
