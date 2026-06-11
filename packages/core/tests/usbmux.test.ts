/**
 * Layer 1 Test: usbmux protocol
 *
 * REQUIREMENTS:
 * - Windows 10/11 with iTunes installed (for AMDS on port 27015)
 * - OR Linux/macOS with usbmuxd running
 * - At least one iOS device connected via USB
 */

import { UsbMuxConnection, listDevices, selectDevice } from '../src/usbmux';
import { ConnectionFailedToUsbmuxdError } from '../src/exceptions';

describe('Layer 1: usbmux protocol', () => {
  describe('Connection Tests', () => {
    test('should connect to usbmuxd daemon', async () => {
      const mux = await UsbMuxConnection.create();

      expect(mux).toBeDefined();
      expect(mux.isConnected()).toBe(false);

      await mux.close();
    });

    test('should handle connection failure gracefully', async () => {
      // Try to connect to invalid address
      await expect(UsbMuxConnection.create('127.0.0.1:9999')).rejects.toThrow();
    });
  });

  describe('Device Discovery Tests', () => {
    test('should list connected devices', async () => {
      const devices = await listDevices();

      console.log(`Found ${devices.length} device(s)`);

      if (devices.length === 0) {
        console.warn('⚠️  No devices found. Please connect an iOS device via USB.');
        console.warn('   Ensure iTunes AMDS is running on Windows or usbmuxd on Linux/macOS.');
      }

      expect(Array.isArray(devices)).toBe(true);

      for (const device of devices) {
        expect(device).toHaveProperty('devid');
        expect(device).toHaveProperty('serial');
        expect(device).toHaveProperty('connectionType');
        expect(['USB', 'Network']).toContain(device.connectionType);

        console.log('Device:', {
          UDID: device.serial,
          DeviceID: device.devid,
          Connection: device.connectionType,
        });
      }
    });

    test('should select device by UDID', async () => {
      const devices = await listDevices();

      if (devices.length === 0) {
        console.warn('⚠️  Skipping test: No devices connected');
        return;
      }

      const udid = devices[0].serial;
      const selected = await selectDevice(udid);

      expect(selected).toBeDefined();
      expect(selected!.serial.replace(/-/g, '')).toBe(udid.replace(/-/g, ''));
    });

    test('should select device by connection type', async () => {
      const usbDevice = await selectDevice(undefined, 'USB');

      if (usbDevice) {
        expect(usbDevice.connectionType).toBe('USB');
        console.log('Found USB device:', usbDevice.serial);
      } else {
        console.warn('⚠️  No USB device found');
      }

      const networkDevice = await selectDevice(undefined, 'Network');

      if (networkDevice) {
        expect(networkDevice.connectionType).toBe('Network');
        console.log('Found Network device:', networkDevice.serial);
      } else {
        console.warn('⚠️  No Network device found (this is normal for USB-only connections)');
      }
    });
  });

  describe('Port Connection Tests', () => {
    test('should connect to device lockdown port (62078)', async () => {
      const mux = await UsbMuxConnection.create();

      try {
        const devices = await mux.listDevices();

        if (devices.length === 0) {
          console.warn('⚠️  Skipping test: No devices connected');
          return;
        }

        const device = devices[0];
        console.log(`Connecting to device ${device.serial} on port 62078...`);

        // Connect to lockdown service (port 62078)
        const socket = await mux.connectDevice(device.devid, 62078);

        expect(socket).toBeDefined();
        expect(socket.destroyed).toBe(false);

        console.log('✅ Successfully connected to lockdown port');

        socket.destroy();
      } finally {
        await mux.close();
      }
    }, 15000); // 15 seconds timeout for real device connection
  });

  describe('System BUID Tests', () => {
    test('should get system BUID', async () => {
      const mux = await UsbMuxConnection.create();

      try {
        // Cast to PlistMuxConnection to access getBuid
        const { PlistMuxConnection } = await import('../src/usbmux/PlistMuxConnection');
        if (mux instanceof PlistMuxConnection) {
          const buid = await mux.getBuid();

          expect(typeof buid).toBe('string');
          expect(buid.length).toBeGreaterThan(0);

          console.log('System BUID:', buid);
        }
      } finally {
        await mux.close();
      }
    });
  });
});

/**
 * Manual test execution
 * Run with: npx jest tests/usbmux.test.ts
 */
