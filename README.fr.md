<div align="center">

# ts-mobiledevice

**SDK TypeScript professionnel pour la communication avec les appareils iOS**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | **Français** | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## Introduction

Réécriture complète en TypeScript de [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) pour l'écosystème Node.js. Prêt pour la production, entièrement typé, sans dépendance Python.

| Fonctionnalité | pymobiledevice3 | **ts-mobiledevice** |
|---------------|----------------|---------------------|
| Environnement | Python 3 | Node.js ≥ 18 |
| Typage | ❌ | ✅ TypeScript complet |
| Pool multi-appareils | ❌ | ✅ `DevicePool` |
| Événements hot-plug | ❌ | ✅ EventEmitter |
| Diffusion parallèle | ❌ | ✅ `pool.broadcast()` |
| Serveur REST | ❌ | ✅ NestJS |
| Tableau de bord web | ❌ | ✅ React |
| Découverte Wi-Fi | ❌ | ✅ Bonjour mDNS |

---

## Démarrage rapide

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

// Capture d'écran parallèle de tous les appareils
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

tsmobiledevice usbmux list           # lister les appareils
tsmobiledevice lockdown info         # infos appareil
tsmobiledevice lockdown pair         # appairer un appareil
tsmobiledevice afc ls /              # explorer le système de fichiers
tsmobiledevice apps list             # lister les apps
tsmobiledevice syslog live           # journal en temps réel
tsmobiledevice developer screenshot  # capture d'écran
tsmobiledevice location set <lat> <lng>  # simuler GPS
tsmobiledevice pool devices          # tous les appareils
```

---

## Serveur REST API

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# Documentation : http://localhost:3000/docs
```

---

## Prérequis

| Plateforme | Prérequis |
|-----------|-----------|
| Toutes | Node.js ≥ 18 |
| Windows | iTunes installé (AMDS : `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` en cours d'exécution |
| Appareil iOS | Connexion USB de confiance ou Wi-Fi (Bonjour) |

---

## Licence

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
