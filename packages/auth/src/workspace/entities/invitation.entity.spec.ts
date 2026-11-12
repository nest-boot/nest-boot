import { Invitation } from "./invitation.entity.js";

describe("entity defaults", () => {
  it("initializes generated ids, timestamps and defaults", () => {
    const entity = new Invitation();
    expect(entity.id).toEqual(expect.any(String));
    expect(entity.createdAt).toBeInstanceOf(Date);
    if ("updatedAt" in entity) {
      expect(entity.updatedAt).toBeInstanceOf(Date);
    }
    expect(entity.status).toBe("pending");
  });
});
