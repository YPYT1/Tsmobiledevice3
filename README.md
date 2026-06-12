# ts-mobiledevice

TypeScript implementation of [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) — iOS device communication library.

## Features

| Layer | Protocol | Status |
|-------|----------|--------|
| 1 | usbmux — device discovery & port forwarding | ✅ |
| 2 | lockdown — device pairing & service management | ✅ |
| 3 | Services — AFC, screenshots, syslog, diagnostics, 30+ services | ✅ |
| 4 | DTX — Instruments/DVT (process list, app list, performance) | ✅ |
| 5 | RemoteXPC / RSD — iOS 17+ remote service discovery | ✅ |

## Requirements

- Node.js ≥ 18
- pnpm ≥ 8
- **Windows**: iTunes installed (provides AMDS on port 27015)
- **macOS/Linux**: usbmuxd running
- iOS device connected via USB

## Install

```bash
pnpm install
```

## Usage

```typescript
import { LockdownService, ServiceFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
console.log('Device:', lockdown.udid, lockdown.productVersion);

const factory = new ServiceFactory(lockdown);

const afc = await factory.afc();
const files = await afc.listdir('/');
await afc.close();

await lockdown.close();
```

### DTX / Instruments (requires DeveloperDiskImage)

```typescript
import { LockdownService, DvtFactory } from '@ts-mobiledevice/core';

const lockdown = await LockdownService.create();
const dvt = await DvtFactory.create(lockdown);

const info = await dvt.deviceInfo();
const procs = await info.proclist();
console.log(`${procs.length} processes`);
await info.close();

dvt.close();
await lockdown.close();
```

### RemoteXPC / RSD (iOS 17+)

```typescript
import { RemoteServiceDiscovery } from '@ts-mobiledevice/core';

// Requires USB tunnel: pymobiledevice3 remote start-tunnel
const rsd = new RemoteServiceDiscovery('::1');
await rsd.connect();
console.log('Services:', Object.keys(rsd.peerInfo?.Services ?? {}));
rsd.close();
```

## Available Services

| Method | Service |
|--------|---------|
| `factory.afc()` | File system (AFC) |
| `factory.syslog()` | System log stream |
| `factory.screenshot()` | Screen capture |
| `factory.installationProxy()` | App install/uninstall |
| `factory.springBoard()` | SpringBoard icon state |
| `factory.diagnostics()` | Battery, sleep, restart |
| `factory.simulateLocation()` | GPS simulation |
| `factory.notificationProxy()` | Push notification relay |
| `factory.mobileBackup2()` | Device backup |
| `factory.webInspector()` | WebKit remote debug |
| `factory.houseArrest(bundleId)` | Per-app file access |
| `factory.crashReports()` | Crash log retrieval |
| `factory.osTrace()` | OS trace log stream |
| `factory.pcapd()` | Network packet capture |
| `factory.imageMounter()` | DeveloperDiskImage mount |
| `factory.mobileConfig()` | MDM profile management |
| `dvt.deviceInfo()` | System info, process list |
| `dvt.processControl()` | Launch/kill processes |
| `dvt.applicationListing()` | Installed app enumeration |
| `dvt.sysmontap()` | CPU/memory monitoring |
| `dvt.screenshot()` | DVT screenshot |

## Testing

Tests require a real iOS device connected via USB.

```bash
pnpm test
```

Layer 4 (DTX) requires DeveloperDiskImage mounted. Layer 5 (RSD) requires iOS 17+ and a USB tunnel.

## Build

```bash
pnpm run build
```

## Project Structure

```
packages/core/src/
├── usbmux/          # Layer 1: usbmux protocol
├── lockdown/        # Layer 2: lockdown protocol
├── services/        # Layer 3: all lockdown services
│   └── dvt/         # Layer 4: DTX/Instruments services
├── dtx/             # Layer 4: DTX binary protocol
└── remote/          # Layer 5: RemoteXPC / RSD (iOS 17+)
```

## Credits

- Original Python implementation: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)

## License

GPL-3.0-or-later
