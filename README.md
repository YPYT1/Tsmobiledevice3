<div align="center">

<img src="https://img.shields.io/badge/ts--mobiledevice-iOS%20Device%20SDK-0070f3?style=for-the-badge&logo=typescript&logoColor=white" alt="ts-mobiledevice" />

# ts-mobiledevice

**The professional TypeScript SDK for iOS device communication.**  
A complete, production-ready rewrite of [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) for the Node.js ecosystem.

[![npm version](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![npm downloads](https://img.shields.io/npm/dm/@tsmobiledevice/core?style=flat-square)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## Table of Contents

- [Why ts-mobiledevice?](#why-ts-mobiledevice)
- [Architecture](#architecture)
- [Protocol Coverage](#protocol-coverage)
- [Packages](#packages)
- [Quick Start](#quick-start)
- [REST API Server](#rest-api-server)
- [Web Dashboard](#web-dashboard)
- [CLI Reference](#cli-reference)
- [Benchmarks](#benchmarks)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## Why ts-mobiledevice?

The Node.js ecosystem lacked a **production-grade, fully-typed** library for iOS device automation. `ts-mobiledevice` fills that gap — giving TypeScript developers first-class access to every iOS communication protocol without Python dependencies.

| Feature | pymobiledevice3 | **ts-mobiledevice** |
|---------|----------------|---------------------|
| Runtime | Python 3 | Node.js ≥ 18 |
| Type Safety | ❌ | ✅ Full TypeScript |
| Multi-Device Pool | ❌ | ✅ `DevicePool` |
| Hot-Plug Events | ❌ | ✅ EventEmitter |
| Parallel Broadcast | ❌ | ✅ `pool.broadcast()` |
| REST API | ❌ | ✅ NestJS server |
| Web Dashboard | ❌ | ✅ React UI |
| npm Package | ❌ | ✅ |
| WebSocket Streaming | ❌ | ✅ Syslog / Perf |
| Wi-Fi Discovery | ❌ | ✅ Bonjour mDNS |
| AbortSignal Cancel | ❌ | ✅ All streams |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ts-mobiledevice                          │
├──────────────┬────────────────────────┬────────────────────────┤
│  @core       │  @server               │  @web                  │
│  Protocol    │  NestJS REST+WS        │  React Dashboard       │
│  Library     │  /api/* endpoints      │  localhost:5173        │
│              │  /docs (Redocly)        │                        │
├──────────────┴────────────────────────┴────────────────────────┤
│                        @cli  (tsmobiledevice)                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5 │ RemoteXPC / RSD (iOS 17+)                           │
│  Layer 4 │ DTX — Instruments / DVT binary protocol             │
│  Layer 3 │ 30+ Services (AFC · Diagnostics · Syslog · DVT …)  │
│  Layer 2 │ Lockdown — pairing · TLS · service brokering        │
│  Layer 1 │ usbmux — device discovery · TCP port forwarding     │
│          │ Bonjour mDNS — Wi-Fi device discovery               │
└─────────────────────────────────────────────────────────────────┘
                              ↕ USB / Wi-Fi
                         iOS Device (iPhone/iPad)
```

---

## Protocol Coverage

| Layer | Protocol | Coverage |
|-------|----------|----------|
| 1 | **usbmux** — device discovery & TCP port forwarding | ✅ Full |
| 1+ | **Bonjour mDNS** — Wi-Fi device discovery (`_apple-mobdev2._tcp`) | ✅ Full |
| 2 | **lockdown** — pairing, TLS session, service brokering | ✅ Full |
| 3 | **AFC** — Apple File Conduit filesystem access | ✅ Full |
| 3 | **Diagnostics** — battery, IORegistry, restart, shutdown | ✅ Full |
| 3 | **Syslog** — real-time system log stream | ✅ Full |
| 3 | **Screenshot** (screenshotr) | ✅ Full |
| 3 | **Installation Proxy** — app install / uninstall / list | ✅ Full |
| 3 | **Notification Proxy** — post / observe notifications | ✅ Full |
| 3 | **Location Simulation** — GPS mock | ✅ Full |
| 3 | **SpringBoard** — icons, wallpaper, orientation | ✅ Full |
| 3 | **Crash Reports** — list / pull / delete | ✅ Full |
| 3 | **House Arrest** — sandbox filesystem access | ✅ Full |
| 3 | **Mobile Config** — MDM profile management | ✅ Full |
| 3 | **Misagent** — provisioning profiles | ✅ Full |
| 3 | **MobileBackup2** — backup / restore streams | ✅ Full |
| 3 | **WebInspector** — Safari page listing | ✅ Full |
| 3 | **Heartbeat** — keep-alive service | ✅ Full |
| 3 | **OsTrace / Pcapd / FileRelay** — advanced logging | ✅ Full |
| 4 | **DTX / DVT** — Instruments binary protocol | ✅ Full |
| 4 | **Sysmontap** — CPU / memory real-time metrics | ✅ Full |
| 4 | **Energy Monitor** — per-process energy sampling | ✅ Full |
| 4 | **Network Monitor** — real-time network events | ✅ Full |
| 4 | **Graphics Service** — GPU / FPS sampling | ✅ Full |
| 4 | **Process Control** — launch / kill processes | ✅ Full |
| 4 | **Condition Inducer** — network condition simulation | ✅ Full |
| 5 | **RemoteXPC / RSD** — iOS 17+ tunnel discovery | ✅ Full |

---

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@tsmobiledevice/core`](./packages/core) | Protocol library — all 5 layers | [![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square)](https://npmjs.com/package/@tsmobiledevice/core) |
| [`@tsmobiledevice/cli`](./packages/cli) | CLI tool (`tsmobiledevice` command) | [![npm](https://img.shields.io/npm/v/@tsmobiledevice/cli?style=flat-square)](https://npmjs.com/package/@tsmobiledevice/cli) |
| [`@tsmobiledevice/server`](./packages/server) | NestJS REST + WebSocket API server | — |
| [`@tsmobiledevice/web`](./packages/web) | React management dashboard | — |

---

## Quick Start

### Library

```bash
npm install @tsmobiledevice/core
# or
pnpm add @tsmobiledevice/core
```

```typescript
import { LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

// --- Single device ---
const lockdown = await LockdownService.create();
console.log('Device:', lockdown.udid, lockdown.productVersion);

const factory = new ServiceFactory(lockdown);
const afc = await factory.afc();
const files = await afc.listdir('/');
console.log(files);
await afc.close();
await lockdown.close();

// --- Multi-device pool ---
const pool = await DevicePool.connect({ enableBonjour: true });

pool.on('device:connected', d => console.log('[+]', d.serial, d.connectionType));
pool.on('device:disconnected', udid => console.log('[-]', udid));

// Screenshot all devices in parallel
const results = await pool.broadcast(async (device) => {
  const lock = await LockdownService.create(device.serial);
  const fac = new ServiceFactory(lock);
  const svc = await fac.screenshot();
  const png = await svc.takeScreenshot();
  await svc.close();
  await lock.close();
  return png;
});

await pool.close();
```

### CLI

```bash
npm install -g @tsmobiledevice/cli

tsmobiledevice --help
```

---

## REST API Server

```bash
# Clone & install
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd Tsmobiledevice3
pnpm install && pnpm build:core

# Configure (optional)
cp packages/server/.env.example packages/server/.env
# Set API_KEY=your-secret-key

# Start
pnpm dev:server           # development (ts-node)
pnpm start:server         # production (node dist/)
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/devices` | GET | List connected devices |
| `/api/devices/:udid` | GET | Device info (allValues) |
| `/api/devices/:udid/screenshot` | GET | Screenshot PNG |
| `/api/devices/:udid/apps` | GET | App list (`?type=User\|System\|Any`) |
| `/api/devices/:udid/battery` | GET | Battery details |
| `/api/devices/:udid/crashes` | GET | Crash report list |
| `/api/devices/:udid/location` | POST | Set GPS `{ lat, lng }` |
| `/api/devices/:udid/location` | DELETE | Reset GPS |
| `/api/health` | GET | Health check |
| `/docs` | GET | **Redocly API docs** |
| `/api/openapi.json` | GET | OpenAPI 3.1 spec |

**WebSocket (socket.io):**

```js
const socket = io('http://localhost:3000');

// Subscribe to syslog
socket.emit('subscribe:logs', '<udid>');
socket.on('log:line', line => console.log(line));

// Subscribe to performance metrics
socket.emit('subscribe:perf', '<udid>');
socket.on('perf:sample', sample => console.log(sample));
```

**SSE device events:**

```js
const es = new EventSource('http://localhost:3000/api/events');
es.onmessage = e => console.log(JSON.parse(e.data)); // {type, udid, connectionType}
```

---

## Web Dashboard

```bash
pnpm dev              # start server + web simultaneously
# open http://localhost:5173
```

Features: device list · real-time info · screenshot · app browser · live syslog · CPU/RAM charts · GPS control · crash reports.

---

## CLI Reference

<details>
<summary><strong>usbmux</strong></summary>

```
tsmobiledevice usbmux list              List connected devices
tsmobiledevice usbmux listen            Stream hot-plug events
```
</details>

<details>
<summary><strong>lockdown</strong></summary>

```
tsmobiledevice lockdown info            Device information
tsmobiledevice lockdown pair            Pair device (generates host certificate)
```
</details>

<details>
<summary><strong>afc</strong></summary>

```
tsmobiledevice afc ls <path>            List directory
tsmobiledevice afc pull <remote> <local> Download file or directory
tsmobiledevice afc push <local> <remote> Upload file or directory
tsmobiledevice afc shell                Interactive AFC shell
```
</details>

<details>
<summary><strong>apps</strong></summary>

```
tsmobiledevice apps list [--type User|System|Any]  List applications
tsmobiledevice apps install <ipa>                  Install IPA
tsmobiledevice apps uninstall <bundleId>           Uninstall app
```
</details>

<details>
<summary><strong>developer</strong> (requires DDI on iOS ≤16)</summary>

```
tsmobiledevice developer screenshot [output]   Screenshot (--all for all devices)
tsmobiledevice developer processes             List running processes
tsmobiledevice developer perf [--pid <pid>]    CPU/memory monitor
tsmobiledevice developer energy --pid <pid>    Energy usage monitor
tsmobiledevice developer network               Network events
tsmobiledevice developer graphics              GPU/FPS monitor
```
</details>

<details>
<summary><strong>location · crash · springboard · condition · profile · syslog · pool · webinspector · diag</strong></summary>

```
tsmobiledevice location set <lat> <lng>       Set GPS location
tsmobiledevice location reset                 Reset GPS

tsmobiledevice crash list                     List crash reports
tsmobiledevice crash pull <remote> <local>    Download crash report
tsmobiledevice crash delete <path>            Delete crash report

tsmobiledevice springboard icon <bundleId>    Get app icon PNG
tsmobiledevice springboard wallpaper          Get wallpaper PNG
tsmobiledevice springboard orientation        Get screen orientation

tsmobiledevice condition list                 List network conditions
tsmobiledevice condition set <profileId>      Enable network condition
tsmobiledevice condition clear                Disable condition

tsmobiledevice profile list                   List provisioning profiles
tsmobiledevice profile install <file>         Install .mobileprovision
tsmobiledevice profile remove <uuid>          Remove profile

tsmobiledevice syslog live [--pid <pid>] [--match <regex>]

tsmobiledevice pool devices                   All devices + connection type
tsmobiledevice pool screenshot -o <dir>       Parallel screenshot all devices
tsmobiledevice pool watch                     Hot-plug event monitor

tsmobiledevice webinspector list              List open Safari pages

tsmobiledevice diag battery                   Battery information
tsmobiledevice diag info                      IORegistry dump
```
</details>

---

## Benchmarks

> **Device:** iPhone 14 Pro · iOS 16.7.16 · USB · Windows 11 Pro

| Operation | pymobiledevice3 | ts-mobiledevice | Delta |
|-----------|-----------------|-----------------|-------|
| Lockdown connect | 95 ms | **81 ms** | +15% |
| AFC `listdir /` | 6 ms | **5 ms** | +17% |
| Screenshot | 1,967 ms | 2,065 ms | ≈ equal |
| 2-device parallel screenshot | ~4,100 ms | **~2,100 ms** | **+95%** (pool.broadcast) |

---

## Requirements

| Platform | Requirement |
|----------|-------------|
| All | Node.js ≥ 18 |
| Windows | iTunes installed — provides AMDS on `127.0.0.1:27015` |
| macOS / Linux | `usbmuxd` running |
| iOS device | Trusted USB connection (or Wi-Fi after Bonjour discovery) |

---

## Build from Source

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd Tsmobiledevice3
pnpm install
pnpm build:core
pnpm build:server

# Run tests
pnpm test                  # all unit tests (no device needed)
pnpm test --filter=@tsmobiledevice/core  # with real device
```

---

## Project Structure

```
ts-mobiledevice/
├── packages/
│   ├── core/        @tsmobiledevice/core    — protocol library
│   ├── cli/         @tsmobiledevice/cli     — CLI tool
│   ├── server/      @tsmobiledevice/server  — NestJS API
│   └── web/         @tsmobiledevice/web     — React dashboard
├── docs/
│   └── comparison-with-pymobiledevice3.md
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Docker

```bash
docker compose up                    # API on :3000
# or
docker build -f packages/server/Dockerfile -t tsmobiledevice-server .
docker run -p 3000:3000 -v /var/run/usbmuxd:/var/run/usbmuxd tsmobiledevice-server
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Write tests in the appropriate `__tests__/` or `tests/` directory
4. Ensure all tests pass: `pnpm test`
5. Open a Pull Request

Please follow the existing code style. New services must include unit tests.

---

## Credits

Protocol research and reference implementation: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) by [@doronz88](https://github.com/doronz88) and contributors.

---

## License

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
