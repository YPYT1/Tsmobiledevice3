<div align="center">

# ts-mobiledevice

**SDK TypeScript profissional para comunicação com dispositivos iOS**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | **Português** | [Русский](./README.ru.md)

</div>

---

## Introdução

Reescrita completa em TypeScript de [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) para o ecossistema Node.js. Pronto para produção, totalmente tipado, sem dependências Python.

| Recurso | pymobiledevice3 | **ts-mobiledevice** |
|---------|----------------|---------------------|
| Ambiente | Python 3 | Node.js ≥ 18 |
| Tipagem | ❌ | ✅ TypeScript completo |
| Pool multi-dispositivos | ❌ | ✅ `DevicePool` |
| Eventos hot-plug | ❌ | ✅ EventEmitter |
| Broadcast paralelo | ❌ | ✅ `pool.broadcast()` |
| Servidor REST | ❌ | ✅ NestJS |
| Dashboard web | ❌ | ✅ React |
| Descoberta Wi-Fi | ❌ | ✅ Bonjour mDNS |

---

## Início rápido

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

// Screenshot paralelo de todos os dispositivos
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
tsmobiledevice lockdown info         # info do dispositivo
tsmobiledevice lockdown pair         # emparelhar dispositivo
tsmobiledevice afc ls /              # explorar sistema de arquivos
tsmobiledevice apps list             # listar aplicativos
tsmobiledevice syslog live           # log em tempo real
tsmobiledevice developer screenshot  # captura de tela
tsmobiledevice location set <lat> <lng>  # simular GPS
tsmobiledevice pool devices          # todos os dispositivos
```

---

## Servidor REST API

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# Documentação: http://localhost:3000/docs
```

---

## Requisitos

| Plataforma | Requisito |
|-----------|-----------|
| Todos | Node.js ≥ 18 |
| Windows | iTunes instalado (AMDS: `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` em execução |
| Dispositivo iOS | Conexão USB confiável ou Wi-Fi (Bonjour) |

---

## Licença

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
