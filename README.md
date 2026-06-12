# ts-mobiledevice

**English** | [中文](./README.zh.md)

A complete TypeScript port of [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) — a full-stack iOS device communication library for Node.js, covering all five protocol layers from raw USB multiplexing to iOS 17+ RemoteXPC service discovery.

## Why ts-mobiledevice?

pymobiledevice3 is the definitive iOS device library, but it requires a Python runtime and does not integrate naturally into Node.js/TypeScript toolchains. ts-mobiledevice brings the same protocol coverage to the JavaScript ecosystem with several concrete improvements:

| Area | Improvement over pymobiledevice3 |
|------|----------------------------------|
| **Runtime** | Pure Node.js — no Python, no subprocess bridging, no IPC overhead |
| **Type safety** | Full TypeScript types for every protocol message, service response, and error path |
| **Buffer efficiency** | DTX engine uses a chunk-list accumulator and zero-copy `Buffer.subarray` slices; no premature concat on partial frames |
| **Connection probing** | usbmux probe result cached per address (`probeCache`) — protocol detection runs once per process lifetime, not per connection |
| **Port encoding** | Explicit byte-swap (`writeUInt16BE` / `readUInt16LE`) for usbmux's mixed-endian port encoding — correct by construction, not by accident |
| **TLS upgrade** | In-place socket promotion via `tls.connect({ socket })` — no TCP reconnect on lockdown session start |
| **RemoteXPC** | 64-bit message IDs stored as native `bigint` — no JS `Number` precision loss on large counters; H2 receive window pre-set to 16 MiB to avoid incremental round-trips |
| **Error handling** | Lockdown error strings mapped through a typed dispatch table — exhaustive, zero switch-chain |
| **Cross-platform** | Automatic usbmux address selection: iTunes AMDS (`127.0.0.1:27015`) on Windows, Unix socket on Linux/macOS; overridable via env |

## Protocol Coverage

| Layer | Protocol | Status |
|-------|----------|--------|
| 1 | usbmux — device discovery & TCP port forwarding | ✅ |
| 2 | lockdown — device pairing, TLS session, service brokering | ✅ |
| 3 | 30+ lockdown services — AFC, diagnostics, syslog, screenshot… | ✅ |
| 4 | DTX binary protocol — Instruments / DVT services | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ tunnel-based service discovery | ✅ |

## Requirements

- Node.js ≥ 18
- pnpm ≥ 8
- **Windows**: iTunes installed (provides AMDS on port 27015)
- **macOS / Linux**: usbmuxd running
- iOS device connected via USB

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { LockdownService, ServiceFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
console.log(lockdown.udid, lockdown.productVersion);

const factory = new ServiceFactory(lockdown);

// File system access
const afc = await factory.afc();
const entries = await afc.listdir('/');
await afc.close();

// Diagnostics
const diag = await factory.diagnostics();
const battery = await diag.getBattery();
await diag.close();

await lockdown.close();
```

### DTX / Instruments (requires DeveloperDiskImage or iOS 17+)

```typescript
import { LockdownService, DvtFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
const dvt = await DvtFactory.create(lockdown);

const info = await dvt.deviceInfo();
const procs = await info.proclist();
console.log(`${procs.length} running processes`);
await info.close();

dvt.close();
await lockdown.close();
```

### RemoteXPC / RSD (iOS 17+)

```typescript
import { RemoteServiceDiscovery } from '@ts-mobiledevice/core';

// Start tunnel first: pymobiledevice3 remote start-tunnel
const rsd = new RemoteServiceDiscovery('::1');
await rsd.connect();
console.log(Object.keys(rsd.peerInfo?.Services ?? {}));
rsd.close();
```

## Available Services

**Lockdown services** (via `ServiceFactory`)

| Method | Description |
|--------|-------------|
| `factory.afc()` | File system access (AFC protocol) |
| `factory.syslog()` | Real-time system log stream |
| `factory.screenshot()` | Screen capture (PNG) |
| `factory.installationProxy()` | App install / uninstall / list |
| `factory.springBoard()` | SpringBoard icon state |
| `factory.diagnostics()` | Battery info, sleep, restart, shutdown |
| `factory.simulateLocation()` | GPS location simulation |
| `factory.notificationProxy()` | Push notification relay |
| `factory.mobileBackup2()` | iTunes-compatible device backup |
| `factory.webInspector()` | WebKit remote debug protocol |
| `factory.houseArrest(bundleId)` | Per-app sandboxed file access |
| `factory.crashReports()` | Crash log retrieval |
| `factory.osTrace()` | OS trace log stream |
| `factory.pcapd()` | Live network packet capture |
| `factory.imageMounter()` | DeveloperDiskImage mount / unmount |
| `factory.mobileConfig()` | MDM profile install / remove / list |

**DTX / DVT services** (via `DvtFactory`)

| Method | Description |
|--------|-------------|
| `dvt.deviceInfo()` | System information, hardware details, process list |
| `dvt.processControl()` | Launch, kill, and signal processes |
| `dvt.applicationListing()` | Enumerate installed applications |
| `dvt.sysmontap()` | Real-time CPU and memory monitoring |
| `dvt.screenshot()` | DVT-based screen capture |

## Project Structure

```
packages/core/src/
├── usbmux/      Layer 1 — usbmux protocol, device enumeration, port forwarding
├── lockdown/    Layer 2 — pairing, TLS upgrade, service brokering
├── services/    Layer 3 — all lockdown-brokered services
│   └── dvt/               DTX-backed DVT services
├── dtx/         Layer 4 — DTX binary framing, channel multiplexing, aux codec
└── remote/      Layer 5 — HTTP/2 transport, XPC serialization, RSD
```

## Testing

All tests require a real iOS device connected via USB. Layer 4 tests additionally require DeveloperDiskImage mounted (or iOS 17+ with automatic mounting). Layer 5 tests require a running USB tunnel.

```bash
pnpm test
```

## Build

```bash
pnpm run build
```

## Credits

Protocol research and original implementation: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) by [@doronz88](https://github.com/doronz88).

## License

GPL-3.0-or-later
