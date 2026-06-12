'use strict';
const fs = require('fs');
const { LockdownService } = require('./packages/core/dist/lockdown/LockdownService');
const { DvtFactory } = require('./packages/core/dist/dtx/DvtFactory');
const { UsbMuxConnection } = require('./packages/core/dist/usbmux/UsbMuxConnection');
const { ScreenshotService } = require('./packages/core/dist/services/ScreenshotService');
const { LockdownClient, LOCKDOWN_PORT_USBMUX } = require('./packages/core/dist/lockdown/LockdownClient');

const UDID = 'c82d7b8489017c3c5ccab14ce5bd8e4fc3bed99a';
const SCREENSHOT_PATH = '/tmp/test-screenshot.png';

async function pass(name, fn) {
  try {
    const result = await fn();
    const preview = result !== undefined && result !== null
      ? JSON.stringify(result).slice(0, 120) : '';
    console.log(`PASS  ${name}  ${preview}`);
    return result;
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message}`);
    return null;
  }
}

async function main() {
  // --- Setup lockdown via LockdownService.create (handles pairing, session, SSL) ---
  console.log('Connecting to device...');
  let lockdown;
  try {
    lockdown = await LockdownService.create(UDID);
  } catch (e) {
    console.error('Cannot connect lockdown:', e.message);
    process.exit(1);
  }
  console.log(`Device: udid=${lockdown.udid} version=${lockdown.productVersion} type=${lockdown.productType}`);

  // --- DTX / DVT tests ---
  console.log('\n--- DTX / DVT ---');
  let dvtFactory = null;
  try {
    dvtFactory = await DvtFactory.create(lockdown);
    console.log('PASS  DvtFactory.create (DTX connection established)');
  } catch (e) {
    console.log(`FAIL  DvtFactory.create: ${e.message}`);
    await lockdown.close();
    process.exit(1);
  }

  // Test DeviceInfoService.runningProcesses
  let deviceInfo = null;
  await pass('DeviceInfoService.create', async () => {
    deviceInfo = await dvtFactory.deviceInfo();
    return 'ok';
  });

  if (deviceInfo) {
    await pass('deviceInfo.proclist() (runningProcesses)', async () => {
      const procs = await deviceInfo.proclist();
      return `${procs.length} processes`;
    });

    await pass('deviceInfo.systemInformation()', async () => {
      const info = await deviceInfo.systemInformation();
      return Object.keys(info).slice(0, 5).join(', ');
    });

    await deviceInfo.close();
  }

  // Test ScreenshotDvtService (DTX-based screenshot via Instruments)
  await pass('ScreenshotDvtService.takeScreenshot()', async () => {
    const svc = await dvtFactory.screenshot();
    const buf = await svc.takeScreenshot();
    await svc.close();
    if (!buf || buf.length === 0) throw new Error('Empty screenshot buffer');
    fs.writeFileSync(SCREENSHOT_PATH + '.dvt.png', buf);
    return `${buf.length} bytes → ${SCREENSHOT_PATH}.dvt.png`;
  });

  dvtFactory.close();

  // --- ScreenshotService (non-DTX, com.apple.mobile.screenshotr) ---
  console.log('\n--- ScreenshotService (screenshotr, non-DTX) ---');
  await pass('ScreenshotService.takeScreenshot()', async () => {
    const { port, enableSSL } = await lockdown.startService('com.apple.mobile.screenshotr');
    // port from lockdown is big-endian encoded; swap bytes
    const portBuf = Buffer.allocUnsafe(2);
    portBuf.writeUInt16BE(port, 0);
    const swapped = portBuf.readUInt16LE(0);
    const mux = await UsbMuxConnection.create();
    const socket = await mux.connectDevice(lockdown.device.devid, swapped);
    if (enableSSL && lockdown.client.pairRecord) {
      const tls = require('tls');
      const tlsSocket = await new Promise((resolve, reject) => {
        const s = tls.connect({
          socket,
          rejectUnauthorized: false,
          cert: lockdown.client.pairRecord.HostCertificate,
          key: lockdown.client.pairRecord.HostPrivateKey,
        });
        s.once('secureConnect', () => resolve(s));
        s.once('error', reject);
        setTimeout(() => reject(new Error('TLS timeout')), 10000);
      });
      const svc = new ScreenshotService(tlsSocket);
      const buf = await svc.takeScreenshot();
      await svc.close();
      if (!buf || buf.length === 0) throw new Error('Empty screenshot buffer');
      fs.writeFileSync(SCREENSHOT_PATH, buf);
      return `${buf.length} bytes → ${SCREENSHOT_PATH}`;
    } else {
      const svc = new ScreenshotService(socket);
      const buf = await svc.takeScreenshot();
      await svc.close();
      if (!buf || buf.length === 0) throw new Error('Empty screenshot buffer');
      fs.writeFileSync(SCREENSHOT_PATH, buf);
      return `${buf.length} bytes → ${SCREENSHOT_PATH}`;
    }
  });

  await lockdown.close();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
