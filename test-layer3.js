'use strict';
const { UsbMuxConnection } = require('./packages/core/dist/usbmux/UsbMuxConnection');
const { LockdownClient } = require('./packages/core/dist/lockdown/LockdownClient');
const { AfcService } = require('./packages/core/dist/services/AfcService');
const { InstallationProxy } = require('./packages/core/dist/services/InstallationProxy');
const { DiagnosticsService } = require('./packages/core/dist/services/DiagnosticsService');

const UDID = 'c82d7b8489017c3c5ccab14ce5bd8e4fc3bed99a';

function swapPort(port) {
  return ((port & 0xff) << 8) | ((port >> 8) & 0xff);
}

async function connectService(muxConn, deviceId, port, useSSL, pairRecord) {
  const svcMux = await UsbMuxConnection.create();
  const socket = await svcMux.connectDevice(deviceId, swapPort(port));
  if (useSSL) {
    const net = require('net');
    const tls = require('tls');
    const tlsSocket = await new Promise((resolve, reject) => {
      const s = tls.connect({
        socket,
        rejectUnauthorized: false,
        cert: pairRecord.HostCertificate,
        key: pairRecord.HostPrivateKey,
      });
      s.once('secureConnect', () => resolve(s));
      s.once('error', reject);
      setTimeout(() => reject(new Error('TLS timeout')), 10000);
    });
    return tlsSocket;
  }
  return socket;
}

async function pass(name, fn) {
  try {
    const result = await fn();
    console.log(`PASS  ${name}`, result !== undefined ? JSON.stringify(result).slice(0, 120) : '');
    return true;
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  // --- Setup: mux + lockdown ---
  const mux = await UsbMuxConnection.create();
  const devices = await mux.listDevices();
  console.log('Devices:', devices.map(d => d.serial));
  const dev = devices.find(d => d.serial === UDID);
  if (!dev) throw new Error(`Device ${UDID} not found`);

  // Connect lockdown
  const lockdownPort = require('./packages/core/dist/lockdown/LockdownClient').LOCKDOWN_PORT_USBMUX;
  const ldSocket = await mux.connectDevice(dev.devid, lockdownPort);
  const pairRecord = await (async () => {
    const mux2 = await UsbMuxConnection.create();
    const pr = await mux2.getPairRecord(UDID);
    await mux2.close();
    return pr;
  })();
  const lockdown = await LockdownClient.create(ldSocket, pairRecord);
  console.log(`Lockdown: udid=${lockdown.udid} version=${lockdown.productVersion} type=${lockdown.productType}`);
  const paired = await lockdown.validatePairing(pairRecord);
  if (!paired) throw new Error('validatePairing failed - device not paired');

  // --- AFC tests ---
  console.log('\n--- AFC ---');
  {
    const { port, enableSSL } = await lockdown.startService(AfcService.SERVICE_NAME || 'com.apple.afc');
    const afcSocket = await connectService(null, dev.devid, port, enableSSL, pairRecord);
    const afc = new AfcService(afcSocket);
    await pass('afc.listdir(/)', () => afc.listdir('/'));
    await pass('afc.stat(/)', () => afc.stat('/'));
    await pass('afc.getDeviceInfo()', () => afc.getDeviceInfo());
    await pass('afc.exists(/) via stat', () => afc.stat('/').then(() => true));
    afcSocket.destroy();
  }

  // --- InstallationProxy tests ---
  console.log('\n--- InstallationProxy ---');
  {
    const { port, enableSSL } = await lockdown.startService(InstallationProxy.SERVICE_NAME);
    const ipSocket = await connectService(null, dev.devid, port, enableSSL, pairRecord);
    const ip = new InstallationProxy(ipSocket);
    await pass('ip.getApps(User)', async () => {
      const apps = await ip.getApps('User');
      return `${Object.keys(apps).length} apps`;
    });
    ipSocket.destroy();
  }

  // --- Diagnostics tests ---
  console.log('\n--- DiagnosticsService ---');
  {
    const { port, enableSSL } = await lockdown.startService(DiagnosticsService.SERVICE_NAME);
    const diagSocket = await connectService(null, dev.devid, port, enableSSL, pairRecord);
    const diag = new DiagnosticsService(diagSocket);
    await pass('diag.getBattery()', () => diag.getBattery());
    diagSocket.destroy();
  }

  await lockdown.close();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
