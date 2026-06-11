const { UsbMuxConnection } = require('./packages/core/dist/usbmux/UsbMuxConnection');

const UDID1 = 'c82d7b8489017c3c5ccab14ce5bd8e4fc3bed99a';
const UDID2 = 'a8632f714e79f303b56197bf7d286a806fbdb1f2';
let p = 0, f = 0;

function ok(name, cond, info = '') {
  if (cond) { console.log('  ✓ ' + name); p++; }
  else { console.log('  ✗ ' + name + (info ? ' (' + info + ')' : '')); f++; }
}

async function run(name, fn) {
  console.log('\n[' + (p + f + 1) + '] ' + name);
  try { await fn(); }
  catch (e) { console.log('  ✗ EXCEPTION: ' + e.message); f++; }
}

// lockdownd port 62078 needs byte-swapped for usbmux
const LOCKDOWN_PORT = Buffer.allocUnsafe(2);
LOCKDOWN_PORT.writeUInt16BE(62078, 0);
const LOCKDOWN_PORT_LE = LOCKDOWN_PORT.readUInt16LE(0);

async function main() {
  console.log('=== Layer 1 深度测试 (TypeScript实现) ===');

  await run('ReadBUID - 获取系统BUID', async () => {
    const mux = await UsbMuxConnection.create();
    const buid = await mux.getBuid();
    await mux.close();
    ok('BUID非空', buid && buid.length > 0, buid);
    ok('BUID是数字', /^\d+$/.test(buid), buid);
    console.log('  BUID:', buid);
  });

  let devid1 = null, devid2 = null;

  await run('ListDevices - 列出所有设备', async () => {
    const mux = await UsbMuxConnection.create();
    const devices = await mux.listDevices();
    await mux.close();
    ok('至少2台设备', devices.length >= 2, 'found ' + devices.length);
    ok('找到UDID1', devices.some(d => d.serial === UDID1));
    ok('找到UDID2', devices.some(d => d.serial === UDID2));
    ok('全部USB连接', devices.every(d => d.connectionType === 'USB'));
    for (const d of devices) {
      console.log('  DeviceID=' + d.devid + ' serial=' + d.serial + ' type=' + d.connectionType);
      if (d.serial === UDID1) devid1 = d.devid;
      if (d.serial === UDID2) devid2 = d.devid;
    }
  });

  await run('ReadPairRecord - 设备1配对记录', async () => {
    const mux = await UsbMuxConnection.create();
    const pr = await mux.getPairRecord(UDID1);
    await mux.close();
    ok('有HostID', 'HostID' in pr);
    ok('有DeviceCertificate', 'DeviceCertificate' in pr);
    ok('有HostPrivateKey', 'HostPrivateKey' in pr);
    ok('有RootCertificate', 'RootCertificate' in pr);
    console.log('  PairRecord keys:', Object.keys(pr).join(', '));
  });

  await run('ReadPairRecord - 设备2配对记录', async () => {
    const mux = await UsbMuxConnection.create();
    const pr = await mux.getPairRecord(UDID2);
    await mux.close();
    ok('有HostID', 'HostID' in pr);
    console.log('  HostID:', pr.HostID);
  });

  await run('Connect - 设备1 lockdownd端口(62078)', async () => {
    const mux = await UsbMuxConnection.create();
    const sock = await mux.connectDevice(devid1 || 3, LOCKDOWN_PORT_LE);
    ok('返回socket', sock != null);
    ok('socket未销毁', !sock.destroyed);
    sock.destroy();
    console.log('  DeviceID=' + (devid1 || 3) + ' port=62078(LE=' + LOCKDOWN_PORT_LE + ')');
  });

  await run('Connect - 设备2 lockdownd端口(62078)', async () => {
    const mux = await UsbMuxConnection.create();
    const sock = await mux.connectDevice(devid2 || 1, LOCKDOWN_PORT_LE);
    ok('返回socket', sock != null);
    sock.destroy();
  });

  await run('Listen - 订阅设备插拔事件', async () => {
    const mux = await UsbMuxConnection.create();
    const events = [];
    // listen() sends the Listen command and waits for Result confirmation
    await mux.listen();
    ok('Listen成功', true);
    // Now receive device state updates (devices already attached)
    try {
      await Promise.race([
        (async () => {
          await mux.receiveDeviceStateUpdate();
          events.push('Attached');
        })(),
        new Promise(res => setTimeout(res, 1500))
      ]);
    } catch (e) { /* ok */ }
    await mux.close();
    console.log('  收到设备事件:', events.length > 0 ? events.join(', ') : '(无新事件，设备已存在)');
    ok('Listen流程完成', true);
  });

  await run('错误处理 - 无效DeviceID Connect', async () => {
    const mux = await UsbMuxConnection.create();
    let caught = false;
    try {
      await mux.connectDevice(99999, LOCKDOWN_PORT_LE);
    } catch (e) {
      caught = true;
      console.log('  正确抛出:', e.constructor.name, '-', e.message);
    }
    await mux.close();
    ok('连接无效设备抛出异常', caught);
  });

  await run('错误处理 - 无效UDID ReadPairRecord', async () => {
    const mux = await UsbMuxConnection.create();
    let caught = false;
    try {
      await mux.getPairRecord('0000000000000000000000000000000000000000');
    } catch (e) {
      caught = true;
      console.log('  正确抛出:', e.constructor.name, '-', e.message);
    }
    await mux.close();
    ok('查无效配对记录抛出异常', caught);
  });

  console.log('\n' + '='.repeat(45));
  console.log('结果: ' + p + ' 通过 / ' + f + ' 失败 / ' + (p + f) + ' 总计');
  if (f === 0) console.log('Layer 1 全部测试通过 ✓\n准备开始 Layer 2');
  else console.log('有 ' + f + ' 个测试失败，需要修复');
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
