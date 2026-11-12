import { afterEach, vi } from "vitest";

import * as authorizeUtil from "../src/common/utils/authorize.util.js";
import * as canUtil from "../src/common/utils/can.util.js";
import * as grants from "../src/common/utils/permission-grants.util.js";
import * as identityAccess from "../src/core/utils/assert-current-identity.util.js";

/**
 * Isolates persistence tests from authorization; boundary tests restore the relevant check.
 * @returns Spies for permission checks and authorization enforcement.
 */
export function mockAuthorization() {
  return {
    can: vi.spyOn(canUtil, "can").mockClear().mockReturnValue(true),
    authorize: vi
      .spyOn(authorizeUtil, "authorize")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentUser: vi
      .spyOn(identityAccess, "assertCurrentUser")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentSession: vi
      .spyOn(identityAccess, "assertCurrentSession")
      .mockClear()
      .mockImplementation(() => undefined),
    assertUserSession: vi
      .spyOn(identityAccess, "assertUserSession")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentWorkspace: vi
      .spyOn(identityAccess, "assertCurrentWorkspace")
      .mockClear()
      .mockImplementation(() => undefined),
    assertCurrentWorkspaceMember: vi
      .spyOn(identityAccess, "assertCurrentWorkspaceMember")
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
    [canUtil, ["can"]],
    [authorizeUtil, ["authorize"]],
    [
      identityAccess,
      [
        "assertCurrentUser",
        "assertCurrentSession",
        "assertUserSession",
        "assertCurrentWorkspace",
        "assertCurrentWorkspaceMember",
      ],
    ],
    [grants, ["canGrantPermissions", "assertCanGrantPermissions"]],
  ] as const) {
    for (const name of names) {
      const check = Reflect.get(target, name);
      if (vi.isMockFunction(check)) {
        check.mockRestore();
      }
    }
  }
}
afterEach(restoreAuthorization);
