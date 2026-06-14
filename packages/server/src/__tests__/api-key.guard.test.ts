import { ApiKeyGuard } from '../common/api-key.guard';

describe('ApiKeyGuard', () => {
  const makeCtx = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers, query }) }),
  }) as any;

  it('allows all when API_KEY not set', () => {
    delete process.env.API_KEY;
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(makeCtx())).toBe(true);
  });

  it('rejects request with wrong key', () => {
    process.env.API_KEY = 'secret';
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(makeCtx({ 'x-api-key': 'wrong' }))).toThrow();
  });

  it('allows request with correct header key', () => {
    process.env.API_KEY = 'secret';
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(makeCtx({ 'x-api-key': 'secret' }))).toBe(true);
  });

  it('allows request with correct query key', () => {
    process.env.API_KEY = 'secret';
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(makeCtx({}, { api_key: 'secret' }))).toBe(true);
  });

  afterAll(() => delete process.env.API_KEY);
});
