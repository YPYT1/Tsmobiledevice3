/**
 * 正确的连接测试 - 确保连接正确关闭
 */

const net = require('net');

async function cleanTest() {
  console.log('=== Clean Connection Test ===\n');

  // 创建连接
  const socket = new net.Socket();

  // 设置超时和错误处理
  socket.setTimeout(3000);

  try {
    console.log('1. Connecting...');
    await new Promise((resolve, reject) => {
      socket.connect(27015, '127.0.0.1', () => {
        console.log('   Connected!\n');
        resolve();
      });
      socket.once('error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
    });

    // 收集响应
    let responseData = Buffer.alloc(0);
    const dataPromise = new Promise((resolve) => {
      socket.once('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
        resolve();
      });
    });

    // 发送请求
    console.log('2. Sending request...');
    const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>ClientVersionString</key>
\t<string>qt4i-usbmuxd</string>
\t<key>MessageType</key>
\t<string>ListDevices</string>
\t<key>ProgName</key>
\t<string>pymobiledevice3</string>
\t<key>kLibUSBMuxVersion</key>
\t<integer>3</integer>
</dict>
</plist>`;

    const header = Buffer.alloc(12);
    header.writeUInt32LE(1, 0);
    header.writeUInt32LE(8, 4);
    header.writeUInt32LE(1, 8);

    const payload = Buffer.from(plistXml, 'utf8');
    const packet = Buffer.concat([header, payload]);

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(packet.length, 0);

    const fullPacket = Buffer.concat([lengthPrefix, packet]);

    socket.write(fullPacket);
    console.log('   Sent!\n');

    // 等待响应
    console.log('3. Waiting for response...');
    await Promise.race([
      dataPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Response timeout')), 2000)
      )
    ]);

    if (responseData.length > 0) {
      console.log(`   Received ${responseData.length} bytes\n`);

      // 解析
      const packetLength = responseData.readUInt32LE(0);
      const plistData = responseData.slice(16, 4 + packetLength);

      // 简单解析
      const plistString = plistData.toString('utf8');
      const numberMatch = plistString.match(/<key>Number<\/key>\s*<integer>(\d+)<\/integer>/);

      if (numberMatch) {
        const errorCode = parseInt(numberMatch[1], 10);
        console.log('4. Response parsed:');
        console.log(`   Error code: ${errorCode}\n`);

        if (errorCode === 0) {
          console.log('=== SUCCESS! Error code is 0 ===\n');
        } else {
          console.log(`=== FAILED! Error code: ${errorCode} ===\n`);

          // 分析原因
          console.log('Possible causes:');
          if (errorCode === 5) {
            console.log('  1. Too many connections to AMDS (need to clean up)');
            console.log('  2. Device not properly trusted');
            console.log('  3. AMDS internal state corrupted');
          }
        }
      }
    } else {
      console.log('   No response received\n');
    }

  } catch (error) {
    console.error('ERROR:', error.message, '\n');
  } finally {
    // 关闭连接
    console.log('5. Cleaning up...');
    socket.destroy();
    console.log('   Socket destroyed\n');
  }

  console.log('=== Test Complete ===\n');
}

cleanTest().catch(console.error);