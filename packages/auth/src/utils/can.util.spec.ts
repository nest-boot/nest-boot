import { RequestContext } from "@nest-boot/request-context";

import { AuthAbility } from "../abilities/auth.ability.js";
import { User } from "../entities/user.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { can } from "./can.util.js";
class TestSubject {}
describe("can", () => {
  it("fails closed without a context or authorization service", async () => {
    expect(can("read", TestSubject)).toBe(false);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(
        AuthAbility,
        new AuthAbility([{ action: "read", subject: TestSubject }]),
      );
      expect(can("read", TestSubject)).toBe(false);
    });
  });
  it("delegates object and field checks to the unified authorization service", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const access = new AccessControlService({});
      RequestContext.set(User, new User());
      RequestContext.set(AccessControlService, access);
      RequestContext.set(
        AuthAbility,
        new AuthAbility([
          { action: "update", subject: TestSubject, fields: ["name"] },
        ]),
      );
      expect(can("update", TestSubject)).toBe(true);
      expect(can("update", new TestSubject(), "name")).toBe(true);
      expect(can("update", new TestSubject(), "secret")).toBe(false);
      expect(can("delete", TestSubject)).toBe(false);
    });
  });
});
