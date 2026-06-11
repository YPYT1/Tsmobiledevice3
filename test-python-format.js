/**
 * 使用 Python 精确格式的最终测试
 */

const net = require('net');
const { PythonPlistFormatter } = require('./packages/core/src/usbmux/PythonPlistFormatter.ts');

const TARGET_UDID = 'C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A';

async function testWithPythonFormat() {
  console.log('========================================');
  console.log('  Python 精确格式测试');
  console.log('========================================\n');

  let socket;

  try {
    // 连接
    console.log('📡 连接到 iTunes AMDS...');
    socket = new net.Socket();
    await new Promise((resolve, reject) => {
      socket.connect(27015, '127.0.0.1', resolve);
      socket.once('error', reject);
    });
    console.log('   ✅ 已连接\n');

    // 收集响应
    let responseData = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    // 使用 Python 精确格式的 ListDevices 请求
    console.log('📱 发送 ListDevices 请求（Python 格式）...');
    const plistXml = PythonPlistFormatter.formatListDevicesRequest();

    console.log('   Plist 内容:');
    console.log('   ' + plistXml.split('\n').slice(0, 10).join('\n   ') + '\n   ...\n');

    // 构建 packet
    const header = Buffer.alloc(12);
    header.writeUInt32LE(1, 0);  // version = PLIST (1)
    header.writeUInt32LE(8, 4);  // message type = PLIST (8)
    header.writeUInt32LE(1, 8);  // tag = 1

    const payload = Buffer.from(plistXml, 'utf8');
    const packet = Buffer.concat([header, payload]);

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(packet.length, 0);

    const fullPacket = Buffer.concat([lengthPrefix, packet]);

    console.log(`   Packet 大小: ${fullPacket.length} 字节`);
    console.log(`   Plist 长度: ${payload.length} 字节\n`);

    socket.write(fullPacket);
    console.log('   ✅ 请求已发送\n');

    // 等待响应
    console.log('⏳ 等待响应...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (responseData.length === 0) {
      throw new Error('未接收到响应');
    }

    console.log(`   ✅ 接收到 ${responseData.length} 字节数据\n`);

    // 解析响应
    const packetLength = responseData.readUInt32LE(0);
    const packetData = responseData.subarray(4, 4 + packetLength);

    const version = packetData.readUInt32LE(4);
    const messageType = packetData.readUInt32LE(8);
    const tag = packetData.readUInt32LE(12);

    console.log('📦 解析响应:');
    console.log(`   Version: ${version}`);
    console.log(`   Message Type: ${messageType}`);
    console.log(`   Tag: ${tag}\n`);

    // 解析 plist
    const plistData = packetData.subarray(16);
    const plistString = plistData.toString('utf8');

    // 简单解析
    const messageTypeMatch = plistString.match(/<key>MessageType<\/key>\s*<string>([^<]+)<\/string>/);
    const numberMatch = plistString.match(/<key>Number<\/key>\s*<integer>(\d+)<\/integer>/);

    if (messageTypeMatch) {
      const responseMessageType = messageTypeMatch[1];
      console.log(`   Response Message Type: ${responseMessageType}`);

      if (responseMessageType === 'Result') {
        if (numberMatch) {
          const errorCode = parseInt(numberMatch[1], 10);
          console.log(`   Error Code: ${errorCode}\n`);

          if (errorCode === 0) {
            console.log('✅ 成功！错误码为 0\n');
          } else {
            console.log(`❌ 失败！错误码 ${errorCode}\n`);
          }
        }
      } else if (responseMessageType === 'Attached') {
        // 设备列表
        console.log('✅ 接收到设备列表！\n');

        // 提取设备信息
        const serialMatch = plistString.match(/<key>SerialNumber<\/key>\s*<string>([^<]+)<\/string>/);
        if (serialMatch) {
          const udid = serialMatch[1];
          console.log(`   设备 UDID: ${udid}`);
        }
      }
    }

    socket.destroy();

    console.log('========================================');
    console.log('  测试完成');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (socket) socket.destroy();
    process.exit(1);
  }
}

testWithPythonFormat();