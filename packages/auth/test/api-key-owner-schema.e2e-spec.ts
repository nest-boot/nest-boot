import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import type { GraphQLUnionType } from "graphql";

import { Member, SystemAccount, User } from "../src/entities/index.js";
import { AuthEnumRegistry } from "../src/infrastructure/auth-enum-registry.js";
import { ApiKey } from "../src/objects/api-key.object.js";
import { ApiKeyResolver } from "../src/resolvers/api-key.resolver.js";
import { UserService } from "../src/services/user.service.js";

@Resolver()
class KeyQuery {
  @Query(() => ApiKey, { nullable: true })
  keyMetadata(): ApiKey | null {
    return null;
  }
}

describe("API-key owners with optional identity features", () => {
  it.each(
    [
      [User],
      [User, Member],
      [User, SystemAccount],
      [User, Member, SystemAccount],
    ].map((owners) => ({
      owners: owners,
      label: owners.map((owner) => owner.name).join(" + "),
    })),
  )("includes only registered identities: $label", async ({ owners }) => {
    const registry = new AuthEnumRegistry(
      { workspace: { enabled: owners.includes(Member) } },
      owners,
    );
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
      // Optional feature services are deliberately absent.
      providers: [ApiKeyResolver, { provide: UserService, useValue: {} }],
    }).compile();
    try {
      expect(module.get(ApiKeyResolver)).toBeInstanceOf(ApiKeyResolver);
      const schema = await module
        .get(GraphQLSchemaFactory)
        .create([KeyQuery, ApiKeyResolver]);
      const types = (schema.getType("ApiKeyOwner") as GraphQLUnionType)
        .getTypes()
        .map(({ name }) => name)
        .sort();
      expect(types).toEqual(owners.map((owner) => owner.name).sort());
      expect(!!schema.getType("Member")).toBe(owners.includes(Member));
      expect(!!schema.getType("SystemAccount")).toBe(
        owners.includes(SystemAccount),
      );
      expect(schema.getType("Workspace")).toBeUndefined();
    } finally {
      await module.close();
      registry.onModuleDestroy();
    }
  });
});
