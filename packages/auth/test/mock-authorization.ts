import { afterEach, vi } from "vitest";

import { RequestIdentity } from "../src/infrastructure/request-identity.js";
import * as authorizeUtil from "../src/utils/authorize.util.js";
import * as canUtil from "../src/utils/can.util.js";
import * as grants from "../src/utils/permission-grants.util.js";

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
    [canUtil, ["can"]],
    [authorizeUtil, ["authorize"]],
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
