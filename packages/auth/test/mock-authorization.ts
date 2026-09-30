import { afterEach, vi } from "vitest";

import * as authorization from "../src/auth.ability.js";
import { RequestIdentity } from "../src/infrastructure/request-identity.js";
import * as grants from "../src/utils/permission-grants.util.js";

/** Isolates persistence tests from authorization; boundary tests restore the relevant check. */
export function mockAuthorization() {
  return {
    can: vi.spyOn(authorization, "can").mockClear().mockReturnValue(true),
    throwUnlessCan: vi
      .spyOn(authorization, "throwUnlessCan")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentUser: vi
      .spyOn(RequestIdentity, "assertCurrentUser")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentSession: vi
      .spyOn(RequestIdentity, "assertCurrentSession")
      .mockClear()
      .mockImplementation(() => undefined),
    assertUserSession: vi
      .spyOn(RequestIdentity, "assertUserSession")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentWorkspace: vi
      .spyOn(RequestIdentity, "assertCurrentWorkspace")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentMember: vi
      .spyOn(RequestIdentity, "assertCurrentMember")
      .mockClear()
      .mockImplementation(() => undefined),
    canGrantPermissions: vi
      .spyOn(grants, "canGrantPermissions")
      .mockClear()
      .mockReturnValue(true),
    assertCanGrantPermissions: vi
      .spyOn(grants, "assertCanGrantPermissions")
      .mockClear()
      .mockImplementation(() => undefined),
  };
}
/** Restores real checks for integration and authorization-boundary tests. */
export function restoreAuthorization(): void {
  for (const [target, names] of [
    [authorization, ["can", "throwUnlessCan"]],
    [
      RequestIdentity,
      [
        "assertCurrentUser",
        "assertCurrentSession",
        "assertUserSession",
        "assertCurrentWorkspace",
        "assertCurrentMember",
      ],
    ],
    [grants, ["canGrantPermissions", "assertCanGrantPermissions"]],
  ] as const) {
    for (const name of names) {
      const check = Reflect.get(target, name);
      if (vi.isMockFunction(check)) check.mockRestore();
    }
  }
}
afterEach(restoreAuthorization);
