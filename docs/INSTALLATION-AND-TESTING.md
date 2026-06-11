# 🚀 ts-mobiledevice 安装和测试指南

## 第 1 步：环境准备

### Windows 环境

1. **安装 iTunes 或 Apple Mobile Device Support**
   - 下载地址: https://apps.microsoft.com/detail/9pb2mz1zmb1s
   - 安装后，AMDS 服务会自动运行在 `127.0.0.1:27015`

2. **验证 AMDS 服务运行状态**
   ```powershell
   # 打开 PowerShell，检查端口
   netstat -ano | findstr :27015
   
   # 应该看到类似输出：
   # TCP    127.0.0.1:27015    0.0.0.0:0    LISTENING    1234
   ```

3. **连接 iOS 设备**
   - 使用 USB 线缆连接 iPhone/iPad
   - 在设备上点击"信任此电脑"
   - 输入设备密码确认信任

### Linux 环境

1. **安装 usbmuxd**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install usbmuxd
   
   # 启动服务
   sudo systemctl start usbmuxd
   sudo systemctl enable usbmuxd
   ```

2. **连接 iOS 设备**
   - USB 连接设备
   - 信任电脑

### macOS 环境

- macOS 自带支持，无需额外安装

## 第 2 步：安装项目

```bash
# 克隆仓库
git clone https://github.com/YPYT1/Tsmobiledevice3.git
cd ts-mobiledevice

# 安装依赖（可能需要 5-10 分钟）
npm install

# 构建项目
npm run build
```

## 第 3 步：真机测试 Layer 1

### 运行测试

```bash
# 进入 core 包目录
cd packages/core

# 运行 Layer 1 测试
npm run test:layer1
```

### 预期输出

```
PASS  tests/usbmux.test.ts
  Layer 1: usbmux protocol
    Connection Tests
      ✓ should connect to usbmuxd daemon (15 ms)
      ✓ should handle connection failure gracefully (5 ms)
    Device Discovery Tests
      ✓ should list connected devices (234 ms)
      Found 1 device(s)
      Device: {
        UDID: '6411ea69a44ce2b150adda4a24accd39c3d42696',
        DeviceID: 1,
        Connection: 'USB'
      }
      ✓ should select device by UDID (45 ms)
      ✓ should select device by connection type (67 ms)
    Port Connection Tests
      ✓ should connect to device lockdown port (62078) (123 ms)
      ✅ Successfully connected to lockdown port
    System BUID Tests
      ✓ should get system BUID (89 ms)
      System BUID: 30142955-444094379208051516

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Time:        3.456 s
```

### 测试失败排查

#### 问题 1: ConnectionFailedToUsbmuxdError

```
Error: Failed to connect to usbmuxd daemon
```

**解决方案:**
- Windows: 确认 iTunes AMDS 服务正在运行
  ```powershell
  # 检查服务状态
  Get-Service "Apple Mobile Device Service"
  
  # 如果未运行，启动服务
  Start-Service "Apple Mobile Device Service"
  ```
- Linux: 确认 usbmuxd 服务正在运行
  ```bash
  sudo systemctl status usbmuxd
  sudo systemctl start usbmuxd
  ```

#### 问题 2: No devices found

```
Found 0 device(s)
⚠️  No devices found
```

**解决方案:**
1. 检查 USB 连接是否正常
2. 在 iOS 设备上点击"信任此电脑"
3. 拔掉 USB 重新连接
4. 尝试不同的 USB 端口

#### 问题 3: Timeout Error

```
Error: Socket receive timeout
```

**解决方案:**
- 测试超时时间设置为 10 秒，如果设备响应慢可能超时
- 重新运行测试: `npm run test:layer1`

## 第 4 步：使用 CLI 工具

```bash
# 返回项目根目录
cd ../..

# 列出设备
npm run dev -- usbmux list

# 输出示例：
# Connected devices:
#
#   UDID:        6411ea69a44ce2b150adda4a24accd39c3d42696
#   Device ID:   1
#   Connection:  USB

# JSON 格式输出
npm run dev -- usbmux list --json
```

## 第 5 步：编写你的第一个代码

创建测试文件 `test-usbmux.ts`:

```typescript
// packages/core/test-usbmux.ts
import { listDevices, selectDevice } from './src/usbmux';

async function main() {
  try {
    // 列出所有设备
    const devices = await listDevices();
    console.log(`Found ${devices.length} device(s)`);

    for (const device of devices) {
      console.log('Device:', {
        UDID: device.serial,
        Connection: device.connectionType,
      });
    }

    // 选择 USB 设备
    const usbDevice = await selectDevice(undefined, 'USB');
    if (usbDevice) {
      console.log('USB Device:', usbDevice.serial);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
```

运行:
```bash
cd packages/core
npx ts-node test-usbmux.ts
```

## ✅ Layer 1 测试通过标准

如果所有测试通过，说明：

- ✅ usbmux 协议实现正确
- ✅ 能发现已连接的 iOS 设备
- ✅ 能连接到设备的 lockdown 端口
- ✅ 跨平台兼容性良好

**恭喜！可以开始 Layer 2 (lockdown) 的开发了。**

## 📝 下一步

1. 如果 Layer 1 测试全部通过 → 开始实现 Layer 2
2. 如果测试失败 → 根据错误信息排查问题
3. 记录所有问题到 GitHub Issues

## 🆘 获取帮助

如果遇到问题：
1. 查看 [GitHub Issues](https://github.com/YPYT1/Tsmobiledevice3/issues)
2. 提交新的 Issue，附上错误日志和设备信息：
   - 操作系统版本
   - iOS 设备型号和版本
   - 完整的错误堆栈
