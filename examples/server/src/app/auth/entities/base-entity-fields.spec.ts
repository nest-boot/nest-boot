import { MetadataStorage } from '@mikro-orm/core';
import {
  Account,
  ApiKey,
  entities,
  Invitation,
  Member,
  Session,
  User,
  Verification,
  Workspace,
} from '@nest-boot/auth';

describe('built-in auth entity field ownership', () => {
  it.each([
    [User, 'members', Member, { mappedBy: 'user' }],
    [Workspace, 'members', Member, { mappedBy: 'workspace' }],
    [Member, 'user', User, { deleteRule: 'cascade' }],
    [Member, 'workspace', Workspace, { deleteRule: 'cascade' }],
    [Invitation, 'inviter', User, { deleteRule: 'cascade' }],
    [Invitation, 'workspace', Workspace, { deleteRule: 'cascade' }],
    [ApiKey, 'user', User, { nullable: true, deleteRule: 'cascade' }],
    [ApiKey, 'workspace', Workspace, { nullable: true, deleteRule: 'cascade' }],
    [Account, 'user', User, { ref: true, deleteRule: 'cascade' }],
    [Session, 'user', User, { ref: true, deleteRule: 'cascade' }],
    [
      Session,
      'impersonatedBy',
      User,
      { nullable: true, deleteRule: 'cascade' },
    ],
  ] as const)(
    '%s.%s targets the built-in class',
    (entity, field, target, options) => {
      const metadata = Object.values(MetadataStorage.getMetadata());
      const property = metadata.find((meta) => meta.class === entity)
        ?.properties[field];
      expect(property).toMatchObject(options);
      if (typeof property?.entity !== 'function')
        throw new Error('Missing class relation');
      expect(property.entity()).toBe(target);
    },
  );

  it.each([
    [Account, ['issuer', 'accountId', 'user']],
    [ApiKey, ['user', 'workspace', 'permissions']],
    [Session, ['user', 'token', 'expiresAt']],
    [User, ['name', 'email', 'members']],
    [Verification, ['identifier', 'value']],
    [Workspace, ['name', 'members']],
    [Invitation, ['email', 'workspace', 'inviter']],
    [Member, ['name', 'email', 'user', 'workspace']],
  ] as const)('%s owns its persistence fields', (entity, fields) => {
    expect(entities).toContain(entity);
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === entity,
    );
    expect(metadata?.abstract).not.toBe(true);
    for (const field of fields)
      expect(metadata?.properties).toHaveProperty(field);
  });
});
