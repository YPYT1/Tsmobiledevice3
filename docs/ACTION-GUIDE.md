# 🎯 ts-mobiledevice - 立即开始行动指南

## 📊 项目当前状态

✅ **Layer 1 (usbmux 协议) - 已完成实现**

- 设备发现功能 ✅
- 跨平台支持 ✅
- 端口转发功能 ✅
- 真机测试套件 ✅

**代码统计**: 25 个文件，1700+ 行代码，4 次提交

---

## 🚀 立即开始测试（3 种方式）

### 方式 1：一键测试（推荐）

**Windows:**
```bash
cd D:/Project/ts-mobiledevice
quick-start.bat
```

**Linux/macOS:**
```bash
cd D:/Project/ts-mobiledevice
./quick-start.sh
```

### 方式 2：手动测试

```bash
# 1. 进入项目目录
cd D:/Project/ts-mobiledevice

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 运行 Layer 1 测试
cd packages/core
npm run test:layer1
```

### 方式 3：CLI 工具测试

```bash
# 安装并构建后
npm run dev -- usbmux list

# JSON 输出
npm run dev -- usbmux list --json
```

---

## ✅ 测试成功标准

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
```

### 成功标志

- ✅ 所有 7 个测试通过
- ✅ 发现至少 1 台 iOS 设备
- ✅ 成功连接到 lockdown 端口
- ✅ 获取系统 BUID

---

## 📋 测试前检查清单

### Windows 环境

- [ ] iTunes 已安装（或 Apple Mobile Device Support）
- [ ] AMDS 服务正在运行（端口 27015）
- [ ] iOS 设备通过 USB 连接
- [ ] 设备已信任此电脑
- [ ] Node.js >= 18.0.0
- [ ] npm >= 9.0.0

**验证 AMDS 服务:**
```powershell
netstat -ano | findstr :27015
# 应该看到 LISTENING 状态
```

### Linux 环境

- [ ] usbmuxd 已安装（`sudo apt-get install usbmuxd`）
- [ ] usbmuxd 服务正在运行
- [ ] iOS 设备通过 USB 连接
- [ ] 设备已信任此电脑

**验证 usbmuxd:**
```bash
sudo systemctl status usbmuxd
ls -l /var/run/usbmuxd
```

### macOS 环境

- [ ] iOS 设备通过 USB 连接
- [ ] 设备已信任此电脑

---

## 🐛 故障排查

### 问题 1: ConnectionFailedToUsbmuxdError

**原因**: usbmuxd daemon 未运行

**解决方案:**

Windows:
```powershell
# 启动 Apple Mobile Device Service
net start "Apple Mobile Device Service"
```

Linux:
```bash
sudo systemctl start usbmuxd
```

### 问题 2: No devices found

**原因**:
- 设备未连接
- 设备未信任电脑
- USB 线缆故障

**解决方案:**
1. 重新插拔 USB
2. 在 iOS 设备上点击"信任"
3. 更换 USB 端口或线缆

### 问题 3: Socket timeout

**原因**: 设备响应慢或网络问题

**解决方案:**
- 重新运行测试
- 检查 USB 连接质量

---

## 📂 项目文件结构

```
ts-mobiledevice/
├── packages/
│   ├── core/                      # ✅ Layer 1 完成
│   │   ├── src/usbmux/           # usbmux 协议实现
│   │   ├── tests/                # 真机测试
│   │   └── package.json
│   └── cli/                       # CLI 工具
├── docs/
│   ├── INSTALLATION-AND-TESTING.md
│   ├── PROGRESS-REPORT.md
│   └── superpowers/specs/
├── quick-start.bat                # Windows 快速启动
├── quick-start.sh                 # Linux/macOS 快速启动
├── README.md
└── package.json
```

---

## 🎯 测试后的下一步

### 如果 Layer 1 测试通过 ✅

**恭喜！Layer 1 工作正常！**

**下一步选择:**

**选项 A: 继续 Layer 2 (lockdown 协议)**
```
实现内容:
- PairRecordsManager (配对记录管理)
- CertificateGenerator (证书生成)
- LockdownClient (lockdown 客户端)
- ServiceConnection (服务连接)
```

**选项 B: 增强 Layer 1**
```
改进方向:
- Binary 协议支持（旧版设备）
- 设备监听模式（热插拔）
- 更详细的错误信息
- 性能优化
```

**选项 C: 完善文档和测试**
```
改进方向:
- 添加更多测试用例
- 创建 API 文档
- 添加使用示例
```

### 如果 Layer 1 测试失败 ❌

**排查步骤:**

1. **检查环境**
   - Node.js 版本
   - npm 版本
   - iTunes/usbmuxd 状态

2. **检查设备**
   - USB 连接
   - 信任状态
   - 设备锁屏状态

3. **查看日志**
   ```bash
   # 详细日志
   npm run test:layer1 -- --verbose
   ```

4. **提交 Issue**
   - GitHub Issues: https://github.com/YPYT1/Tsmobiledevice3/issues
   - 附上错误日志、设备信息、操作系统版本

---

## 📞 获取帮助

1. **查看文档**
   - [安装指南](./docs/INSTALLATION-AND-TESTING.md)
   - [进度报告](./docs/PROGRESS-REPORT.md)
   - [设计文档](./docs/superpowers/specs/2026-06-11-ts-mobiledevice-design.md)

2. **提交问题**
   - GitHub Issues: https://github.com/YPYT1/Tsmobiledevice3/issues

3. **检查代码**
   - 源码: `packages/core/src/usbmux/`
   - 测试: `packages/core/tests/usbmux.test.ts`

---

## 🎉 总结

**已完成**:
- ✅ 完整的 Monorepo 项目结构
- ✅ Layer 1 (usbmux) 协议实现
- ✅ 真机测试套件
- ✅ CLI 工具基础功能
- ✅ 完整文档

**立即执行**:
```bash
cd D:/Project/ts-mobiledevice
quick-start.bat  # Windows
# 或
./quick-start.sh  # Linux/macOS
```

**测试通过后**: 选择下一步行动（Layer 2 或其他改进）

**准备好了吗？开始测试！** 🚀
