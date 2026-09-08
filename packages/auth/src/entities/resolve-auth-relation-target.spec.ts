import { Entity } from "@mikro-orm/decorators/legacy";

import {
  configureAuthRelationTargets,
  resolveAuthRelationTarget,
} from "./resolve-auth-relation-target.js";
import { BaseWorkspace } from "./workspace.entity.js";

@Entity()
class Organization extends BaseWorkspace {}

describe("resolveAuthRelationTarget", () => {
  it("resolves a concrete entity whose name differs from its auth base", () => {
    expect(resolveAuthRelationTarget(BaseWorkspace, "Workspace")).toBe(
      Organization,
    );
  });

  it("prefers the entity explicitly configured by AuthModule", () => {
    class ConfiguredOrganization extends BaseWorkspace {}
    configureAuthRelationTargets([
      [BaseWorkspace, ConfiguredOrganization] as const,
    ]);

    expect(resolveAuthRelationTarget(BaseWorkspace, "Workspace")).toBe(
      ConfiguredOrganization,
    );
  });
});
