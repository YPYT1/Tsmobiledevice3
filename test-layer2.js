/**
 * Layer 2 深度测试 - lockdown协议完整验证
 */
const { UsbMuxConnection } = require('./packages/core/dist/usbmux/UsbMuxConnection');
const { LockdownClient, LOCKDOWN_PORT_USBMUX } = require('./packages/core/dist/lockdown/LockdownClient');

const UDID1 = 'c82d7b8489017c3c5ccab14ce5bd8e4fc3bed99a';
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

async function getLockdownSocket(devid) {
  const mux = await UsbMuxConnection.create();
  const sock = await mux.connectDevice(devid, LOCKDOWN_PORT_USBMUX);
  // detach socket from mux (mux.connected=true so close won't destroy the socket)
  return sock;
}

async function getPairRecord() {
  const mux = await UsbMuxConnection.create();
  const pr = await mux.getPairRecord(UDID1);
  await mux.close();
  return pr;
}

async function main() {
  console.log('=== Layer 2 深度测试 (lockdown协议) ===');

  // Get devid
  const muxList = await UsbMuxConnection.create();
  const devices = await muxList.listDevices();
  await muxList.close();
  const dev1 = devices.find(d => d.serial === UDID1);
  if (!dev1) { console.log('FATAL: 设备1未找到'); process.exit(1); }
  const devid1 = dev1.devid;
  console.log('设备ID:', devid1);

  await run('QueryType - 验证lockdown服务类型', async () => {
    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);
    const type = await client.queryType();
    ok('类型正确', type === 'com.apple.mobile.lockdown', type);
    console.log('  Type:', type);
    sock.destroy();
  });

  await run('GetValue - 获取所有设备信息', async () => {
    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);
    const values = await client.getValue();
    ok('返回对象', typeof values === 'object' && values !== null);
    ok('有UniqueDeviceID', 'UniqueDeviceID' in values);
    ok('UDID匹配', values.UniqueDeviceID === UDID1, values.UniqueDeviceID);
    ok('有ProductVersion', 'ProductVersion' in values);
    ok('有ProductType', 'ProductType' in values);
    ok('有DeviceName', 'DeviceName' in values);
    ok('有BuildVersion', 'BuildVersion' in values);
    console.log('  DeviceName:', values.DeviceName);
    console.log('  iOS:', values.ProductVersion, '(' + values.BuildVersion + ')');
    console.log('  ProductType:', values.ProductType);
    sock.destroy();
  });

  await run('GetValue - 获取单个key', async () => {
    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);
    const udid = await client.getValue('UniqueDeviceID');
    ok('UniqueDeviceID正确', udid === UDID1, udid);
    const ver = await client.getValue('ProductVersion');
    ok('ProductVersion非空', ver && ver.length > 0, ver);
    console.log('  ProductVersion:', ver);
    sock.destroy();
  });

  await run('StartSession + TLS升级', async () => {
    const pairRecord = await getPairRecord();
    ok('获取配对记录', pairRecord && pairRecord.HostID);

    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);
    const { sessionId, enableSSL } = await client.startSession(
      pairRecord.HostID,
      '30142955-444094379208051516'
    );
    ok('有SessionID', sessionId && sessionId.length > 0, sessionId);
    ok('需要SSL', enableSSL === true);
    console.log('  SessionID:', sessionId);

    if (enableSSL) {
      await client.upgradeToSSL(pairRecord.HostCertificate, pairRecord.HostPrivateKey);
      ok('TLS升级成功', true);
    }
    await client.close();
  });

  await run('完整流程: StartSession → SSL → GetValue(authenticated)', async () => {
    const pairRecord = await getPairRecord();
    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);

    const { sessionId, enableSSL } = await client.startSession(pairRecord.HostID, '30142955-444094379208051516');
    if (enableSSL) await client.upgradeToSSL(pairRecord.HostCertificate, pairRecord.HostPrivateKey);

    // GetValue over SSL
    const udid = await client.getValue('UniqueDeviceID');
    ok('SSL后GetValue正确', udid === UDID1, udid);

    const wifi = await client.getValue('WiFiAddress');
    ok('WiFi地址非空', wifi && wifi.length > 0, wifi);
    console.log('  WiFi:', wifi);

    const serial = await client.getValue('SerialNumber');
    ok('序列号非空', serial && serial.length > 0, serial);
    console.log('  SerialNumber:', serial);

    await client.stopSession();
    ok('StopSession成功', true);
    await client.close();
  });

  await run('LockdownClient.create() 工厂方法', async () => {
    const pairRecord = await getPairRecord();
    const sock = await getLockdownSocket(devid1);
    const client = await LockdownClient.create(sock, pairRecord);
    ok('allValues已填充', Object.keys(client.allValues).length > 0);
    ok('udid正确', client.udid === UDID1, client.udid);
    ok('productVersion非空', client.productVersion && client.productVersion.length > 0, client.productVersion);
    ok('productType非空', client.productType && client.productType.length > 0, client.productType);
    console.log('  iOS:', client.productVersion, '| productType:', client.productType);
    await client.close();
  });

  await run('StartService - 启动afc服务', async () => {
    const pairRecord = await getPairRecord();
    const sock = await getLockdownSocket(devid1);
    const client = new LockdownClient(sock);
    const { sessionId, enableSSL } = await client.startSession(pairRecord.HostID, '30142955-444094379208051516');
    if (enableSSL) await client.upgradeToSSL(pairRecord.HostCertificate, pairRecord.HostPrivateKey);
    client['sessionId'] = sessionId;

    const svc = await client.startService('com.apple.afc');
    ok('afc服务有端口', svc.port > 0, 'port=' + svc.port);
    console.log('  afc port:', svc.port, 'SSL:', svc.enableSSL);
    await client.close();
  });

  await run('设备2 lockdown验证', async () => {
    const UDID2 = 'a8632f714e79f303b56197bf7d286a806fbdb1f2';
    const mux = await UsbMuxConnection.create();
    const devices = await mux.listDevices();
    await mux.close();
    const dev2 = devices.find(d => d.serial === UDID2);
    if (!dev2) { ok('找到设备2', false, '未找到'); return; }

    const mux2 = await UsbMuxConnection.create();
    const pr2 = await mux2.getPairRecord(UDID2);
    await mux2.close();

    const mux3 = await UsbMuxConnection.create();
    const sock2 = await mux3.connectDevice(dev2.devid, LOCKDOWN_PORT_USBMUX);

    const client2 = new LockdownClient(sock2);
    const type2 = await client2.queryType();
    ok('设备2 QueryType正确', type2 === 'com.apple.mobile.lockdown');
    const { sessionId, enableSSL } = await client2.startSession(pr2.HostID, '30142955-444094379208051516');
    if (enableSSL) await client2.upgradeToSSL(pr2.HostCertificate, pr2.HostPrivateKey);
    const udid2 = await client2.getValue('UniqueDeviceID');
    ok('设备2 UDID正确', udid2 === UDID2, udid2);
    const ver2 = await client2.getValue('ProductVersion');
    console.log('  设备2 iOS:', ver2);
    await client2.close();
  });

  console.log('\n' + '='.repeat(45));
  console.log('结果: ' + p + ' 通过 / ' + f + ' 失败 / ' + (p + f) + ' 总计');
  if (f === 0) console.log('Layer 2 全部测试通过 ✓');
  else console.log('有 ' + f + ' 个测试失败');
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
