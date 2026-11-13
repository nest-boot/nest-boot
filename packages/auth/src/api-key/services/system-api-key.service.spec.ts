import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  apiKeyTest,
  createService,
  createTestUser,
} from "../../../test/fixtures/api-key-service.fixture.js";
import {
  createTestApiKeyService,
  createTestAuthContext,
} from "../../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { SystemAccountService } from "../../admin/services/system-account.service.js";
import { Session } from "../../core/entities/session.entity.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { SystemApiKeyService } from "./system-api-key.service.js";

/**
 * Builds a human administrator with a field-level credential restriction.
 * @param field - Field the administrator cannot write.
 * @returns Services and persistence mocks for a credential creation request.
 */
function fixture(field: string) {
  const { em, authorization } = createService();
  authorization.authorize.mockRestore();
  const user = Object.assign(createTestUser(), { roles: ["admin"] });
  RequestContext.set(User, user);
  RequestContext.set(Session, Object.assign(new Session(), { user }));
  const options = withAuthTestFeatures({
    buildAbility: ({ cannot }) => {
      cannot("write", SystemApiKey, [field]);
    },
  } satisfies AuthModuleOptions);
  createTestAuthContext(em, options).refresh();
  const account = Object.assign(new SystemAccount(), {
    name: "Account",
    enabled: true,
    permissions: ["user:read"],
  });
  em.findOne.mockResolvedValue(account);
  return {
    em,
    account,
    service: new SystemApiKeyService(
      em,
      options,
      createTestApiKeyService(em, options),
      new SystemAccountService(em, options),
    ),
  };
}

for (const field of ["name", "permissions", "expiresAt", "prefix"]) {
  apiKeyTest(
    `rejects ${field} restrictions before persisting a system key`,
    async () => {
      const { em, account, service } = fixture(field);
      await expect(
        service.createSystemApiKey({
          systemAccountId: account.id,
          name: "Denied",
          permissions: ["user:read"],
          expiresAt: new Date(Date.now() + 60_000),
          prefix: "custom_",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.persist.mock.calls).toHaveLength(0);
      expect(em.flush.mock.calls).toHaveLength(0);
    },
  );
}

for (const field of ["expiresAt", "prefix"]) {
  apiKeyTest(
    `allows the server default when restricted ${field} is omitted`,
    async () => {
      const { account, service } = fixture(field);
      const created = await service.createSystemApiKey({
        systemAccountId: account.id,
        name: "Default",
        permissions: ["user:read"],
      });
      expect(created.entity.expiresAt).toBeNull();
      expect(created.entity.prefix).toBe("sys_");
    },
  );
}

apiKeyTest("checks an explicitly null expiration before creation", async () => {
  const { em, account, service } = fixture("expiresAt");
  await expect(
    service.createSystemApiKey({
      systemAccountId: account.id,
      name: "Unlimited",
      expiresAt: null,
    }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(em.persist.mock.calls).toHaveLength(0);
});
