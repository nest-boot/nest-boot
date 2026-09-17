import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import {
  Account,
  entities,
  Invitation,
  Member,
  Session,
  User,
  UserApiKey,
  Workspace,
  WorkspaceApiKey,
} from '@nest-boot/auth';

describe('built-in auth entity discovery', () => {
  it('discovers concrete relations without AuthModule initialization or application entity declarations', async () => {
    const orm = new MikroORM({
      dbName: 'auth_entity_relations',
      driver: PostgreSqlDriver,
      entities,
    });
    try {
      for (const entity of entities) {
        const metadata = orm.getMetadata<object>(entity);
        expect(metadata.abstract).not.toBe(true);
        expect(metadata.policies?.length).toBeGreaterThan(0);
      }
      for (const [entity, property, target] of [
        [User, 'members', Member],
        [Workspace, 'members', Member],
        [Member, 'user', User],
        [Member, 'workspace', Workspace],
        [Invitation, 'inviter', User],
        [Invitation, 'workspace', Workspace],
        [Account, 'user', User],
        [Session, 'user', User],
        [Session, 'impersonatedBy', User],
        [UserApiKey, 'user', User],
        [WorkspaceApiKey, 'workspace', Workspace],
      ] as const) {
        expect(
          orm.getMetadata<object>(entity).properties[property].targetMeta
            ?.class,
        ).toBe(target);
      }
    } finally {
      await orm.close();
    }
  });
});
