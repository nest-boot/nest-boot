import { AuthModule as BaseAuthModule } from '@nest-boot/auth';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { genericOAuth } from 'better-auth/plugins';

import { User } from '../user/user.entity.js';
import { AuthGuard } from './auth.guard.js';
import { Account } from './entities/account.entity.js';
import { Session } from './entities/session.entity.js';
import { Verification } from './entities/verification.entity.js';
import { RowLevelSecurityInterceptor } from './row-level-security.interceptor.js';

/**
 * 应用认证模块。
 */
@Module({
  imports: [
    BaseAuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        trustedOrigins: ['*'],
        entities: {
          user: User,
          account: Account,
          session: Session,
          verification: Verification,
        },
        emailAndPassword: {
          enabled: true,
        },
        plugins: [
          genericOAuth({
            config: [
              {
                providerId: 'oidc',
                clientId: configService.getOrThrow('AUTH_OIDC_ID'),
                clientSecret: configService.getOrThrow('AUTH_OIDC_SECRET'),
                discoveryUrl: configService.getOrThrow(
                  'AUTH_OIDC_DISCOVERY_URL',
                ),
                prompt: 'login',
                scopes: ['openid', 'profile', 'email'],
              },
            ],
          }),
        ],
      }),
    }),
  ],
  providers: [
    AuthGuard,
    RowLevelSecurityInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RowLevelSecurityInterceptor,
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
