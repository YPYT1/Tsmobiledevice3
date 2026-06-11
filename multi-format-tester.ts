/**
 * 多格式 Plist 测试器 - 尝试所有可能的格式变体
 */

import net from 'net';
import { AdvancedPlistGenerator, PlistFormat } from './packages/core/src/usbmux/AdvancedPlistGenerator';

interface TestResult {
  format: PlistFormat;
  includeClientFields: boolean;
  success: boolean;
  errorCode?: number;
  errorMessage?: string;
  deviceCount?: number;
  responseData?: any;
}

class MultiFormatPlistTester {
  /**
   * 测试所有格式组合
   */
  static async testAllFormats(): Promise<TestResult[]> {
    console.log('========================================');
    console.log('  多格式 Plist 协议测试');
    console.log('========================================\n');

    const results: TestResult[] = [];

    // 所有格式
    const formats = [
      PlistFormat.MINIMAL,
      PlistFormat.STANDARD,
      PlistFormat.PYTHON_STYLE,
      PlistFormat.APPLE_NATIVE,
      PlistFormat.NO_DOCTYPE,
      PlistFormat.COMPACT,
    ];

    // 是否包含客户端字段
    const clientFieldOptions = [false, true];

    console.log(`📋 将测试 ${formats.length} 种格式 × 2 种字段组合 = ${formats.length * 2} 种方案\n`);

    let testNumber = 0;

    for (const format of formats) {
      for (const includeClientFields of clientFieldOptions) {
        testNumber++;
        console.log(`\n测试 ${testNumber}/${formats.length * 2}: ${format} + ${includeClientFields ? '标准字段' : '最简字段'}`);

        const result = await this.testFormat(format, includeClientFields);
        results.push(result);

        if (result.success) {
          console.log('   ✅ 成功！');
          console.log(`   发现 ${result.deviceCount} 个设备`);
          break; // 找到成功的格式就停止
        } else {
          console.log(`   ❌ 失败: ${result.errorMessage}`);
        }

        // 短暂延迟，避免连接过快
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * 测试单个格式
   */
  private static async testFormat(format: PlistFormat, includeClientFields: boolean): Promise<TestResult> {
    let socket: net.Socket | null = null;

    try {
      // 连接
      socket = new net.Socket();
      await new Promise<void>((resolve, reject) => {
        socket!.connect(27015, '127.0.0.1', resolve);
        socket!.once('error', reject);
      });

      // 收集响应
      let responseData = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);
      });

      // 构建请求
      let request: Record<string, any> = {
        MessageType: 'ListDevices',
      };

      if (includeClientFields) {
        request = AdvancedPlistGenerator.addClientFields(request, true);
      }

      // 使用高级生成器生成 plist
      const plistXml = AdvancedPlistGenerator.generate(request, format);

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

      // 发送
      socket.write(fullPacket);

      // 等待响应
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (responseData.length === 0) {
        return {
          format,
          includeClientFields,
          success: false,
          errorMessage: '未接收到响应',
        };
      }

      // 解析响应
      const packetLength = responseData.readUInt32LE(0);
      const packetData = responseData.subarray(4, 4 + packetLength);
      const plistData = packetData.subarray(12);
      const plistString = plistData.toString('utf8');

      // 简单解析（不使用 plist 库）
      const response = this.parseSimplePlist(plistString);

      if (response.MessageType === 'Result') {
        const errorCode = response.Number;

        if (errorCode === 0) {
          // 成功
          const deviceList = response.DeviceList || [];
          const deviceCount = deviceList.filter((d: any) => d.MessageType === 'Attached').length;

          return {
            format,
            includeClientFields,
            success: true,
            errorCode: 0,
            deviceCount,
            responseData: response,
          };
        } else {
          return {
            format,
            includeClientFields,
            success: false,
            errorCode,
            errorMessage: `错误码 ${errorCode}`,
          };
        }
      }

      return {
        format,
        includeClientFields,
        success: false,
        errorMessage: '未知响应格式',
      };

    } catch (error: any) {
      return {
        format,
        includeClientFields,
        success: false,
        errorMessage: error.message,
      };
    } finally {
      if (socket) {
        socket.destroy();
      }
    }
  }

  /**
   * 简单的 plist 解析（避免依赖）
   */
  private static parseSimplePlist(xml: string): any {
    const result: any = {};

    // 提取 MessageType
    const messageTypeMatch = xml.match(/<key>MessageType<\/key>\s*<string>([^<]+)<\/string>/);
    if (messageTypeMatch) {
      result.MessageType = messageTypeMatch[1];
    }

    // 提取 Number
    const numberMatch = xml.match(/<key>Number<\/key>\s*<integer>(\d+)<\/integer>/);
    if (numberMatch) {
      result.Number = parseInt(numberMatch[1], 10);
    }

    // 提取 DeviceList（简化处理）
    if (xml.includes('<key>DeviceList</key>')) {
      result.DeviceList = [];
      // 简单统计 Attached 数量
      const attachedMatches = xml.match(/<key>MessageType<\/key>\s*<string>Attached<\/string>/g);
      if (attachedMatches) {
        for (let i = 0; i < attachedMatches.length; i++) {
          result.DeviceList.push({ MessageType: 'Attached' });
        }
      }
    }

    return result;
  }

  /**
   * 打印测试报告
   */
  static printReport(results: TestResult[]): void {
    console.log('\n========================================');
    console.log('  测试报告');
    console.log('========================================\n');

    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (successResults.length > 0) {
      console.log('✅ 成功的格式:\n');
      for (const result of successResults) {
        console.log(`  格式: ${result.format}`);
        console.log(`  字段: ${result.includeClientFields ? '标准' : '最简'}`);
        console.log(`  设备数: ${result.deviceCount}`);
        console.log('');
      }
    } else {
      console.log('❌ 所有格式都失败了\n');
      console.log('失败详情:');
      for (const result of failedResults) {
        console.log(`  ${result.format} + ${result.includeClientFields ? '标准' : '最简'}: ${result.errorMessage}`);
      }
    }

    console.log('\n========================================');
    console.log(`  总计: ${results.length} 次测试`);
    console.log(`  成功: ${successResults.length} 次`);
    console.log(`  失败: ${failedResults.length} 次`);
    console.log('========================================\n');
  }
}

// 运行测试
async function main() {
  try {
    const results = await MultiFormatPlistTester.testAllFormats();
    MultiFormatPlistTester.printReport(results);

    const successResults = results.filter(r => r.success);

    if (successResults.length > 0) {
      console.log('🎉 找到可用的协议格式！\n');
      console.log('建议在代码中使用以下配置:');
      console.log(`  格式: ${successResults[0].format}`);
      console.log(`  客户端字段: ${successResults[0].includeClientFields ? '是' : '否'}\n`);

      process.exit(0);
    } else {
      console.log('⚠️  所有格式都失败，建议升级 iTunes 或使用第三方 usbmuxd\n');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();