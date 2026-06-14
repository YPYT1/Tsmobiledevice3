<div align="center">

# ts-mobiledevice

**プロフェッショナル TypeScript iOS デバイス通信 SDK**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | **日本語** | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## 概要

Node.js エコシステムのために [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) を完全に TypeScript で書き直した、プロダクション対応の iOS デバイス通信ライブラリです。Python 依存なしで全 iOS 通信プロトコルに直接アクセスできます。

| 機能 | pymobiledevice3 | **ts-mobiledevice** |
|------|----------------|---------------------|
| ランタイム | Python 3 | Node.js ≥ 18 |
| 型安全性 | ❌ | ✅ 完全な TypeScript |
| マルチデバイスプール | ❌ | ✅ `DevicePool` |
| ホットプラグイベント | ❌ | ✅ EventEmitter |
| 並列ブロードキャスト | ❌ | ✅ `pool.broadcast()` |
| REST API サーバー | ❌ | ✅ NestJS |
| Web 管理画面 | ❌ | ✅ React |
| Wi-Fi デバイス検出 | ❌ | ✅ Bonjour mDNS |

---

## クイックスタート

```bash
npm install @tsmobiledevice/core
```

```typescript
import { LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

// 単一デバイス
const lockdown = await LockdownService.create();
const factory = new ServiceFactory(lockdown);

const afc = await factory.afc();
const files = await afc.listdir('/');
await afc.close();
await lockdown.close();

// 全デバイス並列スクリーンショット
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

tsmobiledevice usbmux list           # 接続デバイス一覧
tsmobiledevice lockdown info         # デバイス情報
tsmobiledevice lockdown pair         # デバイスのペアリング
tsmobiledevice afc ls /              # デバイスファイルシステム
tsmobiledevice apps list             # アプリ一覧
tsmobiledevice syslog live           # リアルタイムログ
tsmobiledevice developer screenshot  # スクリーンショット
tsmobiledevice developer perf        # CPU/メモリモニター
tsmobiledevice location set <lat> <lng>  # GPS 設定
tsmobiledevice pool devices          # 全デバイス状態
tsmobiledevice pool screenshot -o <dir>  # 並列スクリーンショット
```

---

## REST API サーバー

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# ドキュメント: http://localhost:3000/docs
```

---

## 動作環境

| プラットフォーム | 要件 |
|---------|------|
| 全環境 | Node.js ≥ 18 |
| Windows | iTunes インストール済み（AMDS：`127.0.0.1:27015`） |
| macOS / Linux | `usbmuxd` 実行中 |
| iOS デバイス | USB 信頼接続 または Wi-Fi（Bonjour 検出後） |

---

## ライセンス

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
