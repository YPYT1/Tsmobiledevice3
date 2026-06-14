<div align="center">

# ts-mobiledevice

**전문가급 TypeScript iOS 디바이스 통신 SDK**

[![npm](https://img.shields.io/npm/v/@tsmobiledevice/core?style=flat-square&color=0070f3)](https://www.npmjs.com/package/@tsmobiledevice/core)
[![CI](https://img.shields.io/github/actions/workflow/status/YPYT1/Tsmobiledevice3/ci.yml?style=flat-square&label=CI)](https://github.com/YPYT1/Tsmobiledevice3/actions)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

[English](./README.md) | [中文简体](./README.zh.md) | [中文繁體](./README.zh-TW.md) | [日本語](./README.ja.md) | **한국어** | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

</div>

---

## 소개

[pymobiledevice3](https://github.com/doronz88/pymobiledevice3)를 Node.js 생태계를 위해 TypeScript로 완전히 재작성한 프로덕션 준비 iOS 디바이스 통신 라이브러리입니다. Python 의존성 없이 모든 iOS 통신 프로토콜에 직접 접근할 수 있습니다.

| 기능 | pymobiledevice3 | **ts-mobiledevice** |
|------|----------------|---------------------|
| 런타임 | Python 3 | Node.js ≥ 18 |
| 타입 안전성 | ❌ | ✅ 완전한 TypeScript |
| 멀티 디바이스 풀 | ❌ | ✅ `DevicePool` |
| 핫플러그 이벤트 | ❌ | ✅ EventEmitter |
| 병렬 브로드캐스트 | ❌ | ✅ `pool.broadcast()` |
| REST API 서버 | ❌ | ✅ NestJS |
| 웹 대시보드 | ❌ | ✅ React |
| Wi-Fi 디바이스 검색 | ❌ | ✅ Bonjour mDNS |

---

## 빠른 시작

```bash
npm install @tsmobiledevice/core
```

```typescript
import { LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

// 단일 디바이스
const lockdown = await LockdownService.create();
const factory = new ServiceFactory(lockdown);

const afc = await factory.afc();
const files = await afc.listdir('/');
await afc.close();
await lockdown.close();

// 모든 디바이스 병렬 스크린샷
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

tsmobiledevice usbmux list           # 연결된 디바이스 목록
tsmobiledevice lockdown info         # 디바이스 정보
tsmobiledevice lockdown pair         # 디바이스 페어링
tsmobiledevice afc ls /              # 파일 시스템 탐색
tsmobiledevice apps list             # 앱 목록
tsmobiledevice syslog live           # 실시간 로그
tsmobiledevice developer screenshot  # 스크린샷
tsmobiledevice developer perf        # CPU/메모리 모니터
tsmobiledevice location set <lat> <lng>  # GPS 설정
tsmobiledevice pool devices          # 전체 디바이스 상태
```

---

## REST API 서버

```bash
git clone https://github.com/YPYT1/Tsmobiledevice3.git && cd Tsmobiledevice3
pnpm install && pnpm build:core
pnpm dev:server   # http://localhost:3000/api
# 문서: http://localhost:3000/docs
```

---

## 요구 사항

| 플랫폼 | 요구 사항 |
|--------|-----------|
| 전체 | Node.js ≥ 18 |
| Windows | iTunes 설치 (AMDS: `127.0.0.1:27015`) |
| macOS / Linux | `usbmuxd` 실행 중 |
| iOS 디바이스 | USB 신뢰 연결 또는 Wi-Fi (Bonjour 검색) |

---

## 라이선스

[GPL-3.0-or-later](LICENSE) © 2024–2026 YPYT1
