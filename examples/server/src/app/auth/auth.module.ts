import {
  AuthModule as BaseAuthModule,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from '@nest-boot/auth';
import { Mailer } from '@nest-boot/mailer';
import { RequestContext } from '@nest-boot/request-context';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import {
  buildUserPermissionAbility,
  buildWorkspacePermissionAbility,
} from '../../common/modules/utils/build-permission-ability.util.js';
import { ApiKey } from '../api-key/api-key.entity.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceInvitation } from '../workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { AuthResolver } from './auth.resolver.js';
import { Account } from './entities/account.entity.js';
import { Session } from './entities/session.entity.js';
import { Verification } from './entities/verification.entity.js';
import { RowLevelSecurityInterceptor } from './row-level-security.interceptor.js';
import { UserResolver } from './user.resolver.js';

/**
 * 应用认证模块。
 */
@Module({
  imports: [
    BaseAuthModule.forRoot({
      trustedOrigins: [process.env.APP_URL ?? 'http://localhost:3000'],
      entities: {
        user: User,
        account: Account,
        session: Session,
        verification: Verification,
        workspace: Workspace,
        workspaceInvitation: WorkspaceInvitation,
        workspaceMember: WorkspaceMember,
        apiKey: ApiKey,
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      user: {
        permissions: [
          ...DEFAULT_USER_PERMISSIONS,
          'ApiKey:read',
          'ApiKey:create',
          'ApiKey:update',
          'ApiKey:delete',
        ],
        roles: {
          user: [
            'ApiKey:read',
            'ApiKey:create',
            'ApiKey:update',
            'ApiKey:delete',
          ],
          admin: [
            ...DEFAULT_USER_ROLES.admin,
            'ApiKey:read',
            'ApiKey:create',
            'ApiKey:update',
            'ApiKey:delete',
          ],
        },
        buildAbility: (builder, permissions, _user) =>
          buildUserPermissionAbility(builder, permissions),
        changeEmail: {
          enabled: true,
        },
        deleteUser: {
          enabled: true,
        },
      },
      workspace: {
        permissions: [
          ...DEFAULT_WORKSPACE_PERMISSIONS,
          'ApiKey:read',
          'ApiKey:create',
          'ApiKey:update',
          'ApiKey:delete',
        ],
        roles: {
          ...DEFAULT_WORKSPACE_ROLES,
          owner: [
            ...DEFAULT_WORKSPACE_ROLES.owner,
            'ApiKey:read',
            'ApiKey:create',
            'ApiKey:update',
            'ApiKey:delete',
          ] as const,
        },
        buildAbility: (builder, permissions, _workspace) =>
          buildWorkspacePermissionAbility(builder, permissions),
        sendInvitationEmail: async ({ email, id, inviter, workspace }) => {
          const url = new URL(
            '/invite',
            process.env.APP_URL ?? 'http://localhost:3000',
          );
          url.searchParams.set('invitationId', id);

          const mailer = RequestContext.get(Mailer);
          if (!mailer) throw new Error('Mailer is unavailable');

          await mailer.sendMail({
            to: email,
            subject: `Invitation to join ${workspace.name}`,
            text: `${inviter.user.name} invited you to join ${workspace.name}: ${url.toString()}`,
          });
        },
      },
    }),
  ],
  providers: [
    AuthResolver,
    UserResolver,
    RowLevelSecurityInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RowLevelSecurityInterceptor,
    },
  ],
})
export class AuthModule {}
