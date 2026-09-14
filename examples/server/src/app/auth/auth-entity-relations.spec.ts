import { Entity } from '@mikro-orm/decorators/legacy';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from '@nest-boot/auth';

@Entity()
class PersonIdentity extends BaseUser {}

@Entity()
class TenantSpace extends BaseWorkspace {}

@Entity()
class IdentityAccount extends BaseAccount {}

@Entity()
class LoginSession extends BaseSession {}

@Entity()
class LoginVerification extends BaseVerification {}

@Entity()
class AccessTokenKey extends BaseApiKey {}

@Entity()
class TenantMember extends BaseWorkspaceMember {}

@Entity()
class TenantInvitation extends BaseWorkspaceInvitation {}

describe('auth entity relations', () => {
  it('discovers configured auth subclasses without conventional class names', async () => {
    const orm = new MikroORM({
      dbName: 'auth_entity_relations',
      driver: PostgreSqlDriver,
      entities: [
        PersonIdentity,
        TenantSpace,
        IdentityAccount,
        LoginSession,
        LoginVerification,
        AccessTokenKey,
        TenantMember,
        TenantInvitation,
      ],
    });

    try {
      const metadata = orm.getMetadata();

      expect(
        metadata.get(IdentityAccount).properties.userId.targetMeta?.class,
      ).toBe(PersonIdentity);
      expect(metadata.get(TenantMember).properties.user.targetMeta?.class).toBe(
        PersonIdentity,
      );
      expect(
        metadata.get(TenantMember).properties.workspace.targetMeta?.class,
      ).toBe(TenantSpace);
      expect(
        metadata.get(TenantInvitation).properties.inviter.targetMeta?.class,
      ).toBe(PersonIdentity);
      expect(
        metadata.get(TenantInvitation).properties.workspace.targetMeta?.class,
      ).toBe(TenantSpace);
    } finally {
      await orm.close(true);
    }
  });
});
