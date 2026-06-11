/**
 * 智能协议检测器 - 自动适配不同版本的 iTunes AMDS
 */

const net = require('net');
const plist = require('plist');

class ProtocolDetector {
  /**
   * 检测支持的协议版本
   */
  static async detectProtocol() {
    console.log('🔍 开始协议版本检测...\n');

    // 测试 1: 最简 Plist 协议（仅 MessageType）
    console.log('📋 测试 1: 最简 Plist 协议...');
    let result = await this.tryPlistMinimal();
    if (result.success) {
      console.log('   ✅ 支持最简 Plist 协议\n');
      return { version: 'plist-minimal', protocol: 'plist' };
    }
    console.log(`   ❌ 失败: ${result.error}\n`);

    // 测试 2: 标准 Plist 协议（包含所有字段）
    console.log('📋 测试 2: 标准 Plist 协议...');
    result = await this.tryPlistStandard();
    if (result.success) {
      console.log('   ✅ 支持标准 Plist 协议\n');
      return { version: 'plist-standard', protocol: 'plist' };
    }
    console.log(`   ❌ 失败: ${result.error}\n`);

    // 测试 3: Binary 协议
    console.log('📋 测试 3: Binary 协议...');
    result = await this.tryBinary();
    if (result.success) {
      console.log('   ✅ 支持 Binary 协议\n');
      return { version: 'binary', protocol: 'binary' };
    }
    console.log(`   ❌ 失败: ${result.error}\n`);

    throw new Error('无法检测支持的协议版本');
  }

  /**
   * 尝试最简 Plist 协议
   */
  static async tryPlistMinimal() {
    return await this.testPlistProtocol({
      MessageType: 'ListDevices'
    });
  }

  /**
   * 尝试标准 Plist 协议
   */
  static async tryPlistStandard() {
    return await this.testPlistProtocol({
      MessageType: 'ListDevices',
      ClientVersionString: 'qt4i-usbmuxd',
      ProgName: 'ts-mobiledevice',
      kLibUSBMuxVersion: 3
    });
  }

  /**
   * 测试 Plist 协议
   */
  static async testPlistProtocol(request) {
    let socket;

    try {
      socket = new net.Socket();
      await new Promise((resolve, reject) => {
        socket.connect(27015, '127.0.0.1', resolve);
        socket.once('error', reject);
      });

      let responseData = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      // 构建请求
      const plistXml = plist.build(request);
      const header = Buffer.alloc(12);
      header.writeUInt32LE(1, 0);  // version = PLIST
      header.writeUInt32LE(8, 4);  // message type = PLIST
      header.writeUInt32LE(1, 8);  // tag

      const payload = Buffer.from(plistXml, 'utf8');
      const packet = Buffer.concat([header, payload]);

      const lengthPrefix = Buffer.alloc(4);
      lengthPrefix.writeUInt32LE(packet.length, 0);

      const fullPacket = Buffer.concat([lengthPrefix, packet]);
      socket.write(fullPacket);

      // 等待响应
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (responseData.length === 0) {
        return { success: false, error: '未接收到响应' };
      }

      // 解析响应
      const packetLength = responseData.readUInt32LE(0);
      const packetData = responseData.subarray(4, 4 + packetLength);
      const plistData = packetData.subarray(12);
      const response = plist.parse(plistData.toString('utf8'));

      if (response.MessageType === 'Result') {
        if (response.Number === 0) {
          // 成功！检查是否有设备列表
          if (response.DeviceList && response.DeviceList.length > 0) {
            return { success: true, devices: response.DeviceList };
          }
          return { success: true, message: '成功但无设备' };
        } else {
          return { success: false, error: `错误码 ${response.Number}` };
        }
      }

      return { success: false, error: '未知响应格式' };

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (socket) {
        socket.destroy();
      }
    }
  }

  /**
   * 尝试 Binary 协议
   */
  static async tryBinary() {
    let socket;

    try {
      socket = new net.Socket();
      await new Promise((resolve, reject) => {
        socket.connect(27015, '127.0.0.1', resolve);
        socket.once('error', reject);
      });

      let responseData = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      // Binary 协议 Listen 命令
      const header = Buffer.alloc(12);
      header.writeUInt32LE(0, 0);  // version = BINARY
      header.writeUInt32LE(3, 4);  // message type = LISTEN
      header.writeUInt32LE(1, 8);  // tag

      const lengthPrefix = Buffer.alloc(4);
      lengthPrefix.writeUInt32LE(12, 0);

      const packet = Buffer.concat([lengthPrefix, header]);
      socket.write(packet);

      // 等待响应
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (responseData.length === 0) {
        return { success: false, error: '未接收到响应' };
      }

      // 解析 Binary 响应
      const length = responseData.readUInt32LE(0);
      const version = responseData.readUInt32LE(4);
      const messageType = responseData.readUInt32LE(8);

      if (messageType === 1) {  // RESULT
        const result = responseData.readUInt32LE(12);
        return { success: result === 0, result };
      }

      return { success: false, error: '未知响应' };

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (socket) {
        socket.destroy();
      }
    }
  }

  /**
   * 获取设备列表（使用检测到的最佳协议）
   */
  static async getDevices(protocolVersion) {
    if (protocolVersion.protocol === 'plist') {
      const request = protocolVersion.version === 'plist-minimal'
        ? { MessageType: 'ListDevices' }
        : {
            MessageType: 'ListDevices',
            ClientVersionString: 'qt4i-usbmuxd',
            ProgName: 'ts-mobiledevice',
            kLibUSBMuxVersion: 3
          };

      const result = await this.testPlistProtocol(request);

      if (result.success && result.devices) {
        return result.devices;
      }
    }

    return [];
  }
}

// 运行检测
async function main() {
  try {
    console.log('========================================');
    console.log('  iTunes AMDS 协议版本检测');
    console.log('========================================\n');

    const protocol = await ProtocolDetector.detectProtocol();

    console.log('========================================');
    console.log('  检测结果');
    console.log('========================================');
    console.log(`协议版本: ${protocol.version}`);
    console.log(`协议类型: ${protocol.protocol}\n`);

    // 尝试获取设备列表
    console.log('📱 尝试获取设备列表...');
    const devices = await ProtocolDetector.getDevices(protocol);

    if (devices.length > 0) {
      console.log(`   ✅ 发现 ${devices.length} 个设备\n`);
      for (const device of devices) {
        if (device.MessageType === 'Attached') {
          console.log(`   设备:`);
          console.log(`   - UDID: ${device.Properties.SerialNumber}`);
          console.log(`   - DeviceID: ${device.DeviceID}`);
          console.log(`   - Connection: ${device.Properties.ConnectionType}\n`);
        }
      }
    } else {
      console.log('   ⚠️  未发现设备\n');
    }

  } catch (error) {
    console.error('❌ 检测失败:', error.message);
    process.exit(1);
  }
}

main();