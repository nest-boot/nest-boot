import { AuthModule } from './auth.module.js';

describe('AuthModule', () => {
  it('can be imported with real ESM auth dependencies', () => {
    expect(AuthModule).toBeDefined();
  });
});
