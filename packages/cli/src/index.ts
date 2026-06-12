#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execFileSync } from 'child_process';
import { listDevices, LockdownService, ServiceFactory, DevicePool } from '@tsmobiledevice/core';

const program = new Command();

program
  .name('tsmobiledevice')
  .description('TypeScript implementation of iOS device communication tools')
  .version('0.0.1');

// Helper: get LockdownService + ServiceFactory
async function getService(udid?: string): Promise<{ lockdown: LockdownService; factory: ServiceFactory }> {
  const lockdown = await LockdownService.create(udid);
  const factory = new ServiceFactory(lockdown);
  return { lockdown, factory };
}

// usbmux commands
const usbmuxCmd = program.command('usbmux').description('USB Multiplexer operations');

usbmuxCmd
  .command('list')
  .description('List all connected iOS devices')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const devices = await listDevices();
      if (options.json) {
        console.log(JSON.stringify(devices, null, 2));
      } else {
        if (devices.length === 0) {
          console.log('No devices connected.');
          return;
        }
        console.log('Connected devices:\n');
        for (const device of devices) {
          console.log(`  UDID:        ${device.serial}`);
          console.log(`  Device ID:   ${device.devid}`);
          console.log(`  Connection:  ${device.connectionType}`);
          console.log();
        }
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

usbmuxCmd
  .command('listen')
  .description('Listen for device attach/detach events in real-time (Ctrl+C to exit)')
  .action(async () => {
    let pool: DevicePool | undefined;
    try {
      pool = await DevicePool.connect();
      console.log('Listening for device events... (Ctrl+C to exit)');
      pool.on('device:connected', (d: any) => console.log(`[+] attached:  ${d.serial} [${d.connectionType}]`));
      pool.on('device:disconnected', (serial: string) => console.log(`[-] detached:  ${serial}`));
      process.on('SIGINT', () => { pool!.close(); process.exit(0); });
      await new Promise(() => {});
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      pool?.close();
      process.exit(1);
    }
  });

// lockdown commands
const lockdownCmd = program.command('lockdown').description('Lockdown protocol operations');

lockdownCmd
  .command('info')
  .description('Show device info (iOS version, serial, name, UDID)')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const v = lockdown.client.allValues;
      console.log(`  Device Name:     ${v.DeviceName ?? 'N/A'}`);
      console.log(`  iOS Version:     ${v.ProductVersion ?? 'N/A'}`);
      console.log(`  Product Type:    ${v.ProductType ?? 'N/A'}`);
      console.log(`  Serial Number:   ${v.SerialNumber ?? 'N/A'}`);
      console.log(`  UDID:            ${v.UniqueDeviceID ?? 'N/A'}`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

lockdownCmd
  .command('pair')
  .description('Pair with device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      if (lockdown.client.pairRecord) {
        console.log('Device is already paired.');
      } else {
        console.log('Device is not paired. Please trust this computer on the device.');
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// afc commands
const afcCmd = program.command('afc').description('Apple File Conduit operations');

afcCmd
  .command('ls <path>')
  .description('List directory on device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (remotePath, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const afc = await factory.afc();
      try {
        const entries = await afc.listdir(remotePath);
        for (const entry of entries) {
          console.log(entry);
        }
      } finally {
        await afc.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

afcCmd
  .command('pull <remote> <local>')
  .description('Download file or directory from device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (remote, local, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const afc = await factory.afc();
      try {
        await pullPath(afc, remote, local);
        console.log(`Pulled ${remote} -> ${local}`);
      } finally {
        await afc.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

async function pullPath(afc: any, remote: string, local: string): Promise<void> {
  const info = await afc.stat(remote);
  if (info['st_ifmt'] === 'S_IFDIR') {
    fs.mkdirSync(local, { recursive: true });
    const entries = await afc.listdir(remote);
    for (const entry of entries) {
      const r = remote === '/' ? `/${entry}` : `${remote}/${entry}`;
      await pullPath(afc, r, path.join(local, entry));
    }
  } else {
    const data = await afc.getFileContents(remote);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, data);
  }
}

afcCmd
  .command('push <local> <remote>')
  .description('Upload file or directory to device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (local, remote, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const afc = await factory.afc();
      try {
        await pushPath(afc, local, remote);
        console.log(`Pushed ${local} -> ${remote}`);
      } finally {
        await afc.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

async function pushPath(afc: any, local: string, remote: string): Promise<void> {
  const stat = fs.statSync(local);
  if (stat.isDirectory()) {
    await afc.makedirs(remote);
    for (const entry of fs.readdirSync(local)) {
      await pushPath(afc, path.join(local, entry), `${remote}/${entry}`);
    }
  } else {
    const data = fs.readFileSync(local);
    await afc.setFileContents(remote, data);
  }
}

afcCmd
  .command('shell')
  .description('Interactive AFC shell')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    const afc = await factory.afc().catch((e) => {
      console.error(`Error: ${e.message}`);
      lockdown.close();
      process.exit(1);
    });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'afc> ' });
    rl.prompt();
    rl.on('line', async (line) => {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0];
      try {
        if (!cmd) {
          // nothing
        } else if (cmd === 'ls') {
          const entries = await afc.listdir(parts[1] ?? '/');
          entries.forEach((e: string) => console.log(e));
        } else if (cmd === 'get') {
          const data = await afc.getFileContents(parts[1]);
          fs.writeFileSync(parts[2] ?? path.basename(parts[1]), data);
          console.log('done');
        } else if (cmd === 'put') {
          await afc.setFileContents(parts[2], fs.readFileSync(parts[1]));
          console.log('done');
        } else if (cmd === 'rm') {
          await afc.rm(parts[1]);
          console.log('done');
        } else if (cmd === 'mkdir') {
          await afc.makedirs(parts[1]);
          console.log('done');
        } else if (cmd === 'exit' || cmd === 'quit') {
          rl.close();
          return;
        } else {
          console.log('Commands: ls <path>, get <remote> [local], put <local> <remote>, rm <path>, mkdir <path>, exit');
        }
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
      rl.prompt();
    });
    rl.on('close', async () => {
      await afc.close();
      await lockdown.close();
    });
  });

// apps commands
const appsCmd = program.command('apps').description('App management operations');

appsCmd
  .command('list')
  .description('List user applications')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const proxy = await factory.installationProxy();
      try {
        const apps = await proxy.getApps('User');
        for (const [bundleId, info] of Object.entries(apps as Record<string, any>)) {
          console.log(`  ${bundleId}  (${info.CFBundleDisplayName ?? info.CFBundleName ?? ''})`);
        }
      } finally {
        await proxy.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

appsCmd
  .command('install <ipa>')
  .description('Install an IPA file')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (ipa, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      // Upload IPA via AFC then install
      const afc = await factory.afc();
      const remotePath = `/PublicStaging/${path.basename(ipa)}`;
      try {
        await afc.makedirs('/PublicStaging');
      } catch { /* may already exist */ }
      await afc.setFileContents(remotePath, fs.readFileSync(ipa));
      await afc.close();

      const proxy = await factory.installationProxy();
      try {
        await proxy.install(remotePath);
        console.log(`Installed ${ipa}`);
      } finally {
        await proxy.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

appsCmd
  .command('uninstall <bundleId>')
  .description('Uninstall an app by bundle ID')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (bundleId, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const proxy = await factory.installationProxy();
      try {
        await proxy.uninstall(bundleId);
        console.log(`Uninstalled ${bundleId}`);
      } finally {
        await proxy.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// diagnostics commands
const diagCmd = program.command('diag').description('Device diagnostics operations');

diagCmd
  .command('battery')
  .description('Show battery information')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const diag = await factory.diagnostics();
      try {
        const info = await diag.getBattery();
        for (const [k, v] of Object.entries(info ?? {})) {
          console.log(`  ${k}: ${v}`);
        }
      } finally {
        await diag.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

diagCmd
  .command('info')
  .description('Show device diagnostic info')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    try {
      const diag = await factory.diagnostics();
      try {
        const info = await diag.queryIORegistry();
        console.log(JSON.stringify(info, null, 2));
      } finally {
        await diag.close();
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// syslog commands
const syslogCmd = program.command('syslog').description('Device syslog streaming');

syslogCmd
  .command('live')
  .description('Stream syslog in real-time (Ctrl+C to stop)')
  .option('-u, --udid <udid>', 'Target device UDID')
  .option('--match <pattern>', 'Only show lines matching pattern (regex)')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
    const svc = await factory.syslog().catch((e) => {
      console.error(`Error: ${e.message}`);
      lockdown.close();
      process.exit(1);
    });
    const filter = options.match ? new RegExp(options.match) : null;
    process.on('SIGINT', () => { svc.close(); lockdown.close(); process.exit(0); });
    try {
      for await (const line of svc.lines()) {
        if (!filter || filter.test(line)) process.stdout.write(line + '\n');
      }
    } finally {
      await svc.close();
      await lockdown.close();
    }
  });

// developer commands (DTX/DVT — require DDI on iOS ≤16)
const devCmd = program.command('developer').description('Developer tools (requires DDI on iOS ≤16)');

/**
 * Try to create a DvtFactory. If the DVT service is unavailable, auto-mount the
 * Developer Disk Image via pymobiledevice3 and retry once.
 */
async function withDvt(factory: ServiceFactory, lockdown: LockdownService) {
  const isDvtError = (e: Error) =>
    e.message.includes('No DVT service') ||
    e.message.includes('InvalidService') ||
    e.message.includes('invalid service');

  try {
    return await factory.dvt();
  } catch (e: any) {
    if (!isDvtError(e)) throw e;
  }

  // Auto-mount DDI
  console.error('DVT service unavailable — attempting to mount Developer Disk Image...');
  const udid = lockdown.device.serial;
  const pythonPaths = [
    `${process.env.LOCALAPPDATA ?? ''}\\pymobiledevice3\\.venv\\Scripts\\python.exe`,
    'python',
    'python3',
  ];
  const pymobi = path.join(__dirname, '..', '..', '..', '..', 'pymobiledevice3-master', '.venv', 'Scripts', 'python.exe');

  let mounted = false;
  for (const py of [pymobi, ...pythonPaths]) {
    try {
      execFileSync(py, ['-m', 'pymobiledevice3', 'mounter', 'auto-mount', '--udid', udid], {
        env: { ...process.env, PYTHONUTF8: '1' },
        stdio: 'inherit',
        timeout: 60000,
      });
      mounted = true;
      break;
    } catch { /* try next */ }
  }

  if (!mounted) {
    throw new Error(
      'DDI mount failed. Run manually:\n  python -m pymobiledevice3 mounter auto-mount',
    );
  }

  return factory.dvt();
}

/** Run a screenshot task for one device, returns { udid, dest, error } */
async function screenshotOne(udid: string, outDir: string, single: boolean): Promise<{ udid: string; dest?: string; error?: string }> {
  let lockdown: LockdownService | undefined;
  try {
    lockdown = await LockdownService.create(udid);
    const factory = new ServiceFactory(lockdown);
    const dvt = await withDvt(factory, lockdown);
    try {
      const svc = await dvt.screenshot();
      const data = await svc.takeScreenshot();
      await svc.close();
      const dest = single ? path.join(outDir, 'screenshot.png') : path.join(outDir, `${udid}.png`);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(dest, data);
      return { udid, dest };
    } finally {
      dvt.close();
    }
  } catch (e: any) {
    return { udid, error: e.message };
  } finally {
    await lockdown?.close();
  }
}

devCmd
  .command('screenshot [output]')
  .description('Take a screenshot. --all captures all connected devices in parallel')
  .option('-u, --udid <udid>', 'Target device UDID')
  .option('--all', 'Screenshot all connected devices in parallel')
  .option('-o, --out-dir <dir>', 'Output directory for --all mode', '.')
  .action(async (output, options) => {
    if (options.all) {
      // Parallel: all devices
      const devices = await listDevices().catch((e) => { console.error(e.message); process.exit(1); });
      if (!devices.length) { console.log('No devices connected.'); return; }
      console.log(`Capturing ${devices.length} device(s) in parallel...`);
      const results = await Promise.all(
        devices.map((d) => screenshotOne(d.serial, options.outDir, false))
      );
      for (const r of results) {
        if (r.error) console.error(`  [${r.udid.slice(0, 8)}] FAIL: ${r.error}`);
        else console.log(`  [${r.udid.slice(0, 8)}] ${r.dest}`);
      }
    } else {
      const { lockdown, factory } = await getService(options.udid).catch((e) => {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      });
      try {
        const dvt = await withDvt(factory, lockdown);
        try {
          const svc = await dvt.screenshot();
          const data = await svc.takeScreenshot();
          await svc.close();
          const dest = output ?? 'screenshot.png';
          fs.writeFileSync(dest, data);
          console.log(`Screenshot saved: ${dest} (${data.length} bytes)`);
        } finally {
          dvt.close();
        }
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      } finally {
        await lockdown.close();
      }
    }
  });

devCmd
  .command('processes')
  .description('List running processes. --all lists processes on all connected devices')
  .option('-u, --udid <udid>', 'Target device UDID')
  .option('--all', 'Query all connected devices in parallel')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const udids: string[] = options.all
      ? (await listDevices()).map((d) => d.serial)
      : [options.udid];

    const runOne = async (udid: string) => {
      let lockdown: LockdownService | undefined;
      try {
        lockdown = await LockdownService.create(udid);
        const factory = new ServiceFactory(lockdown);
        const dvt = await withDvt(factory, lockdown);
        try {
          const info = await dvt.deviceInfo();
          return { udid, procs: await info.proclist() };
        } finally {
          dvt.close();
        }
      } catch (e: any) {
        return { udid, error: e.message };
      } finally {
        await lockdown?.close();
      }
    };

    const results = await Promise.all(udids.map(runOne));

    for (const r of results) {
      if (options.all) console.log(`\n=== ${r.udid} ===`);
      if ('error' in r && r.error) { console.error(`Error: ${r.error}`); continue; }
      const procs = r.procs as any[];
      if (options.json) {
        console.log(JSON.stringify(procs, null, 2));
      } else {
        console.log(`${'PID'.padEnd(8)}${'NAME'.padEnd(40)}PATH`);
        console.log('-'.repeat(80));
        for (const p of procs) {
          console.log(`${String(p.pid ?? '').padEnd(8)}${String(p.name ?? '').padEnd(40)}${p.realAppName ?? ''}`);
        }
      }
    }
  });

// pool commands
const poolCmd = program.command('pool').description('Multi-device pool operations');

poolCmd
  .command('devices')
  .description('List all devices with status')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    let pool: DevicePool | undefined;
    try {
      pool = await DevicePool.connect();
      const devices = pool.getDevices();
      if (options.json) {
        console.log(JSON.stringify(devices.map((d) => ({ udid: d.serial, connectionType: d.connectionType, ipAddress: d.ipAddress })), null, 2));
      } else {
        if (!devices.length) { console.log('No devices connected.'); return; }
        for (const d of devices) {
          const label = d.connectionType === 'Network' ? 'Wi-Fi' : d.connectionType;
          const ip = d.connectionType === 'Network' && d.ipAddress ? `  ${d.ipAddress}` : '';
          console.log(`  UDID: ${d.serial}  [${label}]${ip}`);
        }
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    } finally {
      pool?.on('error', () => {}); // suppress async listen-loop error after close
      pool?.close();
    }
  });

poolCmd
  .command('screenshot')
  .description('Take screenshot on all devices in parallel')
  .requiredOption('-o, --out-dir <dir>', 'Output directory')
  .action(async (options) => {
    let pool: DevicePool | undefined;
    try {
      pool = await DevicePool.connect();
      const devices = pool.getDevices();
      if (!devices.length) { console.log('No devices connected.'); return; }
      console.log(`Capturing ${devices.length} device(s) in parallel...`);
      fs.mkdirSync(options.outDir, { recursive: true });
      const results = await Promise.all(
        devices.map((d) => screenshotOne(d.serial, options.outDir, false))
      );
      for (const r of results) {
        if (r.error) console.error(`  [${r.udid.slice(0, 8)}] FAIL: ${r.error}`);
        else console.log(`  [${r.udid.slice(0, 8)}] ${r.dest}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    } finally {
      pool?.close();
    }
  });

poolCmd
  .command('watch')
  .description('Watch device connect/disconnect events (Ctrl+C to exit)')
  .action(async () => {
    let pool: DevicePool | undefined;
    try {
      pool = await DevicePool.connect();
      console.log('Watching for device events... (Ctrl+C to exit)');
      pool.on('device:connected', (d: any) => console.log(`[+] connected:    ${d.serial} [${d.connectionType}]`));
      pool.on('device:disconnected', (serial: string) => console.log(`[-] disconnected: ${serial}`));
      process.on('SIGINT', () => { pool!.close(); process.exit(0); });
      await new Promise(() => {}); // keep alive
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      pool?.close();
      process.exit(1);
    }
  });

devCmd
  .command('perf [udid]')
  .description('Real-time system CPU/memory (1s refresh, Ctrl+C to stop)')
  .action(async (udid) => {
    const lockdown = await LockdownService.create(udid).catch((e: any) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    const factory = new ServiceFactory(lockdown);
    const dvt = await withDvt(factory, lockdown).catch((e: any) => {
      console.error(`Error: ${e.message}`); lockdown.close(); process.exit(1);
    });

    let stopping = false;
    const infoSvc = await dvt.deviceInfo();
    const sysAttrs = await infoSvc.sysmonSystemAttributes();
    await infoSvc.close();

    const svc = await dvt.sysmontap();
    await svc.start([], sysAttrs, 1000);

    const cleanup = async () => {
      if (stopping) return;
      stopping = true;
      await svc.stop().catch(() => {});
      await svc.close();
      dvt.close();
      await lockdown.close();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);

    for await (const sample of svc.samples()) {
      if (stopping) break;
      const sys = Array.isArray(sample.SystemCPUUsage)
        ? sample.SystemCPUUsage[0]
        : (sample.SystemCPUUsage ?? sample);

      // CPU: CPUTotalLoad or sum of user+system
      const cpuLoad: number =
        sys?.CPUTotalLoad ??
        ((sys?.CPU_TotalLoad ?? 0));

      // Memory in bytes: physMemSize - vmFreeCount*pageSize or physFootprint
      const memUsedBytes: number = sys?.vmUsedMemory ?? sys?.physMemUsed ?? 0;
      const memFreeBytes: number = sys?.vmFreeMemory ?? sys?.physMemFree ?? 0;

      const toMB = (b: number) => (b / 1024 / 1024).toFixed(0);
      const time = new Date().toTimeString().slice(0, 8);
      const cpu = typeof cpuLoad === 'number' ? cpuLoad.toFixed(1) : '?';
      const used = memUsedBytes ? `${toMB(memUsedBytes)} MB` : 'N/A';
      const free = memFreeBytes ? `(free: ${toMB(memFreeBytes)} MB)` : '';

      process.stdout.write(`\r[${time}]  CPU: ${cpu}%  MEM: ${used}  ${free}    `);
    }
  });

// webinspector commands
const wiCmd = program.command('webinspector').description('WebInspector protocol operations');

wiCmd
  .command('list [udid]')
  .description('List open Safari pages (URL + title)')
  .action(async (udid) => {
    const { lockdown, factory } = await getService(udid).catch((e: any) => {
      if (e.message?.includes('InvalidService')) {
        console.error('Error: WebInspector service unavailable.\nEnable it: Settings → Safari → Advanced → Web Inspector');
      } else {
        console.error(`Error: ${e.message}`);
      }
      process.exit(1);
    });
    try {
      const wi = await factory.webInspector();
      try {
        const pages = await wi.getOpenPages();
        if (!pages.length) {
          console.log('No open pages found.');
        } else {
          for (const p of pages) {
            console.log(`  [${p.title || '(no title)'}]  ${p.url}`);
          }
        }
      } finally {
        await wi.close();
      }
    } catch (error: any) {
      if (error.message?.includes('InvalidService')) {
        console.error('Error: WebInspector service unavailable.\nEnable it: Settings → Safari → Advanced → Web Inspector');
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// location commands
const locCmd = program.command('location').description('Location simulation');

locCmd
  .command('set <lat> <lng>')
  .description('Simulate device location')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (lat, lng, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.simulateLocation();
      try {
        await svc.setLocation(parseFloat(lat), parseFloat(lng));
        console.log(`Location set: ${lat}, ${lng}`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

locCmd
  .command('reset')
  .description('Reset simulated location')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.simulateLocation();
      try {
        await svc.resetLocation();
        console.log('Location reset.');
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// crash commands
const crashCmd = program.command('crash').description('Crash reports management');

crashCmd
  .command('list')
  .description('List crash reports on device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.crashReports();
      try {
        const reports = await svc.listCrashReports();
        if (!reports.length) { console.log('No crash reports.'); return; }
        for (const r of reports) console.log(`  ${r}`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

crashCmd
  .command('pull <remote> <local>')
  .description('Download a crash report')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (remote, local, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.crashReports();
      try {
        const data = await svc.getCrashReport(remote);
        fs.writeFileSync(local, data);
        console.log(`Saved: ${local} (${data.length} bytes)`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

crashCmd
  .command('delete <remote>')
  .description('Delete a crash report on device')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (remote, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.crashReports();
      try {
        await svc.deleteCrashReport(remote);
        console.log(`Deleted: ${remote}`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

// springboard commands
const sbCmd = program.command('springboard').description('SpringBoard operations');

sbCmd
  .command('icon <bundleId> [output]')
  .description('Get app icon PNG')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (bundleId, output, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.springBoard();
      try {
        const data = await svc.getIconPngData(bundleId);
        const dest = output ?? `${bundleId}.png`;
        fs.writeFileSync(dest, data);
        console.log(`Icon saved: ${dest} (${data.length} bytes)`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

sbCmd
  .command('wallpaper [output]')
  .description('Get home screen wallpaper PNG')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (output, options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.springBoard();
      try {
        const data = await svc.getWallpaperPngData();
        const dest = output ?? 'wallpaper.png';
        fs.writeFileSync(dest, data);
        console.log(`Wallpaper saved: ${dest} (${data.length} bytes)`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

sbCmd
  .command('orientation')
  .description('Get current interface orientation')
  .option('-u, --udid <udid>', 'Target device UDID')
  .action(async (options) => {
    const { lockdown, factory } = await getService(options.udid).catch((e) => {
      console.error(`Error: ${e.message}`); process.exit(1);
    });
    try {
      const svc = await factory.springBoard();
      try {
        const o = await svc.getInterfaceOrientation();
        const labels: Record<number, string> = { 1: 'Portrait', 2: 'Portrait (upside down)', 3: 'Landscape (home right)', 4: 'Landscape (home left)' };
        console.log(`Orientation: ${labels[o] ?? o}`);
      } finally {
        await svc.close();
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`); process.exit(1);
    } finally {
      await lockdown.close();
    }
  });

program.parse(process.argv);
