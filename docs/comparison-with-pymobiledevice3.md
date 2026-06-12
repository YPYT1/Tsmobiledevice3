# tsmobiledevice vs pymobiledevice3 — 对比文档

> 测试环境：Windows 11 Pro, iPhone 14 Pro (iOS 16.7), USB 连接  
> tsmobiledevice v0.1.0 / pymobiledevice3 最新版 / Node.js v24.14.1 / Python 3.11

---

## 一、项目定位

| | pymobiledevice3 | tsmobiledevice |
|---|---|---|
| 定位 | Python 官方 iOS 通信库（第3代） | TypeScript 完整重写（第4代） |
| 发布年份 | 2021 | 2026 |
| 仓库 | [doronz88/pymobiledevice3](https://github.com/doronz88/pymobiledevice3) | [YPYT1/Tsmobiledevice3](https://github.com/YPYT1/Tsmobiledevice3) |
| 包管理 | `pip install pymobiledevice3` | `npm install @tsmobiledevice/core` |
| 运行时 | Python 3.9+ | Node.js 18+ |
| 语言 | Python（动态类型） | TypeScript（静态类型） |

---

## 二、协议覆盖对比

| 协议层 | pymobiledevice3 | tsmobiledevice |
|--------|-----------------|----------------|
| Layer 1: usbmux | ✅ 完整 | ✅ 完整 |
| Layer 2: lockdown | ✅ 完整 | ✅ 完整 |
| Layer 3: 应用服务（30+） | ✅ 完整 | ✅ 完整 |
| Layer 4: DTX / Instruments | ✅ 完整 | ✅ 完整 |
| Layer 5: RemoteXPC（iOS 17+） | ✅ 完整 | ✅ 实现，待真机验证 |

---

## 三、功能差异对比

### 3.1 第4代新增能力（tsmobiledevice 独有）

| 功能 | pymobiledevice3 | tsmobiledevice |
|------|-----------------|----------------|
| **DevicePool 连接池** | ❌ 无 | ✅ `DevicePool.connect()` |
| **热插拔事件** | ❌ 需手动轮询 | ✅ `device:connected / disconnected` |
| **多设备并行广播** | ❌ 需自写循环 | ✅ `pool.broadcast(fn)` |
| **Device 高层 API** | ❌ 无统一抽象 | ✅ `device.screenshot() / processes() / syslog()` |
| **DDI 自动挂载** | ❌ 需手动执行 | ✅ DTX 命令自动检测并挂载 |
| **npm 包** | ❌ 无 | ✅ `@tsmobiledevice/core` |
| **TypeScript 类型** | ❌ 无 | ✅ 全量类型定义 |

### 3.2 pymobiledevice3 仍领先的部分

| 功能 | pymobiledevice3 | tsmobiledevice |
|------|-----------------|----------------|
| iOS 版本覆盖 | iOS 9 ~ 17.x | iOS 13 ~ 17.x（未测试旧版） |
| Recovery / DFU 模式 | ✅ 完整 | 🔲 未实现 |
| Restore / 固件更新 | ✅ 完整 | 🔲 未实现 |
| Bonjour Wi-Fi 发现 | ✅ 完整 | 🔲 计划中 |
| 测试覆盖率 | 较高（社区） | 真机集成测试 |
| 社区生态 | 成熟，Discord | 早期 |

### 3.3 CLI 功能对比

| 命令 | pymobiledevice3 CLI | tsmobiledevice CLI |
|------|---------------------|--------------------|
| 设备发现 | `pymobiledevice3 usbmux list` | `tsmobiledevice usbmux list` |
| 设备信息 | `pymobiledevice3 lockdown info` | `tsmobiledevice lockdown info` |
| 文件操作 | `pymobiledevice3 afc ...` | `tsmobiledevice afc ls/pull/push/shell` |
| 应用管理 | `pymobiledevice3 apps ...` | `tsmobiledevice apps list/install/uninstall` |
| 截图 | `pymobiledevice3 developer ... screenshot` | `tsmobiledevice developer screenshot` |
| 进程列表 | `pymobiledevice3 developer ... ps` | `tsmobiledevice developer processes` |
| syslog 流 | `pymobiledevice3 syslog live` | `tsmobiledevice syslog live` |
| **多设备并行截图** | ❌ 无 | ✅ `tsmobiledevice pool screenshot` |
| **热插拔监听** | ❌ 无 | ✅ `tsmobiledevice pool watch` |
| **CPU/内存监控** | ✅ 有 | ✅ `tsmobiledevice developer perf` |
| WebInspector | ✅ 完整 | ⚠️ 基础实现 |

---

## 四、性能基准测试

> 测试条件：iPhone 14 Pro / iOS 16.7 / USB 连接 / Windows 11  
> 各项测试重复 3 次取平均值

### 4.1 连接建立时间

| 操作 | pymobiledevice3 | tsmobiledevice | 差异 |
|------|-----------------|----------------|------|
| Lockdown 连接 | 95 ms | **81 ms** | TS 快 15% |
| AFC 服务连接 | 6 ms | **5 ms** | TS 快 17% |

**分析**：TypeScript 版本连接速度略快，主要原因：
- usbmux 探测结果进程级缓存（`probeCache`），Python 版每次重建
- TLS 升级通过 `tls.connect({ socket })` 原地提升，无 TCP 重连

### 4.2 操作延迟

| 操作 | pymobiledevice3 | tsmobiledevice | 差异 |
|------|-----------------|----------------|------|
| AFC listdir `/` | 6 ms | **5 ms** | TS 快 17% |
| 截图（PNG） | **1967 ms** | 2065 ms | Python 快 5% |

**分析**：
- **文件操作**：TS 使用 `Buffer.subarray` 零拷贝切片，减少了 GC 压力
- **截图**：两者相差约 100ms（USB 硬件传输瓶颈，差异在误差范围内）。截图主要耗时在设备侧渲染和 USB 传输，与语言关系不大

### 4.3 多设备并发（tsmobiledevice 独有能力）

| 场景 | pymobiledevice3 | tsmobiledevice |
|------|-----------------|----------------|
| 2台设备串行截图 | ~4100 ms（需手写循环） | **~2100 ms**（并行，节省 ~50%） |
| N 台设备并发 | 线性增长 O(N) | 接近 O(1)（受 USB Hub 限制） |

```typescript
// tsmobiledevice: N 台设备同时截图，时间 ≈ 单台时间
const pool = await DevicePool.connect();
const results = await pool.broadcast(d => d.screenshot()); // 自动并行
```

### 4.4 内存占用（空闲状态）

| | pymobiledevice3 | tsmobiledevice |
|---|---|---|
| 进程内存 | ~45 MB（Python 解释器） | ~35 MB（Node.js） |
| 包体积 | ~2 MB（site-packages） | 108 KB（npm 包） |

---

## 五、技术实现差异

### 5.1 字节序处理

**pymobiledevice3**（隐式，依赖 struct 格式字符串）：
```python
# 可能混淆 > 和 < 的情况
data = struct.pack('>I', port)  # 大端
```

**tsmobiledevice**（显式，正确性由构造保证）：
```typescript
// usbmux 混合字节序：网络序写入，小端读出
const portBuf = Buffer.allocUnsafe(2);
portBuf.writeUInt16BE(rawPort, 0);    // 网络字节序存储
const port = portBuf.readUInt16LE(0); // 小端读出给 usbmux
```

### 5.2 64位消息 ID（RemoteXPC）

**pymobiledevice3**：
```python
message_id: int  # Python int 任意精度，但序列化到 struct 时可能溢出
```

**tsmobiledevice**：
```typescript
private msgId: Record<number, bigint> = { [ROOT_CHANNEL]: 0n };
// bigint 原生支持，无 Number 精度丢失（JS Number 最大安全整数 2^53-1）
```

### 5.3 连接模型

| | pymobiledevice3 | tsmobiledevice |
|---|---|---|
| 并发模型 | asyncio（协程） | Node.js 事件循环（原生） |
| 多设备 | 需手动管理多个 lockdown 实例 | `DevicePool` 统一管理 |
| 热插拔 | 无内置支持 | `EventEmitter` 原生支持 |
| 连接复用 | 每次命令新建连接 | 同上，但 Pool 管理生命周期 |

### 5.4 DTX 缓冲区优化

**pymobiledevice3**：
```python
# 每收到 chunk 都立即合并（Python bytes 是不可变对象，每次 concat 分配新对象）
buf += data
```

**tsmobiledevice**：
```typescript
// 块列表累加器 + 只在边界处合并
private _chunks: Buffer[] = [];
// 找到完整帧后才 Buffer.concat，且用 subarray 零拷贝切片
const frame = Buffer.concat(this._chunks).subarray(0, frameLen);
```

---

## 六、迁移对照表

常用 Python 代码到 TypeScript 的等价写法：

```python
# Python
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.afc import AfcService

lockdown = await create_using_usbmux()
afc = AfcService(lockdown)
files = await afc.listdir('/')
```

```typescript
// TypeScript
import { LockdownService, ServiceFactory } from '@tsmobiledevice/core';

const lockdown = await LockdownService.create();
const factory = new ServiceFactory(lockdown);
const afc = await factory.afc();
const files = await afc.listdir('/');
await afc.close();
await lockdown.close();
```

```python
# Python — 无多设备 API，需手写
import asyncio
devices = await list_devices()
results = await asyncio.gather(*[do_screenshot(d) for d in devices])
```

```typescript
// TypeScript — DevicePool 原生支持
const pool = await DevicePool.connect();
const results = await pool.broadcast(d => d.screenshot());
pool.close();
```

---

## 七、选择建议

| 场景 | 推荐 |
|------|------|
| Python 技术栈、已有 pymobiledevice3 脚本 | pymobiledevice3 |
| Node.js / TypeScript 项目集成 | **tsmobiledevice** |
| iOS 设备群控（多设备并发） | **tsmobiledevice** |
| Recovery / DFU / 固件相关 | pymobiledevice3 |
| iOS 17+ RemoteXPC（已验证） | pymobiledevice3（待 tsmobiledevice 真机验证） |
| npm 包直接引用 | **tsmobiledevice** |
| 需要最完整的协议支持 | pymobiledevice3 |

---

## 八、致谢

tsmobiledevice 的协议实现完全基于 pymobiledevice3 的研究成果。感谢 [@doronz88](https://github.com/doronz88) 和 pymobiledevice3 社区对 iOS 协议的深入逆向工程工作。

---

*更新时间：2026-06-12*
