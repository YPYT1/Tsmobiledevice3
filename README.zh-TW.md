<div align="center">

# ts-mobiledevice

**專業級 TypeScript iOS 設備通訊 SDK**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | **中文繁體** | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## 簡介

為 Node.js 生態系統完整重寫 [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)，生產就緒，提供完整的 TypeScript 類型支援。無需 Python 依賴，直接存取所有 iOS 通訊協定。

| 特性 | pymobiledevice3 | **ts-mobiledevice** |
|------|----------------|---------------------|
| 執行環境 | Python 3 | Node.js ≥ 18 |
| 型別安全 | ❌ | ✅ 完整 TypeScript |
| 多設備連接池 | ❌ | ✅ `DevicePool` |
| 熱插拔事件 | ❌ | ✅ EventEmitter |
| 並行廣播 | ❌ | ✅ `pool.broadcast()` |
| REST API 伺服器 | ❌ | ✅ NestJS |
| Web 管理介面 | ❌ | ✅ React |
| Wi-Fi 設備發現 | ❌ | ✅ Bonjour mDNS |

---

## 快速開始

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

// 多設備並行截圖
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

tsmobiledevice usbmux list           # 列出連接的設備
tsmobiledevice lockdown info         # 顯示設備資訊
tsmobiledevice lockdown pair         # 配對設備
tsmobiledevice afc ls /              # 瀏覽設備檔案系統
tsmobiledevice apps list             # 列出應用程式
tsmobiledevice syslog live           # 即時日誌串流
tsmobiledevice developer screenshot  # 截圖
tsmobiledevice location set <lat> <lng>  # 設定 GPS
tsmobiledevice pool devices          # 所有設備狀態
tsmobiledevice pool screenshot -o <dir>  # 並行截圖
```

---

## REST API 伺服器

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# 文件：http://localhost:3000/docs
```

---

## 環境需求

| 平台 | 需求 |
|------|------|
| 全平台 | Node.js ≥ 18 |
| Windows | iTunes（提供 AMDS，`127.0.0.1:27015`） |
| macOS / Linux | `usbmuxd` 執行中 |
| iOS 設備 | USB 信任連接 或 Wi-Fi（Bonjour 發現） |

---

## 授權條款

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
