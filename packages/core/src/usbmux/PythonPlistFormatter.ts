/**
 * Python plistlib 格式精确复制
 * 完全模仿 Python plistlib.dumps() 的输出格式
 */

export class PythonPlistFormatter {
  /**
   * 精确模仿 Python plistlib.dumps() 格式
   * - 使用 TAB 缩进（不是 SPACE）
   * - 字段顺序严格按照 Python 顺序
   * - 使用 Python plistlib 的 XML 格式风格
   */
  static formatListDevicesRequest(): string {
    // Python plistlib.dumps() 的精确格式
    // 注意：字段顺序必须严格按照 Python 的顺序！
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>ClientVersionString</key>
\t<string>qt4i-usbmuxd</string>
\t<key>MessageType</key>
\t<string>ListDevices</string>
\t<key>ProgName</key>
\t<string>ts-mobiledevice</string>
\t<key>kLibUSBMuxVersion</key>
\t<integer>3</integer>
</dict>
</plist>`;
  }

  /**
   * Connect 请求 - Python 格式
   */
  static formatConnectRequest(deviceId: number, port: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>ClientVersionString</key>
\t<string>qt4i-usbmuxd</string>
\t<key>MessageType</key>
\t<string>Connect</string>
\t<key>ProgName</key>
\t<string>ts-mobiledevice</string>
\t<key>kLibUSBMuxVersion</key>
\t<integer>3</integer>
\t<key>DeviceID</key>
\t<integer>${deviceId}</integer>
\t<key>PortNumber</key>
\t<integer>${port}</integer>
</dict>
</plist>`;
  }

  /**
   * ReadBUID 请求 - Python 格式
   */
  static formatReadBUIDRequest(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>ClientVersionString</key>
\t<string>qt4i-usbmuxd</string>
\t<key>MessageType</key>
\t<string>ReadBUID</string>
\t<key>ProgName</key>
\t<string>ts-mobiledevice</string>
\t<key>kLibUSBMuxVersion</key>
\t<integer>3</integer>
</dict>
</plist>`;
  }

  /**
   * Listen 请求 - Python 格式
   */
  static formatListenRequest(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>ClientVersionString</key>
\t<string>qt4i-usbmuxd</string>
\t<key>MessageType</key>
\t<string>Listen</string>
\t<key>ProgName</key>
\t<string>ts-mobiledevice</string>
\t<key>kLibUSBMuxVersion</key>
\t<integer>3</integer>
</dict>
</plist>`;
  }
}