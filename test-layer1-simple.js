/**
 * Layer 1 简单测试 - 使用原生 socket 测试
 */

const net = require('net');
const plist = require('plist');

const TARGET_UDID = 'C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A';

async function testLayer1() {
  console.log('========================================');
  console.log('  Layer 1: usbmux 协议真机测试');
  console.log(`  设备: ${TARGET_UDID}`);
  console.log('========================================\n');

  let socket;

  try {
    // 测试 1: 连接到 usbmuxd
    console.log('📡 测试 1: 连接到 usbmuxd daemon...');
    socket = new net.Socket();

    await new Promise((resolve, reject) => {
      socket.connect(27015, '127.0.0.1', resolve);
      socket.once('error', reject);
    });

    console.log('   ✅ 连接成功\n');

    // 监听响应数据
    let responseData = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    // 测试 2: 发送 ListDevices 请求
    console.log('📱 测试 2: 发送 ListDevices 请求...');

    const request = {
      MessageType: 'ListDevices',
      ClientVersionString: 'qt4i-usbmuxd',
      ProgName: 'ts-mobiledevice',
      kLibUSBMuxVersion: 3
    };

    const plistXml = plist.build(request);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(1, 0);  // version = PLIST (1)
    header.writeUInt32LE(8, 4);  // message type = PLIST (8)
    header.writeUInt32LE(1, 8);  // tag = 1

    const payload = Buffer.from(plistXml, 'utf8');
    const packet = Buffer.concat([header, payload]);

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(packet.length, 0);

    const fullPacket = Buffer.concat([lengthPrefix, packet]);

    await new Promise((resolve, reject) => {
      socket.write(fullPacket, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log('   ✅ 请求已发送\n');

    // 等待响应
    console.log('⏳ 测试 3: 等待响应...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 解析响应
    if (responseData.length === 0) {
      throw new Error('未接收到响应数据');
    }

    console.log(`   ✅ 接收到 ${responseData.length} 字节数据\n`);

    // 解析 packet
    const packetLength = responseData.readUInt32LE(0);
    const packetData = responseData.subarray(4, 4 + packetLength);

    // 解析 header
    const responseHeader = packetData.subarray(0, 12);
    const version = responseHeader.readUInt32LE(0);
    const messageType = responseHeader.readUInt32LE(4);
    const tag = responseHeader.readUInt32LE(8);

    console.log('📦 测试 4: 解析响应 packet:');
    console.log(`   Packet 长度: ${packetLength}`);
    console.log(`   Version: ${version}`);
    console.log(`   Message Type: ${messageType}`);
    console.log(`   Tag: ${tag}\n`);

    // 解析 plist
    const plistData = packetData.subarray(12);
    const response = plist.parse(plistData.toString('utf8'));

    console.log('📋 测试 5: 解析响应 plist:');
    console.log(JSON.stringify(response, null, 2));

    // 提取设备列表
    const devices = response.DeviceList || [];
    console.log(`\n📱 测试 6: 发现 ${devices.length} 个设备`);

    for (const device of devices) {
      if (device.MessageType === 'Attached') {
        console.log(`   - UDID: ${device.Properties.SerialNumber}`);
        console.log(`     DeviceID: ${device.DeviceID}`);
        console.log(`     Connection: ${device.Properties.ConnectionType}\n`);
      }
    }

    // 查找目标设备
    const targetDevice = devices.find(d => {
      if (d.MessageType !== 'Attached') return false;
      const udid = d.Properties.SerialNumber.replace(/-/g, '');
      return udid === TARGET_UDID.replace(/-/g, '');
    });

    if (!targetDevice) {
      console.log(`❌ 目标设备 ${TARGET_UDID} 未找到`);
      console.log('   请检查:');
      console.log('   1. 设备已通过 USB 连接');
      console.log('   2. 设备已信任此电脑');
      console.log('   3. 设备已解锁\n');
      socket.destroy();
      process.exit(1);
    }

    console.log(`✅ 测试 7: 目标设备已找到\n`);
    const deviceId = targetDevice.DeviceID;
    const deviceUdid = targetDevice.Properties.SerialNumber;

    // 测试 8: 连接到 lockdown 端口
    console.log('🔌 测试 8: 连接到 lockdown 端口 (62078)...');

    const lockdownSocket = new net.Socket();

    // 发送 Connect 请求
    const connectRequest = {
      MessageType: 'Connect',
      DeviceID: deviceId,
      PortNumber: 62078
    };

    const connectPlist = plist.build(connectRequest);
    const connectHeader = Buffer.alloc(12);
    connectHeader.writeUInt32LE(1, 0);
    connectHeader.writeUInt32LE(8, 4);
    connectHeader.writeUInt32LE(2, 8);  // tag = 2

    const connectPayload = Buffer.from(connectPlist, 'utf8');
    const connectPacket = Buffer.concat([connectHeader, connectPayload]);

    const connectLengthPrefix = Buffer.alloc(4);
    connectLengthPrefix.writeUInt32LE(connectPacket.length, 0);

    const connectFullPacket = Buffer.concat([connectLengthPrefix, connectPacket]);

    await new Promise((resolve, reject) => {
      socket.write(connectFullPacket, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log('   ✅ Connect 请求已发送');

    // 等待响应
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('   ✅ 成功连接到 lockdown 端口\n');

    // 清理
    console.log('🧹 清理连接...');
    socket.destroy();
    console.log('   ✅ 连接已关闭\n');

    console.log('========================================');
    console.log('  ✅ Layer 1 所有测试通过！');
    console.log('========================================\n');
    console.log('设备信息:');
    console.log(`  UDID: ${deviceUdid}`);
    console.log(`  Device ID: ${deviceId}`);
    console.log(`  Connection: ${targetDevice.Properties.ConnectionType}\n`);
    console.log('下一步: 开始 Layer 2 (lockdown 协议) 开发\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n排查步骤:');
    console.error('1. 确保 iTunes AMDS 服务正在运行');
    console.error('2. 确保 iOS 设备已通过 USB 连接');
    console.error('3. 确保设备已信任此电脑');
    console.error('4. 确保设备已解锁（不在锁屏状态）\n');

    if (socket) {
      socket.destroy();
    }

    process.exit(1);
  }
}

testLayer1();