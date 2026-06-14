<div align="center">

# ts-mobiledevice

**Профессиональный TypeScript SDK для коммуникации с iOS-устройствами**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | **Русский**

</div>

---

## Введение

Полная переработка [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) на TypeScript для экосистемы Node.js. Готов к использованию в продакшн, полностью типизирован, без зависимостей от Python.

| Возможность | pymobiledevice3 | **ts-mobiledevice** |
|------------|----------------|---------------------|
| Среда выполнения | Python 3 | Node.js ≥ 18 |
| Типобезопасность | ❌ | ✅ Полный TypeScript |
| Пул нескольких устройств | ❌ | ✅ `DevicePool` |
| События горячего подключения | ❌ | ✅ EventEmitter |
| Параллельный broadcast | ❌ | ✅ `pool.broadcast()` |
| REST API сервер | ❌ | ✅ NestJS |
| Веб-панель управления | ❌ | ✅ React |
| Обнаружение устройств Wi-Fi | ❌ | ✅ Bonjour mDNS |

---

## Быстрый старт

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

// Параллельные скриншоты всех устройств
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

tsmobiledevice usbmux list           # список устройств
tsmobiledevice lockdown info         # информация об устройстве
tsmobiledevice lockdown pair         # сопряжение устройства
tsmobiledevice afc ls /              # просмотр файловой системы
tsmobiledevice apps list             # список приложений
tsmobiledevice syslog live           # системный лог в реальном времени
tsmobiledevice developer screenshot  # скриншот
tsmobiledevice location set <lat> <lng>  # симуляция GPS
tsmobiledevice pool devices          # все устройства
```

---

## REST API сервер

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# Документация: http://localhost:3000/docs
```

---

## Требования

| Платформа | Требование |
|-----------|-----------|
| Все | Node.js ≥ 18 |
| Windows | iTunes установлен (AMDS: `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` запущен |
| iOS-устройство | Доверенное USB-соединение или Wi-Fi (Bonjour) |

---

## Лицензия

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
