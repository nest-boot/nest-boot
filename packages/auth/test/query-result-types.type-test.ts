import { expectTypeOf } from "vitest";

import type { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import type { SystemApiKey } from "../src/api-key/entities/system-api-key.entity.js";
import type { UserApiKey } from "../src/api-key/entities/user-api-key.entity.js";
import type { WorkspaceApiKey } from "../src/api-key/entities/workspace-api-key.entity.js";
import type { SystemApiKeyService } from "../src/api-key/services/system-api-key.service.js";
import type { UserApiKeyService } from "../src/api-key/services/user-api-key.service.js";
import type { WorkspaceApiKeyService } from "../src/api-key/services/workspace-api-key.service.js";
import type { ApiKeyMetadata } from "../src/api-key/types/api-key-metadata.type.js";
import type { AccountService } from "../src/core/services/account.service.js";
import type { SessionService } from "../src/core/services/session.service.js";

describe("Credential-free query result types", () => {
  it("omits session tokens and account credentials from list result types", () => {
    type SessionNode = Awaited<
      ReturnType<SessionService["getSessionConnectionByUser"]>
    >["edges"][number]["node"];
    type AccountNode = Awaited<
      ReturnType<AccountService["getAccountConnectionByUser"]>
    >["edges"][number]["node"];
    expectTypeOf<SessionNode>().not.toHaveProperty("token");
    expectTypeOf<AccountNode>().not.toHaveProperty("password");
    expectTypeOf<AccountNode>().not.toHaveProperty("accessToken");
    expectTypeOf<AccountNode>().not.toHaveProperty("refreshToken");
    expectTypeOf<AccountNode>().not.toHaveProperty("idToken");
  });

  it("omits credential hashes from user-key reads and mutations", () => {
    type Service = UserApiKeyService;
    type Result = ApiKeyMetadata<UserApiKey>;
    expectTypeOf<
      Awaited<ReturnType<Service["getUserApiKey"]>>
    >().toEqualTypeOf<Result | null>();
    expectTypeOf<
      Awaited<ReturnType<Service["updateUserApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<ReturnType<Service["deleteUserApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<
        ReturnType<Service["getUserApiKeyConnection"]>
      >["edges"][number]["node"]
    >().toEqualTypeOf<Result>();
    expectTypeOf<Result>().not.toHaveProperty("key");
    expectTypeOf<Result["user"]>().toEqualTypeOf<UserApiKey["user"]>();
  });

  it("omits credential hashes from member-key reads and mutations", () => {
    type Service = WorkspaceApiKeyService;
    type Result = ApiKeyMetadata<WorkspaceApiKey>;
    expectTypeOf<
      Awaited<ReturnType<Service["getWorkspaceApiKey"]>>
    >().toEqualTypeOf<Result | null>();
    expectTypeOf<
      Awaited<ReturnType<Service["updateWorkspaceApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<ReturnType<Service["deleteWorkspaceApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<
        ReturnType<Service["getWorkspaceApiKeyConnection"]>
      >["edges"][number]["node"]
    >().toEqualTypeOf<Result>();
    expectTypeOf<Result>().not.toHaveProperty("key");
    expectTypeOf<Result["member"]>().toEqualTypeOf<WorkspaceApiKey["member"]>();
    expectTypeOf<Result["member"]>().not.toBeNullable();
  });

  it("omits hashes from system-key management results and retains the system owner", () => {
    type Service = SystemApiKeyService;
    type Result = ApiKeyMetadata<SystemApiKey>;
    expectTypeOf<
      Awaited<ReturnType<Service["getSystemApiKey"]>>
    >().toEqualTypeOf<Result | null>();
    expectTypeOf<
      Awaited<ReturnType<Service["updateSystemApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<ReturnType<Service["deleteSystemApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<
        ReturnType<Service["getSystemApiKeyConnection"]>
      >["edges"][number]["node"]
    >().toEqualTypeOf<Result>();
    expectTypeOf<Result>().not.toHaveProperty("key");
    expectTypeOf<Result["systemAccount"]>().not.toBeNullable();
  });

  it("preserves scoped ownership variants and accepts full authenticated entities", () => {
    expectTypeOf<ApiKeyMetadata>().toEqualTypeOf<Omit<ApiKey, "key">>();
    expectTypeOf<ApiKey>().toExtend<ApiKeyMetadata>();
    expectTypeOf<
      Awaited<ReturnType<UserApiKeyService["createUserApiKey"]>>["entity"]
    >().toEqualTypeOf<UserApiKey>();
    expectTypeOf<
      Awaited<
        ReturnType<WorkspaceApiKeyService["createWorkspaceApiKey"]>
      >["entity"]
    >().toEqualTypeOf<WorkspaceApiKey>();
  });
});
