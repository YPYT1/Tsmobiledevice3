<div align="center">

# ts-mobiledevice

**SDK profesional de TypeScript para comunicación con dispositivos iOS**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | **Español** | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## Introducción

Reimplementación completa en TypeScript de [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) para el ecosistema Node.js. Lista para producción, con tipado completo y sin dependencias de Python.

| Característica | pymobiledevice3 | **ts-mobiledevice** |
|---------------|----------------|---------------------|
| Entorno | Python 3 | Node.js ≥ 18 |
| Tipos | ❌ | ✅ TypeScript completo |
| Pool multi-dispositivo | ❌ | ✅ `DevicePool` |
| Eventos hot-plug | ❌ | ✅ EventEmitter |
| Broadcast paralelo | ❌ | ✅ `pool.broadcast()` |
| Servidor REST | ❌ | ✅ NestJS |
| Panel web | ❌ | ✅ React |
| Descubrimiento Wi-Fi | ❌ | ✅ Bonjour mDNS |

---

## Inicio rápido

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

// Captura paralela de todos los dispositivos
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

tsmobiledevice usbmux list           # listar dispositivos
tsmobiledevice lockdown info         # info del dispositivo
tsmobiledevice lockdown pair         # emparejar dispositivo
tsmobiledevice afc ls /              # explorar sistema de archivos
tsmobiledevice apps list             # listar aplicaciones
tsmobiledevice syslog live           # log en tiempo real
tsmobiledevice developer screenshot  # captura de pantalla
tsmobiledevice location set <lat> <lng>  # simular GPS
tsmobiledevice pool devices          # todos los dispositivos
```

---

## Servidor REST API

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# Documentación: http://localhost:3000/docs
```

---

## Requisitos

| Plataforma | Requisito |
|-----------|-----------|
| Todos | Node.js ≥ 18 |
| Windows | iTunes instalado (AMDS: `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` en ejecución |
| Dispositivo iOS | Conexión USB de confianza o Wi-Fi (Bonjour) |

---

## Licencia

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
