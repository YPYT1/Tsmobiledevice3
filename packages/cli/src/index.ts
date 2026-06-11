#!/usr/bin/env node

/**
 * ts-mobiledevice CLI entry point
 */

import { Command } from 'commander';
import { listDevices } from '@ts-mobiledevice/core';

const program = new Command();

program
  .name('ts-mobiledevice')
  .description('TypeScript implementation of iOS device communication tools')
  .version('0.0.1');

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

program.parse(process.argv);
