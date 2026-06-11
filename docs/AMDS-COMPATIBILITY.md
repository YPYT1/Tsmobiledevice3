# iTunes AMDS 兼容性问题排查

## 问题现象
- iTunes AMDS 返回错误码 5（未知错误）
- Binary 和 Plist 协议都失败
- 连接建立成功，但协议握手失败

## 排查步骤

### 1. 检查 iTunes 版本
```powershell
# 检查 iTunes 安装路径
dir "C:\Program Files\Common Files\Apple\Mobile Device Support"

# 查看 AppleMobileDeviceService.exe 版本
(Get-Item "C:\Program Files\Common Files\Apple\Mobile Device Support\AppleMobileDeviceService.exe").VersionInfo
```

### 2. 抓包分析 Python 版本通信
```bash
# 安装 Wireshark 或使用 tcpdump
# 过滤 AMDS 端口
tcpdump -i lo0 -w amds.pcap port 27015

# 运行 Python 版本
python -c "from pymobiledevice3 import usbmux; import asyncio; asyncio.run(usbmux.list_devices())"
```

### 3. 多版本协议兼容方案

#### Protocol Version Detection
```
1. 尝试 Plist Protocol (version=1)
2. 如果失败，尝试 Binary Protocol (version=0)
3. 如果仍失败，尝试无额外字段的简化版本
```

#### iTunes Version Compatibility Matrix
| iTunes 版本 | 协议版本 | 必需字段 |
|------------|---------|---------|
| < 12.0     | Binary  | 无      |
| 12.0-12.7  | Plist   | MessageType, ClientVersionString, ProgName, kLibUSBMuxVersion |
| >= 12.8    | Plist   | 仅 MessageType |

## 解决方案

### 方案 A: 协议版本探测
```typescript
async function detectProtocolVersion(socket: Socket): Promise<number> {
  // 尝试版本 1 (Plist)
  try {
    const response = await tryPlistProtocol(socket);
    if (response.Number === 0) return 1;
  } catch {}

  // 尝试版本 0 (Binary)
  try {
    const response = await tryBinaryProtocol(socket);
    if (response.result === 0) return 0;
  } catch {}

  throw new Error('无法检测支持的协议版本');
}
```

### 方案 B: 最小字段集
```typescript
// 最简请求（仅必要字段）
const minimalRequest = {
  MessageType: 'ListDevices'
};

// 标准请求
const standardRequest = {
  MessageType: 'ListDevices',
  ClientVersionString: 'qt4i-usbmuxd',
  ProgName: 'ts-mobiledevice',
  kLibUSBMuxVersion: 3
};
```

### 方案 C: 使用 libimobiledevice
如果 iTunes AMDS 不兼容，可以考虑：
1. 安装 usbmuxd for Windows
2. 使用 libimobiledevice 的 usbmuxd
3. 禁用 iTunes AMDS，启用第三方 usbmuxd

## 测试命令

### Windows PowerShell
```powershell
# 测试端口连接
Test-NetConnection -ComputerName 127.0.0.1 -Port 27015

# 查看 AMDS 日志
Get-EventLog -LogName Application -Source "Apple Mobile Device Service" -Newest 10
```

### 手动协议测试
```powershell
# 使用 PuTTY 或 telnet
telnet 127.0.0.1 27015

# 或使用 PowerShell TCP Client
$client = New-Object System.Net.Sockets.TcpClient
$client.Connect('127.0.0.1', 27015)
$stream = $client.GetStream()
# 发送数据...
```
