import { MetadataStorage } from "@mikro-orm/core";

import { Member } from "./member.entity.js";
import { Workspace } from "./workspace.entity.js";
import { WorkspaceApiKey } from "./workspace-api-key.entity.js";

describe("auth entity policies and uniqueness", () => {
  it("uses the same owner-scope predicate for reads and writes", () => {
    const policies = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === WorkspaceApiKey,
    )?.policies;

    expect(policies).toEqual([
      {
        command: "all",
        roles: ["authenticated"],
        using: expect.any(Function),
        check: expect.any(Function),
      },
    ]);
    expect(policies?.[0].using).toBe(policies?.[0].check);
  });

  it("combines own-membership reads with workspace isolation", () => {
    const policies = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === Member,
    )?.policies;

    expect(policies).toHaveLength(2);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "select",
          roles: ["authenticated"],
          using: expect.any(Function),
        }),
        expect.objectContaining({
          command: "all",
          roles: ["authenticated"],
          using: expect.any(Function),
          check: expect.any(Function),
        }),
      ]),
    );
  });

  it("requires unique membership identities, not contact emails", () => {
    const uniques = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === Member,
    )?.uniques;

    expect(uniques).toEqual([
      expect.objectContaining({ properties: ["user", "workspace"] }),
    ]);
  });

  it("uses restrictive row-level security policies for soft deletion", () => {
    expect(
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === Workspace,
      )?.policies,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "restrictive",
          command: "select",
          using: expect.any(Function),
        }),
        expect.objectContaining({
          type: "restrictive",
          command: "insert",
          check: expect.any(Function),
        }),
        expect.objectContaining({
          type: "restrictive",
          command: "update",
          using: expect.any(Function),
          check: expect.any(Function),
        }),
        expect.objectContaining({
          type: "restrictive",
          command: "delete",
          using: expect.any(Function),
        }),
      ]),
    );
  });

  it("allows public workspace reads through row-level security", () => {
    expect(
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === Workspace,
      )?.policies,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "select",
          using: expect.any(Function),
          roles: ["authenticated", "anonymous"],
        }),
      ]),
    );
  });
});
