import { AuthModule as BaseAuthModule } from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { bearer, genericOAuth } from 'better-auth/plugins';

import { buildWorkspaceMemberPermissionAbility } from '../../common/modules/utils/build-workspace-member-permission-ability.util.js';
import { ApiKey } from '../api-key/api-key.entity.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
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
          workspace: Workspace,
          workspaceMember: WorkspaceMember,
          apiKey: ApiKey,
        },
        emailAndPassword: {
          enabled: true,
        },
        buildAbility: () => {
          const workspaceMember = RequestContext.get(WorkspaceMember);
          const workspaceMemberService = RequestContext.get(
            WorkspaceMemberService,
          );
          const permissions =
            workspaceMember && workspaceMemberService
              ? workspaceMemberService.getPermissions(workspaceMember)
              : [];

          return buildWorkspaceMemberPermissionAbility(permissions);
        },
        plugins: [
          bearer(),
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
    RowLevelSecurityInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RowLevelSecurityInterceptor,
    },
  ],
})
export class AuthModule {}
