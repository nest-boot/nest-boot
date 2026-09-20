import { AuthModule as BaseAuthModule } from '@nest-boot/auth';
import { Mailer } from '@nest-boot/mailer';
import { RequestContext } from '@nest-boot/request-context';
import { Module } from '@nestjs/common';

/**
 * Application authentication module.
 */
@Module({
  imports: [
    BaseAuthModule.forRoot({
      trustedOrigins: [process.env.APP_URL ?? 'http://localhost:3000'],
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      user: {
        roles: {
          user: ['user-api-key:read', 'user-api-key:write'],
        },
        changeEmail: {
          enabled: true,
        },
        deleteUser: {
          enabled: true,
        },
      },
      workspace: {
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
            text: `${inviter.name} invited you to join ${workspace.name}: ${url.toString()}`,
          });
        },
      },
    }),
  ],
})
export class AuthModule {}
