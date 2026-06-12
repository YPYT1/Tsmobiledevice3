# @ts-mobiledevice/core

TypeScript library for iOS device communication over USB/Network — usbmux, lockdown, AFC, DVT, and remote services.

## Install

```bash
npm install @ts-mobiledevice/core
```

## Quick Start

```typescript
import { DevicePool } from '@ts-mobiledevice/core';

const pool = await DevicePool.connect();
const devices = pool.getDevices();
console.log(devices.map(d => d.serial));

pool.on('device:connected', (d) => console.log('connected:', d.serial));
pool.on('device:disconnected', (udid) => console.log('disconnected:', udid));
pool.close();
```

## API

### DevicePool
- `DevicePool.connect(usbmuxAddress?)` — connect and start hot-plug listening
- `pool.getDevices()` — list connected `MuxDevice` instances
- `pool.getDevice(udid)` — look up a device by UDID
- `pool.broadcast(fn)` — run an async function on all devices in parallel
- `pool.close()` — stop listening

### Device
- `device.info` — `{ udid, deviceName, productVersion, productType, serialNumber }`
- `device.screenshot()` — capture screen as `Buffer`
- `device.processes()` — list running processes `{ pid, name, path }[]`
- `device.syslog()` — async generator of syslog lines
- `device.afc()` — AFC filesystem service
- `device.apps()` — InstallationProxy for app management
