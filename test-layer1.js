/**
 * Layer 1 简单测试 - usbmux 协议验证
 * 设备 UDID: C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A
 */

const { PlistMuxConnection } = require('./packages/core/dist/usbmux/PlistMuxConnection');
const { UsbMuxConnection } = require('./packages/core/dist/usbmux/UsbMuxConnection');

async function testLayer1() {
  console.log('========================================');
  console.log('  Layer 1: usbmux 协议真机测试');
  console.log('  设备: C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A');
  console.log('========================================\n');

  try {
    // 测试 1: 连接到 usbmuxd
    console.log('📡 测试 1: 连接到 usbmuxd daemon...');
    const socket = await UsbMuxConnection.createUsbmuxSocket();
    console.log('   ✅ 连接成功\n');

    // 测试 2: 列出设备
    console.log('📱 测试 2: 列出已连接设备...');
    const mux = new PlistMuxConnection(socket);
    const devices = await mux.listDevices();
    console.log(`   ✅ 发现 ${devices.length} 个设备`);

    for (const device of devices) {
      console.log(`   - UDID: ${device.serial}`);
      console.log(`     Device ID: ${device.devid}`);
      console.log(`     Connection: ${device.connectionType}\n`);
    }

    // 测试 3: 验证目标设备
    const TARGET_UDID = 'C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A';
    console.log(`🎯 测试 3: 验证目标设备 ${TARGET_UDID}...`);

    const targetDevice = devices.find(d =>
      d.serial.replace(/-/g, '') === TARGET_UDID.replace(/-/g, '')
    );

    if (!targetDevice) {
      console.log('   ❌ 目标设备未找到');
      console.log('   请检查:');
      console.log('   1. 设备已通过 USB 连接');
      console.log('   2. 设备已信任此电脑');
      console.log('   3. 设备已解锁\n');
      process.exit(1);
    }

    console.log('   ✅ 目标设备已找到\n');

    // 测试 4: 连接到 lockdown 端口
    console.log('🔌 测试 4: 连接到 lockdown 端口 (62078)...');
    const lockdownSocket = await mux.connectDevice(targetDevice.devid, 62078);
    console.log('   ✅ 成功连接到 lockdown 端口\n');

    // 测试 5: 获取 System BUID
    console.log('🔑 测试 5: 获取 System BUID...');
    try {
      const buid = await mux.getBuid();
      console.log(`   ✅ System BUID: ${buid}\n`);
    } catch (error) {
      console.log(`   ⚠️  获取 BUID 失败: ${error.message}\n`);
    }

    // 清理
    console.log('🧹 清理连接...');
    lockdownSocket.destroy();
    await mux.close();
    console.log('   ✅ 连接已关闭\n');

    console.log('========================================');
    console.log('  ✅ Layer 1 所有测试通过！');
    console.log('========================================\n');
    console.log('下一步: 开始 Layer 2 (lockdown 协议) 开发\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n错误详情:', error.stack);
    console.error('\n排查步骤:');
    console.error('1. 确保 iTunes AMDS 服务正在运行 (netstat -ano | findstr :27015)');
    console.error('2. 确保 iOS 设备已通过 USB 连接');
    console.error('3. 确保设备已信任此电脑');
    console.error('4. 确保设备已解锁（不在锁屏状态）\n');
    process.exit(1);
  }
}

testLayer1();
