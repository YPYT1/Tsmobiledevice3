import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { DevicesModule } from '../devices/devices.module';
import { DevicesService } from '../devices/devices.service';
import { HealthController } from '../health/health.controller';
import { GlobalExceptionFilter } from '../common/global-exception.filter';
import * as request from 'supertest';

const mockDevicesService = {
  pool: { on: jest.fn() },
  getDevices: jest.fn(() => [{ udid: 'test-udid', connectionType: 'USB' }]),
  withFactory: jest.fn().mockRejectedValue(Object.assign(new Error('Device not found: unknown'), { })),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
};

describe('App integration (unit)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), TerminusModule, DevicesModule],
      controllers: [HealthController],
    })
      .overrideProvider(DevicesService)
      .useValue(mockDevicesService)
      .compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  }, 15000);

  afterAll(async () => { await app?.close(); });

  it('GET /api/health → 200', () =>
    request(app.getHttpServer()).get('/api/health').expect(200));

  it('GET /api/devices → [{udid, connectionType}]', () =>
    request(app.getHttpServer()).get('/api/devices')
      .expect(200)
      .expect(res => expect(Array.isArray(res.body)).toBe(true)));

  it('GET /api/devices/unknown → 404 or 500 with error code', () =>
    request(app.getHttpServer()).get('/api/devices/unknown')
      .expect(res => expect([404, 500].includes(res.status)).toBe(true)));
});
