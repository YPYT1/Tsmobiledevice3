# @tsmobiledevice/cli

CLI tool for iOS device communication.

## Install

```bash
npm install -g @tsmobiledevice/cli
# or
npx @tsmobiledevice/cli usbmux list
```

## Commands

```
tsmobiledevice usbmux list
tsmobiledevice lockdown info
tsmobiledevice afc ls <path>
tsmobiledevice apps list
tsmobiledevice syslog live
tsmobiledevice developer screenshot
tsmobiledevice pool devices
tsmobiledevice pool watch
```

## Requirements
- Node.js ≥ 18
- Windows: iTunes installed
- macOS/Linux: usbmuxd running

## License
GPL-3.0-or-later
