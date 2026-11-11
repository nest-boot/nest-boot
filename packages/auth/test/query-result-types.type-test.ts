import { expectTypeOf } from "vitest";

import type { ApiKeyEntity } from "../src/entities/api-key.entity.js";
import type { MemberApiKey } from "../src/entities/member-api-key.entity.js";
import type { SystemAccountApiKey } from "../src/entities/system-account-api-key.entity.js";
import type { UserApiKey } from "../src/entities/user-api-key.entity.js";
import type { AccountService } from "../src/services/account.service.js";
import type { SessionService } from "../src/services/session.service.js";
import type { SystemApiKeyService } from "../src/services/system-api-key.service.js";
import type { UserApiKeyService } from "../src/services/user-api-key.service.js";
import type { WorkspaceApiKeyService } from "../src/services/workspace-api-key.service.js";
import type { ApiKey } from "../src/types/api-key.type.js";
import type { ApiKeyMetadata } from "../src/types/api-key-metadata.type.js";

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
    type Result = ApiKeyMetadata<MemberApiKey>;
    expectTypeOf<
      Awaited<ReturnType<Service["getMemberApiKey"]>>
    >().toEqualTypeOf<Result | null>();
    expectTypeOf<
      Awaited<ReturnType<Service["updateMemberApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<ReturnType<Service["deleteMemberApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<
        ReturnType<Service["getMemberApiKeyConnection"]>
      >["edges"][number]["node"]
    >().toEqualTypeOf<Result>();
    expectTypeOf<Result>().not.toHaveProperty("key");
    expectTypeOf<Result["member"]>().toEqualTypeOf<MemberApiKey["member"]>();
    expectTypeOf<Result["member"]>().not.toBeNullable();
  });

  it("omits hashes from system-key management results and retains the system owner", () => {
    type Service = SystemApiKeyService;
    type Result = ApiKeyMetadata<SystemAccountApiKey>;
    expectTypeOf<
      Awaited<ReturnType<Service["getSystemAccountApiKey"]>>
    >().toEqualTypeOf<Result | null>();
    expectTypeOf<
      Awaited<ReturnType<Service["updateSystemAccountApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<ReturnType<Service["deleteSystemAccountApiKey"]>>
    >().toEqualTypeOf<Result>();
    expectTypeOf<
      Awaited<
        ReturnType<Service["getSystemAccountApiKeyConnection"]>
      >["edges"][number]["node"]
    >().toEqualTypeOf<Result>();
    expectTypeOf<Result>().not.toHaveProperty("key");
    expectTypeOf<Result["systemAccount"]>().not.toBeNullable();
  });

  it("preserves scoped ownership variants and accepts full authenticated entities", () => {
    expectTypeOf<ApiKeyMetadata>().toEqualTypeOf<Omit<ApiKeyEntity, "key">>();
    expectTypeOf<ApiKey>().toExtend<ApiKeyMetadata>();
    expectTypeOf<
      Awaited<ReturnType<UserApiKeyService["createUserApiKey"]>>["entity"]
    >().toEqualTypeOf<UserApiKey>();
    expectTypeOf<
      Awaited<
        ReturnType<WorkspaceApiKeyService["createMemberApiKey"]>
      >["entity"]
    >().toEqualTypeOf<MemberApiKey>();
  });
});
