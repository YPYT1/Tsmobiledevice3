<div align="center">

# ts-mobiledevice

**Professionelles TypeScript SDK für iOS-Gerätekommunikation**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | **Deutsch** | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## Einführung

Vollständige TypeScript-Neuimplementierung von [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) für das Node.js-Ökosystem. Produktionsreif, vollständig typisiert, keine Python-Abhängigkeit.

| Funktion | pymobiledevice3 | **ts-mobiledevice** |
|---------|----------------|---------------------|
| Laufzeit | Python 3 | Node.js ≥ 18 |
| Typsicherheit | ❌ | ✅ Vollständiges TypeScript |
| Multi-Geräte-Pool | ❌ | ✅ `DevicePool` |
| Hot-Plug-Events | ❌ | ✅ EventEmitter |
| Paralleler Broadcast | ❌ | ✅ `pool.broadcast()` |
| REST-API-Server | ❌ | ✅ NestJS |
| Web-Dashboard | ❌ | ✅ React |
| Wi-Fi-Geräteerkennung | ❌ | ✅ Bonjour mDNS |

---

## Schnellstart

```bash
npm install @tsmobiledevice/core
```

```typescript
import { LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

const lockdown = await LockdownService.create();
const factory = new ServiceFactory(lockdown);

const afc = await factory.afc();
const files = await afc.listdir('/');
await afc.close();
await lockdown.close();

// Parallele Screenshots aller Geräte
const pool = await DevicePool.connect({ enableBonjour: true });
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

tsmobiledevice usbmux list           # Geräte auflisten
tsmobiledevice lockdown info         # Geräteinfos
tsmobiledevice lockdown pair         # Gerät koppeln
tsmobiledevice afc ls /              # Dateisystem erkunden
tsmobiledevice apps list             # Apps auflisten
tsmobiledevice syslog live           # Echtzeit-Log
tsmobiledevice developer screenshot  # Screenshot
tsmobiledevice location set <lat> <lng>  # GPS simulieren
tsmobiledevice pool devices          # Alle Geräte
```

---

## REST-API-Server

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# Dokumentation: http://localhost:3000/docs
```

---

## Voraussetzungen

| Plattform | Voraussetzung |
|-----------|--------------|
| Alle | Node.js ≥ 18 |
| Windows | iTunes installiert (AMDS: `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` läuft |
| iOS-Gerät | Vertrauenswürdige USB-Verbindung oder Wi-Fi (Bonjour) |

---

## Lizenz

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
