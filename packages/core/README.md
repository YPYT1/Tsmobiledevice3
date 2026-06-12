# @tsmobiledevice/core

TypeScript iOS device communication library — full protocol stack from USB to iOS 17+ RemoteXPC.

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

## Install

```bash
npm install @tsmobiledevice/core
```

## Quick Start

### Multi-device pool (4th-gen API)

```typescript
import { DevicePool } from '@tsmobiledevice/core';

const pool = await DevicePool.connect();

// Hot-plug events
pool.on('device:connected',    (device) => console.log('connected:', device.udid));
pool.on('device:disconnected', (udid)   => console.log('disconnected:', udid));

// Parallel screenshot all devices
const results = await pool.broadcast(async (device) => {
  const png = await device.screenshot();   // auto-mounts DDI on iOS ≤16
  return png;
});

pool.close();
```

### Single device

```typescript
import { LockdownService, ServiceFactory, DvtFactory } from '@tsmobiledevice/core';

const lockdown = await LockdownService.create(/* udid? */);
const factory  = new ServiceFactory(lockdown);

// File access
const afc  = await factory.afc();
const ls   = await afc.listdir('/');
await afc.close();

// Apps
const proxy = await factory.installationProxy();
const apps  = await proxy.getApps('User');
await proxy.close();

// Screenshots + processes (requires DDI or iOS 17+)
const dvt  = await DvtFactory.create(lockdown);
const png  = await (await dvt.screenshot()).takeScreenshot();
const info = await dvt.deviceInfo();
const procs = await info.proclist();
dvt.close();

await lockdown.close();
```

## Protocol Layers

| Layer | Protocol | Coverage |
|-------|----------|----------|
| 1 | usbmux — USB device discovery & TCP forwarding | ✅ |
| 2 | lockdown — pairing, TLS session, service brokering | ✅ |
| 3 | 30+ services — AFC, syslog, diagnostics, screenshots… | ✅ |
| 4 | DTX — Instruments / DVT binary protocol | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ tunnel service discovery | ✅ |

## API Reference

### DevicePool

```typescript
DevicePool.connect(usbmuxAddress?)     // start pool + hot-plug listener
pool.getDevices()                      // Device[]
pool.getDevice(udid)                   // Device | undefined
pool.broadcast(fn)                     // parallel run, returns results[]
pool.on('device:connected', cb)
pool.on('device:disconnected', cb)
pool.close()
```

### Device

```typescript
device.udid                            // string
device.connectionType                  // 'USB' | 'Network'
device.info                            // Promise<{ udid, deviceName, productVersion, ... }>
device.screenshot()                    // Promise<Buffer>  (PNG)
device.processes()                     // Promise<{ pid, name, path }[]>
device.syslog()                        // Promise<AsyncGenerator<string>>
device.afc()                           // Promise<AfcService>
device.apps()                          // Promise<InstallationProxy>
device.close()
```

### ServiceFactory (low-level)

| Method | Service |
|--------|---------|
| `factory.afc()` | File system (AFC) |
| `factory.syslog()` | Real-time syslog stream |
| `factory.screenshot()` | Screen capture |
| `factory.installationProxy()` | App install / uninstall / list |
| `factory.diagnostics()` | Battery, sleep, restart |
| `factory.simulateLocation()` | GPS simulation |
| `factory.crashReports()` | Crash log retrieval |
| `factory.osTrace()` | OS trace stream |
| `factory.pcapd()` | Live packet capture |
| `factory.webInspector()` | WebKit remote debug |
| `factory.imageMounter()` | DeveloperDiskImage mount |
| `factory.dvt()` | DTX/DVT factory |

### DvtFactory (Instruments)

| Method | Service |
|--------|---------|
| `dvt.deviceInfo()` | System info, process list |
| `dvt.screenshot()` | DVT-based screen capture |
| `dvt.processControl()` | Launch / kill processes |
| `dvt.sysmontap()` | CPU & memory monitoring |
| `dvt.applicationListing()` | Installed apps |

## Requirements

- Node.js ≥ 18
- **Windows**: iTunes installed (AMDS on port 27015)
- **macOS / Linux**: usbmuxd running

## Credits

Protocol research: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) by [@doronz88](https://github.com/doronz88).

## License

GPL-3.0-or-later
