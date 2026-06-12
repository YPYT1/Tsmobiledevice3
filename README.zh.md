# ts-mobiledevice

[English](./README.md) | **中文**

基于 [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) 的完整 TypeScript 移植版本 —— 一个面向 Node.js 的全栈 iOS 设备通信库，覆盖从底层 USB 多路复用到 iOS 17+ RemoteXPC 服务发现的五个协议层。

## 为什么选择 ts-mobiledevice？

pymobiledevice3 是业内最完整的 iOS 设备通信库，但它依赖 Python 运行时，无法原生集成到 Node.js / TypeScript 工具链中。ts-mobiledevice 在保留完整协议支持的同时，针对 JavaScript 生态做出了以下具体改进：

| 方面 | 相比 pymobiledevice3 的改进 |
|------|---------------------------|
| **运行时** | 纯 Node.js — 无需 Python、无子进程桥接、无 IPC 开销 |
| **类型安全** | 所有协议消息、服务响应、错误路径均有完整 TypeScript 类型定义 |
| **缓冲区效率** | DTX 引擎使用块列表累加器与零拷贝 `Buffer.subarray` 切片，不在帧边界未到达时提前合并 |
| **连接探测** | usbmux 探测结果按地址缓存（`probeCache`）——协议检测在进程生命周期内只运行一次 |
| **端口编码** | 显式字节交换（`writeUInt16BE` / `readUInt16LE`）处理 usbmux 的混合字节序端口编码，正确性由构造保证 |
| **TLS 升级** | 通过 `tls.connect({ socket })` 原地提升套接字——无需重新建立 TCP 连接 |
| **RemoteXPC** | 消息 ID 使用原生 `bigint` 存储——不存在 JS `Number` 大整数精度丢失问题；H2 接收窗口预设为 16 MiB，避免增量往返 |
| **错误处理** | lockdown 错误字符串通过类型化分发表映射——穷举覆盖，无 switch 链 |
| **跨平台** | 自动选择 usbmux 地址：Windows 使用 iTunes AMDS（`127.0.0.1:27015`），Linux/macOS 使用 Unix Socket；支持环境变量覆盖 |

## 协议覆盖

| 层 | 协议 | 状态 |
|----|------|------|
| 1 | usbmux — 设备发现与 TCP 端口转发 | ✅ |
| 2 | lockdown — 设备配对、TLS 会话、服务代理 | ✅ |
| 3 | 30+ lockdown 服务 — AFC、诊断、syslog、截图… | ✅ |
| 4 | DTX 二进制协议 — Instruments / DVT 服务 | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ 隧道服务发现 | ✅ |

## 环境要求

- Node.js ≥ 18
- pnpm ≥ 8
- **Windows**：已安装 iTunes（提供端口 27015 上的 AMDS）
- **macOS / Linux**：usbmuxd 正在运行
- iOS 设备通过 USB 连接

## 安装

```bash
pnpm install
```

## 快速开始

```typescript
import { LockdownService, ServiceFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
console.log(lockdown.udid, lockdown.productVersion);

const factory = new ServiceFactory(lockdown);

// 文件系统访问
const afc = await factory.afc();
const entries = await afc.listdir('/');
await afc.close();

// 设备诊断
const diag = await factory.diagnostics();
const battery = await diag.getBattery();
await diag.close();

await lockdown.close();
```

### DTX / Instruments（需要 DeveloperDiskImage 或 iOS 17+）

```typescript
import { LockdownService, DvtFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
const dvt = await DvtFactory.create(lockdown);

const info = await dvt.deviceInfo();
const procs = await info.proclist();
console.log(`当前运行 ${procs.length} 个进程`);
await info.close();

dvt.close();
await lockdown.close();
```

### RemoteXPC / RSD（iOS 17+）

```typescript
import { RemoteServiceDiscovery } from '@ts-mobiledevice/core';

// 需先建立 USB 隧道：pymobiledevice3 remote start-tunnel
const rsd = new RemoteServiceDiscovery('::1');
await rsd.connect();
console.log(Object.keys(rsd.peerInfo?.Services ?? {}));
rsd.close();
```

## 可用服务

**Lockdown 服务**（通过 `ServiceFactory`）

| 方法 | 说明 |
|------|------|
| `factory.afc()` | 文件系统访问（AFC 协议） |
| `factory.syslog()` | 实时系统日志流 |
| `factory.screenshot()` | 屏幕截图（PNG） |
| `factory.installationProxy()` | 应用安装 / 卸载 / 列举 |
| `factory.springBoard()` | SpringBoard 图标状态 |
| `factory.diagnostics()` | 电池信息、休眠、重启、关机 |
| `factory.simulateLocation()` | GPS 位置模拟 |
| `factory.notificationProxy()` | 推送通知中继 |
| `factory.mobileBackup2()` | iTunes 兼容设备备份 |
| `factory.webInspector()` | WebKit 远程调试协议 |
| `factory.houseArrest(bundleId)` | 应用沙盒文件访问 |
| `factory.crashReports()` | 崩溃日志获取 |
| `factory.osTrace()` | OS Trace 日志流 |
| `factory.pcapd()` | 实时网络抓包 |
| `factory.imageMounter()` | DeveloperDiskImage 挂载 / 卸载 |
| `factory.mobileConfig()` | MDM 配置文件安装 / 移除 / 列举 |

**DTX / DVT 服务**（通过 `DvtFactory`）

| 方法 | 说明 |
|------|------|
| `dvt.deviceInfo()` | 系统信息、硬件详情、进程列表 |
| `dvt.processControl()` | 启动、终止、发送信号给进程 |
| `dvt.applicationListing()` | 枚举已安装应用 |
| `dvt.sysmontap()` | 实时 CPU 与内存监控 |
| `dvt.screenshot()` | 基于 DVT 的屏幕截图 |

## 项目结构

```
packages/core/src/
├── usbmux/      第 1 层 — usbmux 协议、设备枚举、端口转发
├── lockdown/    第 2 层 — 配对、TLS 升级、服务代理
├── services/    第 3 层 — 所有 lockdown 代理服务
│   └── dvt/               DTX 支持的 DVT 服务
├── dtx/         第 4 层 — DTX 二进制帧、信道多路复用、aux 编解码
└── remote/      第 5 层 — HTTP/2 传输、XPC 序列化、RSD
```

## 测试

所有测试均需要通过 USB 连接真实 iOS 设备。第 4 层测试还需要挂载 DeveloperDiskImage（或 iOS 17+ 自动挂载）。第 5 层测试需要运行中的 USB 隧道。

```bash
pnpm test
```

## 构建

```bash
pnpm run build
```

## 致谢

协议研究与原始实现：[pymobiledevice3](https://github.com/doronz88/pymobiledevice3)，作者 [@doronz88](https://github.com/doronz88)。

## 许可证

GPL-3.0-or-later
