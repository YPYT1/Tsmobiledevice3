/**
 * iTunes AMDS 完整诊断工具
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

class AMDSdiagnostics {
  static async runAllDiagnostics(): Promise<void> {
    console.log('========================================');
    console.log('  iTunes AMDS 完整诊断');
    console.log('========================================\n');

    // 1. 检查服务状态
    await this.checkServiceStatus();

    // 2. 检查端口监听
    await this.checkPortListening();

    // 3. 检查 iTunes 版本
    await this.checkITunesVersion();

    // 4. 检查进程信息
    await this.checkProcessInfo();

    // 5. 测试基础连接
    await this.testBasicConnection();

    // 6. 建议
    this.printRecommendations();
  }

  /**
   * 检查服务状态
   */
  private static async checkServiceStatus(): Promise<void> {
    console.log('📋 检查 Apple Mobile Device Service 状态...');

    try {
      const { stdout } = await execAsync('sc query "Apple Mobile Device Service"');
      const statusMatch = stdout.match(/STATE\s*:\s*\d+\s*(\w+)/);

      if (statusMatch) {
        const status = statusMatch[1];
        console.log(`   服务状态: ${status}`);

        if (status === 'RUNNING') {
          console.log('   ✅ 服务正在运行\n');
        } else {
          console.log('   ❌ 服务未运行\n');
          console.log('   建议: 启动服务');
          console.log('   命令: net start "Apple Mobile Device Service"\n');
        }
      }
    } catch (error) {
      console.log('   ❌ 无法查询服务状态\n');
    }
  }

  /**
   * 检查端口监听
   */
  private static async checkPortListening(): Promise<void> {
    console.log('🔌 检查端口 27015 监听状态...');

    try {
      const { stdout } = await execAsync('netstat -ano | findstr :27015 | findstr LISTENING');
      const lines = stdout.trim().split('\n');

      if (lines.length > 0 && lines[0].length > 0) {
        console.log('   ✅ 端口 27015 正在监听');

        const pidMatch = lines[0].match(/\s+(\d+)\s*$/);
        if (pidMatch) {
          console.log(`   进程ID: ${pidMatch[1]}\n`);
        }
      } else {
        console.log('   ❌ 端口 27015 未监听\n');
      }
    } catch (error) {
      console.log('   ❌ 无法检查端口状态\n');
    }
  }

  /**
   * 检查 iTunes 版本
   */
  private static async checkITunesVersion(): Promise<void> {
    console.log('📦 检查 iTunes 版本...');

    try {
      // 检查注册表
      const { stdout: reg64 } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Wow6432Node\\Apple Inc.\\iTunes" /v Version 2>nul'
      ).catch(() => ({ stdout: '' }));

      const { stdout: reg32 } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Apple Inc.\\iTunes" /v Version 2>nul'
      ).catch(() => ({ stdout: '' }));

      const versionMatch = (reg64 + reg32).match(/Version\s+REG_SZ\s+([\d.]+)/);

      if (versionMatch) {
        const version = versionMatch[1];
        console.log(`   iTunes 版本: ${version}\n`);

        // 检查是否为旧版本
        const parts = version.split('.');
        const majorVersion = parseInt(parts[0], 10);

        if (majorVersion < 12) {
          console.log('   ⚠️  检测到旧版本 iTunes (< 12.0)\n');
        } else {
          console.log('   ℹ️  iTunes 版本正常\n');
        }
      } else {
        console.log('   ❌ 无法从注册表读取 iTunes 版本\n');
      }
    } catch (error) {
      console.log('   ⚠️  无法检测 iTunes 版本\n');
    }
  }

  /**
   * 检查进程信息
   */
  private static async checkProcessInfo(): Promise<void> {
    console.log('🔍 检查 AppleMobileDeviceService.exe 进程...');

    try {
      const { stdout } = await execAsync('tasklist /fi "imagename eq AppleMobileDeviceService.exe" /v');

      if (stdout.includes('AppleMobileDeviceService.exe')) {
        console.log('   ✅ 进程正在运行');

        // 提取 PID 和内存使用
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('AppleMobileDeviceService.exe')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              console.log(`   进程ID: ${parts[1]}`);
              if (parts.length >= 5) {
                console.log(`   内存使用: ${parts[4]} KB\n`);
              }
            }
            break;
          }
        }
      } else {
        console.log('   ❌ 进程未运行\n');
      }
    } catch (error) {
      console.log('   ❌ 无法检查进程信息\n');
    }
  }

  /**
   * 测试基础连接
   */
  private static async testBasicConnection(): Promise<void> {
    console.log('🔗 测试基础 TCP 连接...');

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        console.log('   ❌ 连接超时\n');
        resolve();
      }, 3000);

      socket.connect(27015, '127.0.0.1', () => {
        clearTimeout(timeout);
        console.log('   ✅ TCP 连接成功\n');
        socket.destroy();
        resolve();
      });

      socket.once('error', (error) => {
        clearTimeout(timeout);
        console.log(`   ❌ 连接失败: ${error.message}\n`);
        resolve();
      });
    });
  }

  /**
   * 打印建议
   */
  private static printRecommendations(): void {
    console.log('========================================');
    console.log('  诊断建议');
    console.log('========================================\n');

    console.log('根据诊断结果，建议采取以下措施:\n');

    console.log('方案 1: 重启 AMDS 服务');
    console.log('  net stop "Apple Mobile Device Service"');
    console.log('  net start "Apple Mobile Device Service"\n');

    console.log('方案 2: 升级 iTunes');
    console.log('  1. 卸载当前 iTunes');
    console.log('  2. 下载最新 iTunes: https://www.apple.com/itunes/download/');
    console.log('  3. 安装并重启电脑\n');

    console.log('方案 3: 重新信任设备');
    console.log('  1. 在 iOS 设备上: 设置 > 通用 > 重置 > 重置位置与隐私');
    console.log('  2. 重新连接设备');
    console.log('  3. 点击"信任"并输入密码\n');

    console.log('方案 4: 使用第三方 usbmuxd');
    console.log('  1. 下载 libimobiledevice: https://github.com/libimobiledevice-win32/imobiledevice-net');
    console.log('  2. 停止 iTunes AMDS: net stop "Apple Mobile Device Service"');
    console.log('  3. 启动 usbmuxd.exe\n');

    console.log('========================================\n');
  }
}

// 运行诊断
AMDSdiagnostics.runAllDiagnostics();