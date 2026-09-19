import { AuthGuard } from '@nest-boot/auth';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CommonModule } from '../common/common.module.js';
import { AuthModule } from './auth/auth.module.js';

/** 服务端根模块。 */
@Module({
  imports: [CommonModule, AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
  ],
})
export class AppModule {}
