import { RequestContext } from "@nest-boot/request-context";

import { AuthAbility } from "../abilities/auth.ability.js";
import { User } from "../entities/user.entity.js";
import { can } from "./can.util.js";
class TestSubject {}
describe("can", () => {
  it("fails closed without a request identity", async () => {
    expect(can("read", TestSubject)).toBe(false);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(
        AuthAbility,
        new AuthAbility([{ action: "read", subject: TestSubject }]),
      );
      expect(can("read", TestSubject)).toBe(false);
    });
  });
  it("evaluates object and field checks with the prepared ability", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
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
