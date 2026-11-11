import type { MikroORM } from "@mikro-orm/core";
import { createUnionType } from "@nest-boot/graphql";

import { ApiKeyEntity } from "../entities/api-key.entity.js";
import { Member } from "../entities/member.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { User } from "../entities/user.entity.js";

/** Built-in identity classes supported by the polymorphic owner relation. */
export type ApiKeyOwnerClass =
  | typeof User
  | typeof Member
  | typeof SystemAccount;

let activeOwners: readonly ApiKeyOwnerClass[] = [User];

/**
 * Uses discovered ORM targets so disabled features cannot enter the GraphQL union.
 * @param orm - Initialized application ORM.
 * @returns Only the owner classes registered for this application.
 * @internal
 */
export function getRegisteredApiKeyOwnerTypes(
  orm: MikroORM,
): ApiKeyOwnerClass[] {
  const targets = orm.getMetadata().find(ApiKeyEntity)?.properties
    .owner.polymorphTargets;
  if (!targets?.length) {
    return [];
  }
  return targets.map(({ class: target }) => {
    if (target === User) {
      return User;
    }
    if (target === Member) {
      return Member;
    }
    if (target === SystemAccount) {
      return SystemAccount;
    }
    throw new Error("Unsupported API key owner type");
  });
}

/**
 * Publishes union targets while the auth schema registry holds its metadata lease.
 * @param owners - Active owner classes from discovered entity metadata.
 * @internal
 */
export function configureApiKeyOwnerTypes(
  owners: readonly ApiKeyOwnerClass[],
): void {
  if (!owners.length) {
    throw new Error("At least one API key owner type is required");
  }
  activeOwners = [...owners];
}

/** A readable owner drawn only from the active application's registered identity types. */
export const ApiKeyOwner = createUnionType({
  name: "ApiKeyOwner",
  types: () => activeOwners,
  resolveType: (owner: User | Member | SystemAccount) => {
    if (owner instanceof User) {
      return User;
    }
    if (owner instanceof Member) {
      return Member;
    }
    if (owner instanceof SystemAccount) {
      return SystemAccount;
    }
    return undefined;
  },
});
