/**
 * Layer 1 Binary Protocol 测试
 * 尝试使用旧版 Binary 协议而不是 Plist
 */

const net = require('net');

const TARGET_UDID = 'C82D7B8489017C3C5CCAB14CE5BD8E4FC3BED99A';

async function binaryProtocolTest() {
  console.log('========================================');
  console.log('  Layer 1: Binary Protocol 测试');
  console.log('========================================\n');

  let socket;

  try {
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

    // 发送 Binary Listen 命令
    console.log('📱 发送 Listen 命令 (Binary Protocol)...');

    // Binary Protocol header
    const header = Buffer.alloc(8);
    header.writeUInt32LE(0, 0);  // version = BINARY (0)
    header.writeUInt32LE(3, 4);  // message type = LISTEN (3)

    const tag = Buffer.alloc(4);
    tag.writeUInt32LE(1, 0);

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(12, 0);  // total length

    const packet = Buffer.concat([lengthPrefix, header, tag]);

    socket.write(packet);
    console.log('   ✅ Listen 命令已发送\n');

    console.log('⏳ 等待响应...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (responseData.length === 0) {
      throw new Error('未接收到响应');
    }

    console.log(`   ✅ 接收到 ${responseData.length} 字节\n`);

    // 解析 Binary 响应
    const length = responseData.readUInt32LE(0);
    const version = responseData.readUInt32LE(4);
    const messageType = responseData.readUInt32LE(8);
    const responseTag = responseData.readUInt32LE(12);

    console.log('响应信息:');
    console.log(`  Length: ${length}`);
    console.log(`  Version: ${version}`);
    console.log(`  Message Type: ${messageType}`);
    console.log(`  Tag: ${responseTag}\n`);

    if (messageType === 1) {  // RESULT
      if (responseData.length >= 20) {
        const result = responseData.readUInt32LE(16);
        console.log(`  Result: ${result}`);

        if (result === 0) {
          console.log('\n✅ Listen 命令成功！\n');
          console.log('现在监听设备事件...');
          console.log('(等待 3 秒查看是否有设备连接事件)\n');

          // 清空缓冲区，继续监听
          responseData = Buffer.alloc(0);
          await new Promise(resolve => setTimeout(resolve, 3000));

          if (responseData.length > 0) {
            console.log(`接收到 ${responseData.length} 字节额外数据`);
            console.log('Hex:', responseData.toString('hex').substring(0, 200));
          }
        }
      }
    }

    socket.destroy();

    console.log('\n========================================');
    console.log('  Binary Protocol 测试完成');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (socket) socket.destroy();
    process.exit(1);
  }
}

binaryProtocolTest();