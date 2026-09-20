import type { EntityManager } from '@mikro-orm/core';
import {
  AccessControlService,
  API_KEY,
  AuthGuard,
  AuthResolver,
  type AuthService,
  Member,
  User,
  UserApiKey,
  Workspace,
  WorkspaceApiKeyService,
} from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { type ModuleRef, Reflector } from '@nestjs/core';

import { Report } from './report.js';
import { ReportService } from './report.service.js';
import { reportAuthOptions } from './report-auth.options.js';

// Exercise the real client helper without adding client sources to the server's TS root.
const { createAbility, createAbilitySubject } = (await import(
  new URL('../../../../../client/src/lib/ability.ts', import.meta.url).href
)) as {
  createAbility(rules: object[]): {
    can(action: string, subject: object): boolean;
  };
  createAbilitySubject(type: string, value: object): object;
};

describe('business authorization recipe', () => {
  it.each([
    { role: 'owner', direct: [], key: undefined, archive: true },
    { role: 'report-reader', direct: [], key: undefined, archive: false },
    {
      role: 'member',
      direct: ['report:archive'],
      key: undefined,
      archive: true,
    },
    { role: 'owner', direct: [], key: ['report:read'], archive: false },
    { role: 'owner', direct: [], key: [], archive: false },
  ])(
    'keeps frontend and Service decisions aligned for $role with key $key',
    async ({ role, direct, key, archive }) => {
      await RequestContext.run(
        new RequestContext({ type: 'authorization-example' }),
        async () => {
          const workspace = Object.assign(new Workspace(), {
            id: 'workspace-1',
          });
          const user = Object.assign(new User(), {
            id: 'user-1',
            roles: ['user'],
            permissions: [],
          });
          RequestContext.set(User, user);
          RequestContext.set(Workspace, workspace);
          RequestContext.set(
            Member,
            Object.assign(new Member(), {
              workspace,
              user,
              roles: [role],
              permissions: direct,
              status: 'ACTIVE',
            }),
          );
          if (key !== undefined)
            RequestContext.set(
              API_KEY,
              Object.assign(new UserApiKey(), { user, permissions: key }),
            );
          const access = new AccessControlService(reportAuthOptions);
          RequestContext.set(AccessControlService, access);
          // Production requests are prepared by AuthGuard; manually prepare only this isolated test.
          new AuthGuard(
            new Reflector(),
            reportAuthOptions,
            {} as ModuleRef,
            access,
          ).refreshAbility();
          const report = new Report('report-1', workspace.id);
          const repository = {
            findOne: vi.fn(async (id: string) =>
              id === report.id ? report : null,
            ),
            archive: vi.fn(
              async (value: Report) =>
                new Report(value.id, value.workspaceId, true),
            ),
          };
          const service = new ReportService(repository, access);
          const rules = new AuthResolver(
            {} as AuthService,
          ).currentAbilityRules();
          const frontend = createAbility(rules);
          expect(
            frontend.can('archive', createAbilitySubject('Report', report)),
          ).toBe(archive);
          const canRead =
            role !== 'member' &&
            (key === undefined || key.includes('report:read'));
          expect(
            frontend.can('read', createAbilitySubject('Report', report)),
          ).toBe(canRead);
          if (canRead)
            await expect(service.getReport(report.id)).resolves.toBe(report);
          else
            await expect(service.getReport(report.id)).rejects.toThrow(
              ForbiddenException,
            );
          if (archive) {
            await expect(
              service.archiveReport(report.id),
            ).resolves.toMatchObject({ archived: true });
          } else {
            await expect(service.archiveReport(report.id)).rejects.toThrow(
              ForbiddenException,
            );
            expect(repository.archive).not.toHaveBeenCalled();
          }
          // Class-level route checks cannot replace checks against loaded object conditions.
          const writes = repository.archive.mock.calls.length;
          expect(
            frontend.can(
              'archive',
              createAbilitySubject(
                'Report',
                new Report(report.id, 'another-workspace'),
              ),
            ),
          ).toBe(false);
          repository.findOne.mockResolvedValue(
            new Report(report.id, 'another-workspace'),
          );
          await expect(service.archiveReport(report.id)).rejects.toThrow(
            ForbiddenException,
          );
          repository.findOne.mockResolvedValue(
            new Report(report.id, workspace.id, true),
          );
          expect(
            frontend.can(
              'archive',
              createAbilitySubject(
                'Report',
                new Report(report.id, workspace.id, true),
              ),
            ),
          ).toBe(false);
          await expect(service.archiveReport(report.id)).rejects.toThrow(
            ForbiddenException,
          );
          repository.findOne.mockResolvedValue(null);
          expect(repository.archive).toHaveBeenCalledTimes(writes);
          await expect(service.getReport('missing')).rejects.toThrow(
            NotFoundException,
          );

          const catalog = new WorkspaceApiKeyService(
            {} as EntityManager,
            reportAuthOptions,
            access,
          ).getWorkspaceApiKeyPermissions(workspace);
          const read = catalog.find(
            (option) => option.permission === 'report:read',
          );
          expect(read?.default).toBe(true);
          expect(read?.grantable).toBe(
            role !== 'member' &&
              (key === undefined || key.includes('report:read')),
          );
        },
      );
    },
  );
});
