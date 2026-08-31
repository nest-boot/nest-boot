import { EntityManager } from '@mikro-orm/postgresql';
import { CryptService } from '@nest-boot/crypt';
import { Logger } from '@nest-boot/logger';
import { RequestContext } from '@nest-boot/request-context';
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from '@nest-boot/row-level-security';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Mocked } from 'vitest';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from '../workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
import { ApiKey } from './api-key.entity.js';
import { ApiKeyService } from './api-key.service.js';

describe('ApiKeyService', () => {
  it('creates an old-format API key for a workspace member', async () => {
    const { service, em, cryptService, createdEntities } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = {
      id: 'member_1',
      workspace,
    } as unknown as WorkspaceMember;

    const result = await service.createKey(member, {
      name: 'Deploy key',
    });

    expect(result.apiKey).toMatch(/^sk-[0-9a-f]{32}$/);
    const keyId = result.apiKey.slice(3, 19);
    const secret = result.apiKey.slice(19);
    expect(keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(secret).toMatch(/^[0-9a-f]{16}$/);
    expect(cryptService.encrypt).toHaveBeenCalledWith(secret);
    expect(em.create).toHaveBeenCalledWith(
      ApiKey,
      expect.objectContaining({
        name: 'Deploy key',
        member,
        workspace,
        keyPrefix: 'sk-',
        keyId,
        encryptedSecret: 'encrypted-secret',
      }),
    );
    expect(JSON.stringify(createdEntities[0])).not.toContain(result.apiKey);
    expect(JSON.stringify(createdEntities[0])).not.toContain(secret);
  });

  it('rejects API key creation for disabled members', async () => {
    const { service, em } = createService();

    await expect(
      service.createKey(
        {
          status: WorkspaceMemberStatus.DISABLED,
        } as WorkspaceMember,
        {
          name: 'Deploy key',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(em.create).not.toHaveBeenCalled();
  });

  it('rejects API key creation with past expiration', async () => {
    const { service, em } = createService();

    await expect(
      service.createKey({} as WorkspaceMember, {
        name: 'Deploy key',
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(em.create).not.toHaveBeenCalled();
  });

  it('rejects missing and unknown API keys during validation', async () => {
    const { service } = createService();
    vi.spyOn(service as any, 'findValidationRow').mockResolvedValue(null);

    await expect(service.validate('')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed API keys during validation', async () => {
    const { service } = createService();
    const findValidationRow = vi.spyOn(service as any, 'findValidationRow');

    await expect(service.validate('nb_missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(findValidationRow).not.toHaveBeenCalled();
  });

  it('rejects expired API keys during validation', async () => {
    const { service } = createService();
    vi.spyOn(service as any, 'findValidationRow').mockResolvedValue({
      ...validationRow(),
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects API keys for disabled workspace members', async () => {
    const { service } = createService();
    vi.spyOn(service as any, 'findValidationRow').mockResolvedValue({
      ...validationRow(),
      memberStatus: WorkspaceMemberStatus.DISABLED,
    });

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validates old-format API keys through EntityService lookup', async () => {
    const apiKey = createApiKeyEntity();
    const workspaceMember = createWorkspaceMember();
    const workspace = { id: 'workspace_1' } as Workspace;
    const { service, em, cryptService, workspaceMemberService } = createService(
      {
        workspaceMember,
        workspace,
      },
    );
    const findOne = vi
      .spyOn(service, 'findOne')
      .mockImplementation(async () => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);

        return apiKey;
      });
    workspaceMemberService.findOne.mockImplementation(async () => {
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);

      return workspaceMember;
    });

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);

      await expect(
        service.validate('sk-0123456789abcdefabcdef0123456789'),
      ).resolves.toEqual({
        apiKey,
        workspace,
        workspaceMember,
      });

      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.ENABLED);
    });

    expect(findOne).toHaveBeenCalledWith({
      keyId: '0123456789abcdef',
    });
    expect(cryptService.decrypt).toHaveBeenCalledWith(apiKey.encryptedSecret);
    expect(workspaceMemberService.findOne).toHaveBeenCalledWith({
      id: 'member_1',
      workspace: {
        id: 'workspace_1',
      },
    });
    expect(em.findOneOrFail).toHaveBeenCalledWith(Workspace, {
      id: 'workspace_1',
    });
    expect(em.getKnex).not.toHaveBeenCalled();
  });

  it('rejects disabled API keys through EntityService lookup', async () => {
    const apiKey = createApiKeyEntity({
      memberStatus: WorkspaceMemberStatus.DISABLED,
    });
    const { service, em, workspaceMemberService } = createService({
      workspaceMember: createWorkspaceMember({
        status: WorkspaceMemberStatus.DISABLED,
      }),
    });
    vi.spyOn(service, 'findOne').mockResolvedValue(apiKey);

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(service.findOne).toHaveBeenCalledWith({
      keyId: '0123456789abcdef',
    });
    expect(workspaceMemberService.findOne).toHaveBeenCalledTimes(1);
    expect(em.getKnex).not.toHaveBeenCalled();
  });

  it('rejects API keys when the decrypted secret does not match', async () => {
    const apiKey = createApiKeyEntity();
    const { service, workspaceMemberService } = createService({
      decryptedSecret: '0000000000000000',
    });
    vi.spyOn(service, 'findOne').mockResolvedValue(apiKey);

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(workspaceMemberService.findOne).not.toHaveBeenCalled();
  });

  it('validates valid API keys without touching last used time', async () => {
    const { service } = createService();
    const apiKey = createApiKeyEntity();
    const workspaceMember = createWorkspaceMember();
    const workspace = { id: 'workspace_1' } as Workspace;
    const update = vi.spyOn(service, 'update');
    vi.spyOn(service as any, 'findValidationRow').mockResolvedValue(
      validationRow({ apiKey, workspace, workspaceMember }),
    );

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).resolves.toEqual({
      apiKey,
      workspace,
      workspaceMember,
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('validates selected workspace API keys without direct knex access', async () => {
    const apiKey = createApiKeyEntity();
    const workspaceMember = createWorkspaceMember();
    const { service, em } = createService();
    vi.spyOn(service as any, 'findValidationRow').mockResolvedValue(
      validationRow({ apiKey, workspaceMember }),
    );

    await expect(
      service.validate('sk-0123456789abcdefabcdef0123456789'),
    ).resolves.toMatchObject({
      apiKey,
      workspaceMember,
    });

    expect(em.getKnex).not.toHaveBeenCalled();
  });

  it('updates API key names only when a name is provided', async () => {
    const { service, em } = createService();
    const apiKey = { name: 'Old' } as ApiKey;

    await expect(service.updateName(apiKey, undefined)).resolves.toBe(apiKey);
    expect(apiKey.name).toBe('Old');

    await expect(service.updateName(apiKey, 'New')).resolves.toBe(apiKey);
    expect(apiKey.name).toBe('New');
    expect(em.flush).toHaveBeenCalledTimes(2);
  });

  it('records API key usage time after authentication succeeds', async () => {
    const { service, em } = createService();
    const apiKey = {} as ApiKey;

    await expect(service.recordUsage(apiKey)).resolves.toBe(apiKey);

    expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
    expect(apiKey.updatedAt).toBeInstanceOf(Date);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});

function createService(
  overrides: Partial<Mocked<EntityManager>> & {
    decryptedSecret?: string;
    workspace?: Workspace;
    workspaceMember?: WorkspaceMember | null;
  } = {},
) {
  const createdEntities: unknown[] = [];
  const workspaceMember =
    overrides.workspaceMember === undefined
      ? createWorkspaceMember()
      : overrides.workspaceMember;
  const {
    decryptedSecret,
    workspace,
    workspaceMember: _workspaceMember,
    ...emOverrides
  } = overrides;
  const workspaceMemberService = {
    findOne: vi.fn(async () => workspaceMember),
  } as unknown as Mocked<WorkspaceMemberService>;
  const cryptService = {
    encrypt: vi.fn(async () => 'encrypted-secret'),
    decrypt: vi.fn(async () => decryptedSecret ?? 'abcdef0123456789'),
  } as unknown as Mocked<CryptService>;
  const em = {
    create: vi.fn((_entity, data) => data),
    getKnex: vi.fn(() => ({
      raw: vi.fn(() => {
        throw new Error('knex.raw should not be used');
      }),
    })),
    persist: vi.fn((entity) => {
      createdEntities.push(entity);
      return em;
    }),
    findOneOrFail: vi.fn(async () => workspace),
    flush: vi.fn(),
    ...emOverrides,
  } as unknown as EntityManager & {
    create: Mock;
    getKnex: Mock;
    persist: Mock;
    findOneOrFail: Mock;
    flush: Mock;
  };
  const service = new ApiKeyService(
    em,
    { setContext: vi.fn(), log: vi.fn() } as unknown as Logger,
    cryptService,
    { get: vi.fn(() => 'sk-') } as unknown as ConfigService,
    workspaceMemberService,
  );

  return {
    service,
    em,
    cryptService,
    workspaceMemberService,
    createdEntities,
  };
}

function createWorkspaceMember(
  options: { status?: WorkspaceMemberStatus } = {},
) {
  return {
    id: 'member_1',
    status: options.status ?? WorkspaceMemberStatus.ACTIVE,
    workspace: {
      id: 'workspace_1',
    },
  } as unknown as WorkspaceMember;
}

function createApiKeyEntity(
  options: { memberStatus?: WorkspaceMemberStatus } = {},
) {
  return {
    id: 'api_key_1',
    name: 'Deploy key',
    keyId: '0123456789abcdef',
    keyPrefix: 'sk-',
    encryptedSecret: 'encrypted:abcdef0123456789',
    workspace: {
      id: 'workspace_1',
    },
    member: {
      id: 'member_1',
      status: options.memberStatus ?? WorkspaceMemberStatus.ACTIVE,
      loadOrFail: vi.fn(async () => ({
        id: 'member_1',
        status: options.memberStatus ?? WorkspaceMemberStatus.ACTIVE,
      })),
    },
    expiresAt: null,
  } as unknown as ApiKey;
}

function validationRow(
  options: {
    apiKey?: ApiKey;
    workspace?: Workspace;
    workspaceMember?: WorkspaceMember;
  } = {},
) {
  return {
    apiKey: options.apiKey ?? createApiKeyEntity(),
    workspace: options.workspace ?? ({ id: 'workspace_1' } as Workspace),
    workspaceMember: options.workspaceMember ?? createWorkspaceMember(),
    expiresAt: null,
    memberStatus: WorkspaceMemberStatus.ACTIVE,
  };
}
