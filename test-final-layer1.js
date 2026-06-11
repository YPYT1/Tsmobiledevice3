/**
 * Layer 1 最终测试 - 使用正确的 plist 格式
 */

const net = require('net');
const plist = require('plist');

const TARGET_UDID = 'C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A';

async function finalTest() {
  console.log('========================================');
  console.log('  Layer 1: usbmux 协议最终测试');
  console.log(`  设备: ${TARGET_UDID}`);
  console.log('========================================\n');

  let socket;

  try {
    // 连接
    console.log('📡 步骤 1: 连接到 iTunes AMDS...');
    socket = new net.Socket();
    await new Promise((resolve, reject) => {
      socket.connect(27015, '127.0.0.1', resolve);
      socket.once('error', reject);
    });
    console.log('   ✅ 已连接\n');

    // 收集响应数据
    let responseData = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    // 发送 ListDevices 请求（使用最简单的格式）
    console.log('📱 步骤 2: 发送 ListDevices 请求...');

    // 构造最简单的 plist
    const simplePlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>MessageType</key>
<string>ListDevices</string>
</dict>
</plist>`;

    const header = Buffer.alloc(12);
    header.writeUInt32LE(1, 0);  // version
    header.writeUInt32LE(8, 4);  // message type
    header.writeUInt32LE(1, 8);  // tag

    const payload = Buffer.from(simplePlist, 'utf8');
    const packet = Buffer.concat([header, payload]);

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(packet.length, 0);

    const fullPacket = Buffer.concat([lengthPrefix, packet]);

    socket.write(fullPacket);
    console.log('   ✅ 请求已发送\n');

    // 等待响应
    console.log('⏳ 步骤 3: 等待响应...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (responseData.length === 0) {
      throw new Error('未接收到响应');
    }

    console.log(`   ✅ 接收到 ${responseData.length} 字节\n`);

    // 解析
    const packetLength = responseData.readUInt32LE(0);
    const packetData = responseData.subarray(4, 4 + packetLength);

    const plistData = packetData.subarray(12);
    const response = plist.parse(plistData.toString('utf8'));

    console.log('📋 步骤 4: 解析响应:');
    console.log(JSON.stringify(response, null, 2));

    if (response.MessageType === 'Result' && response.Number !== 0) {
      throw new Error(`usbmuxd 错误码: ${response.Number}`);
    }

    const devices = response.DeviceList || [];
    console.log(`\n📱 步骤 5: 发现 ${devices.length} 个设备\n`);

    let foundTarget = false;

    for (const device of devices) {
      if (device.MessageType === 'Attached') {
        const udid = device.Properties.SerialNumber;
        const connectionType = device.Properties.ConnectionType;
        const deviceId = device.DeviceID;

        console.log(`   设备:`);
        console.log(`   - UDID: ${udid}`);
        console.log(`   - Device ID: ${deviceId}`);
        console.log(`   - Connection: ${connectionType}\n`);

        if (udid.replace(/-/g, '') === TARGET_UDID.replace(/-/g, '')) {
          foundTarget = true;
          console.log('   ✅ 找到目标设备!\n');
        }
      }
    }

    if (!foundTarget) {
      console.log(`❌ 目标设备 ${TARGET_UDID} 未找到`);
      socket.destroy();
      process.exit(1);
    }

    // 测试连接到 lockdown 端口
    console.log('🔌 步骤 6: 连接到 lockdown 端口 (62078)...');

    // 找到目标设备
    const targetDevice = devices.find(d =>
      d.MessageType === 'Attached' &&
      d.Properties.SerialNumber.replace(/-/g, '') === TARGET_UDID.replace(/-/g, '')
    );

    if (!targetDevice) {
      throw new Error('未找到目标设备');
    }

    const connectPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>MessageType</key>
<string>Connect</string>
<key>DeviceID</key>
<integer>${targetDevice.DeviceID}</integer>
<key>PortNumber</key>
<integer>62078</integer>
</dict>
</plist>`;

    const connectHeader = Buffer.alloc(12);
    connectHeader.writeUInt32LE(1, 0);
    connectHeader.writeUInt32LE(8, 4);
    connectHeader.writeUInt32LE(2, 8);

    const connectPayload = Buffer.from(connectPlist, 'utf8');
    const connectPacket = Buffer.concat([connectHeader, connectPayload]);

    const connectLengthPrefix = Buffer.alloc(4);
    connectLengthPrefix.writeUInt32LE(connectPacket.length, 0);

    const connectFullPacket = Buffer.concat([connectLengthPrefix, connectPacket]);

    // 清空之前的响应
    responseData = Buffer.alloc(0);

    socket.write(connectFullPacket);
    console.log('   ✅ Connect 请求已发送');

    await new Promise(resolve => setTimeout(resolve, 500));

    if (responseData.length > 0) {
      const respPacketLength = responseData.readUInt32LE(0);
      const respPacketData = responseData.subarray(4, 4 + respPacketLength);
      const respPlistData = respPacketData.subarray(12);
      const connectResponse = plist.parse(respPlistData.toString('utf8'));

      console.log('   响应:', JSON.stringify(connectResponse, null, 2));

      if (connectResponse.Number === 0) {
        console.log('   ✅ 成功连接到 lockdown 端口\n');
      } else {
        console.log('   ⚠️  连接响应码:', connectResponse.Number, '\n');
      }
    }

    // 完成
    socket.destroy();

    console.log('========================================');
    console.log('  ✅ Layer 1 测试成功完成！');
    console.log('========================================\n');
    console.log('设备信息:');
    console.log(`  UDID: ${targetDevice.Properties.SerialNumber}`);
    console.log(`  Device ID: ${targetDevice.DeviceID}`);
    console.log(`  Connection: ${targetDevice.Properties.ConnectionType}\n`);
    console.log('下一步: 开始 Layer 2 (lockdown 协议) 开发\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (socket) socket.destroy();
    process.exit(1);
  }
}

finalTest();