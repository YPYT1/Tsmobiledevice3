# tsmobiledevice

**English** | [中文](./README.zh.md)

4th-generation TypeScript iOS device communication library — a complete rewrite of [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) for Node.js, with a multi-device pool, hot-plug events, and a full CLI tool.

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

## Why tsmobiledevice?

> **Full comparison →** [docs/comparison-with-pymobiledevice3.md](./docs/comparison-with-pymobiledevice3.md)

| | pymobiledevice3 | tsmobiledevice |
|---|---|---|
| Runtime | Python 3 | Node.js ≥ 18 |
| Type safety | ❌ | ✅ Full TypeScript |
| Multi-device pool | ❌ | ✅ `DevicePool` |
| Hot-plug events | ❌ | ✅ `device:connected / disconnected` |
| Parallel broadcast | ❌ | ✅ `pool.broadcast()` |
| npm package | ❌ | ✅ `@tsmobiledevice/core` |
| Protocol coverage | 5 layers | 5 layers ✅ |

**Benchmark highlights** (iPhone 14 Pro / iOS 16.7 / USB / Windows 11):

| Operation | pymobiledevice3 | tsmobiledevice |
|-----------|-----------------|----------------|
| Lockdown connect | 95 ms | **81 ms** (+15%) |
| AFC listdir `/` | 6 ms | **5 ms** (+17%) |
| Screenshot | 1967 ms | 2065 ms (≈equal) |
| 2-device parallel screenshot | ~4100 ms | **~2100 ms** (pool.broadcast) |

## Protocol Coverage

| Layer | Protocol | Status |
|-------|----------|--------|
| 1 | usbmux — device discovery & TCP port forwarding | ✅ |
| 2 | lockdown — pairing, TLS session, service brokering | ✅ |
| 3 | 30+ services — AFC, diagnostics, syslog, screenshots… | ✅ |
| 4 | DTX — Instruments / DVT binary protocol | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ tunnel service discovery | ✅ |

## CLI Quick Start

```bash
npm install -g @tsmobiledevice/cli   # or use npx

tsmobiledevice usbmux list           # list connected devices
tsmobiledevice lockdown info         # show device info
tsmobiledevice afc ls /              # browse device filesystem
tsmobiledevice apps list             # list installed apps
tsmobiledevice syslog live           # stream system log
tsmobiledevice developer screenshot  # take screenshot
tsmobiledevice pool devices          # all devices + connection type
tsmobiledevice pool watch            # hot-plug event monitor
tsmobiledevice pool screenshot       # parallel screenshot all devices
```

## Library Quick Start

```bash
npm install @tsmobiledevice/core
```

```typescript
import { DevicePool } from '@tsmobiledevice/core';

const pool = await DevicePool.connect();

pool.on('device:connected', (device) => {
  console.log('New device:', device.udid);
});

// Screenshot all connected devices at once
const results = await pool.broadcast(async (device) => {
  return await device.screenshot();
});

pool.close();
```

## CLI Commands

```
usbmux:
  tsmobiledevice usbmux list            list connected devices
  tsmobiledevice usbmux listen          stream hot-plug events

lockdown:
  tsmobiledevice lockdown info          device info
  tsmobiledevice lockdown pair          pairing status

afc:
  tsmobiledevice afc ls <path>          list directory
  tsmobiledevice afc pull <r> <l>       download file/directory
  tsmobiledevice afc push <l> <r>       upload file/directory
  tsmobiledevice afc shell              interactive AFC shell

apps:
  tsmobiledevice apps list              list user apps
  tsmobiledevice apps install <ipa>     install IPA
  tsmobiledevice apps uninstall <id>    uninstall app

syslog:
  tsmobiledevice syslog live            stream syslog (--match <regex>)

developer:  (requires DDI — auto-mounted on demand)
  tsmobiledevice developer screenshot   take screenshot (--all for all devices)
  tsmobiledevice developer processes    list running processes (--all)
  tsmobiledevice developer perf         CPU/memory monitor

pool:  (4th-gen multi-device API)
  tsmobiledevice pool devices           list all devices
  tsmobiledevice pool screenshot        parallel screenshot all devices
  tsmobiledevice pool watch             hot-plug event monitor

webinspector:
  tsmobiledevice webinspector list      list Safari pages
  tsmobiledevice webinspector open      open URL in Safari
```

## Requirements

- Node.js ≥ 18
- **Windows**: iTunes installed (provides AMDS on `127.0.0.1:27015`)
- **macOS / Linux**: `usbmuxd` running
- iOS device connected via USB (trusted)

## Build from Source

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd Tsmobiledevice3
pnpm install
pnpm run build
```

## Project Structure

```
packages/
├── core/   @tsmobiledevice/core — protocol library (npm package)
└── cli/    @tsmobiledevice/cli  — CLI tool (tsmobiledevice command)
```

## Credits

Protocol research and original implementation: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) by [@doronz88](https://github.com/doronz88).

## License

GPL-3.0-or-later
