# ts-mobiledevice

TypeScript implementation of `pymobiledevice3` - Pure TypeScript library for iOS device communication.

## 🚧 Status: Under Development

**Current Progress**: Layer 1 (usbmux protocol) - Implementation complete, awaiting real device testing

## 📋 Project Structure

This is a **Monorepo** project using Lerna and TypeScript, designed to support both:
- 🛠️ **CLI Tool**: Command-line interface for iOS device operations
- 📦 **NPM Package**: Library for NestJS and other TypeScript projects

```
ts-mobiledevice/
├── packages/
│   ├── core/           # Core protocol library
│   │   ├── src/
│   │   │   ├── usbmux/        # Layer 1: Device discovery & port forwarding
│   │   │   ├── lockdown/     # Layer 2: Pairing & service management (TODO)
│   │   │   ├── services/     # Layer 3: AFC, InstallationProxy, etc. (TODO)
│   │   │   ├── dtx/          # Layer 4: Developer tools protocol (TODO)
│   │   │   └── remote/        # Layer 5: RemoteXPC for iOS 17+ (TODO)
│   │   └── tests/             # Real device tests
│   └── cli/            # CLI tool
└── docs/               # Design documents
```

## 🎯 Features

### ✅ Layer 1: usbmux Protocol (Completed)
- Device discovery (USB and Network)
- TCP port forwarding
- Cross-platform support (Windows/Linux/macOS)
- Plist protocol implementation

### 🚧 Layer 2: lockdown Protocol (In Progress)
- Pairing management
- Service connection
- SSL upgrade

### 📅 Layer 3-6: Coming Soon
- AFC file transfer
- Application management
- DTX developer tools
- RemoteXPC (iOS 17+)

## 🚀 Quick Start

### Prerequisites

**Windows:**
- Install iTunes or Apple Mobile Device Support
- AMDS must be running on `127.0.0.1:27015`

**Linux:**
```bash
sudo apt-get install usbmuxd
```

**macOS:**
- Native support (no additional installation required)

### Installation

```bash
# Clone repository
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd ts-mobiledevice

# Install dependencies
npm install

# Build project
npm run build
```

### Usage

#### CLI Tool
```bash
# List connected devices
npm run dev -- usbmux list

# Output as JSON
npm run dev -- usbmux list --json
```

#### NPM Package (Coming Soon)
```typescript
import { listDevices } from '@ts-mobiledevice/core';

const devices = await listDevices();
console.log('Connected devices:', devices);
```

## 🧪 Testing

### Real Device Testing (Required)

```bash
# Run Layer 1 tests (usbmux)
npm run test:layer1

# Expected output:
# ✓ should connect to usbmuxd daemon
# ✓ should list connected devices
# ✓ should connect to device lockdown port (62078)
```

**Test Requirements:**
- At least one iOS device connected via USB
- iTunes AMDS running (Windows) or usbmuxd (Linux/macOS)

## 📚 Architecture

### Layered Implementation

```
┌─────────────────────────────────────┐
│ Layer 6: CLI Tool                   │
├─────────────────────────────────────┤
│ Layer 5: RemoteXPC (iOS 17+)       │
├─────────────────────────────────────┤
│ Layer 4: DTX Protocol               │
├─────────────────────────────────────┤
│ Layer 3: Services (AFC, Apps, etc) │
├─────────────────────────────────────┤
│ Layer 2: Lockdown Protocol          │ ← Next
├─────────────────────────────────────┤
│ Layer 1: usbmux Protocol           │ ← ✅ Complete
└─────────────────────────────────────┘
```

Each layer must pass **real device tests** before proceeding to the next.

## 🔧 Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Test
```bash
# Test all layers
npm run test

# Test specific layer
npm run test:layer1
npm run test:layer2
npm run test:layer3
```

## 📖 Documentation

- [Design Document](./docs/superpowers/specs/2026-06-11-ts-mobiledevice-design.md)
- [Protocol Reference](./docs/superpowers/specs/2026-06-11-ts-mobiledevice-design.md#分层实施计划)

## 🤝 Contributing

This project is under active development. Contributions are welcome!

## 📝 License

GPL-3.0-or-later

## 🙏 Credits

- Original Python implementation: [pymobiledevice3](https://github.com/doronz88/pymobiledevice3)
- Protocol reference: [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice)
