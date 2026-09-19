import { AuthModule as PackagedAuthModule } from '@nest-boot/auth';
import { MODULE_METADATA } from '@nestjs/common/constants';

import { AuthModule } from './auth.module.js';

describe('AuthModule', () => {
  it('can be imported with real ESM auth dependencies', () => {
    expect(AuthModule).toBeDefined();
  });

  it('uses packaged resolvers without application-owned resolver providers', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: PackagedAuthModule }),
      ]),
    );
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) ?? [],
    ).toEqual([]);
  });
});
