import {
  AuthModule as BaseAuthModule,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from '@nest-boot/auth';
import { Mailer } from '@nest-boot/mailer';
import { RequestContext } from '@nest-boot/request-context';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import {
  buildUserPermissionAbility,
  buildWorkspaceMemberPermissionAbility,
} from '../../common/modules/utils/build-workspace-member-permission-ability.util.js';
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
        buildAbility: (_context, permissions) =>
          buildUserPermissionAbility(permissions),
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
          'apiKey:read',
          'apiKey:create',
          'apiKey:update',
          'apiKey:delete',
        ],
        roles: {
          ...DEFAULT_WORKSPACE_ROLES,
          owner: [
            ...DEFAULT_WORKSPACE_ROLES.owner,
            'apiKey:read',
            'apiKey:create',
            'apiKey:update',
            'apiKey:delete',
          ] as const,
        },
        buildAbility: (_context, permissions) => {
          const workspaceMember = RequestContext.get(WorkspaceMember);

          return buildWorkspaceMemberPermissionAbility(
            permissions,
            workspaceMember,
          );
        },
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
