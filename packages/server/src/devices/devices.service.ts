import { Injectable, OnModuleInit, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import {
  DevicePool,
  LockdownService,
  ServiceFactory,
} from '@tsmobiledevice/core';

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  pool!: DevicePool;

  async onModuleInit() {
    this.pool = await DevicePool.connect();
  }

  async onModuleDestroy() {
    await this.pool.close();
  }

  getDevices() {
    return this.pool.getDevices().map(d => ({ udid: d.serial, connectionType: d.connectionType }));
  }

  private getDevice(udid: string) {
    const device = this.pool.getDevice(udid);
    if (!device) throw new NotFoundException(`Device not found: ${udid}`);
    return device;
  }

  async getLockdown(udid: string): Promise<LockdownService> {
    this.getDevice(udid); // validate exists
    return LockdownService.create(udid);
  }

  async withFactory<T>(udid: string, fn: (factory: ServiceFactory, lockdown: LockdownService) => Promise<T>): Promise<T> {
    const lockdown = await this.getLockdown(udid);
    const factory = new ServiceFactory(lockdown);
    try {
      return await fn(factory, lockdown);
    } finally {
      await lockdown.close();
    }
  }
}
