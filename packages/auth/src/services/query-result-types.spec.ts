import { expectTypeOf } from "vitest";

import type { UserApiKey } from "../entities/user-api-key.entity.js";
import type { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { ApiKey } from "../types/api-key.type.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import type { AccountService } from "./account.service.js";
import type { SessionService } from "./session.service.js";
import type { UserApiKeyService } from "./user-api-key.service.js";
import type { WorkspaceApiKeyService } from "./workspace-api-key.service.js";

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

  it("omits credential hashes from workspace-key reads and mutations", () => {
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
    expectTypeOf<Result["workspace"]>().toEqualTypeOf<
      WorkspaceApiKey["workspace"]
    >();
  });

  it("preserves both ownership variants and accepts full authenticated entities", () => {
    expectTypeOf<ApiKeyMetadata>().toEqualTypeOf<
      Omit<UserApiKey, "key"> | Omit<WorkspaceApiKey, "key">
    >();
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
