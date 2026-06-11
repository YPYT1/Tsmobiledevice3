/**
 * Layer 1 调试测试 - usbmux 协议详细调试
 */

const net = require('net');

async function debugLayer1() {
  console.log('========================================');
  console.log('  Layer 1 调试模式 - 详细数据检查');
  console.log('========================================\n');

  try {
    // 直接连接到 iTunes AMDS
    console.log('1. 连接到 iTunes AMDS (127.0.0.1:27015)...');
    const socket = new net.Socket();

    await new Promise((resolve, reject) => {
      socket.connect(27015, '127.0.0.1', () => {
        console.log('   ✅ TCP连接成功\n');
        resolve();
      });
      socket.once('error', reject);
    });

    // 监听原始数据
    socket.on('data', (data) => {
      console.log('📥 接收到原始数据:');
      console.log('   长度:', data.length, '字节');
      console.log('   Hex:', data.toString('hex').substring(0, 100));
      console.log('   内容:', data.toString().substring(0, 200));
    });

    // 手动构建 plist 请求
    const plist = require('plist');

    const request = {
      MessageType: 'ListDevices',
      ClientVersionString: 'qt4i-usbmuxd',
      ProgName: 'ts-mobiledevice',
      kLibUSBMuxVersion: 3
    };

    const plistXml = plist.build(request);
    console.log('2. 构建请求 plist:');
    console.log(plistXml);

    // 构建 usbmux packet
    const header = Buffer.alloc(12);
    header.writeUInt32LE(1, 0);  // version = PLIST (1)
    header.writeUInt32LE(8, 4);  // message type = PLIST (8)
    header.writeUInt32LE(1, 8);  // tag = 1

    const payload = Buffer.from(plistXml, 'utf8');
    const packet = Buffer.concat([header, payload]);

    // 添加长度前缀
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(packet.length, 0);

    const fullPacket = Buffer.concat([lengthPrefix, packet]);

    console.log('\n3. 发送完整 packet:');
    console.log('   总长度:', fullPacket.length);
    console.log('   长度前缀:', lengthPrefix.readUInt32LE(0));
    console.log('   Header:', header.toString('hex'));
    console.log('   Payload 长度:', payload.length);

    socket.write(fullPacket);

    console.log('\n4. 等待响应...\n');

    // 等待数据
    await new Promise(resolve => setTimeout(resolve, 2000));

    socket.destroy();
    console.log('\n测试完成');

  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

debugLayer1();