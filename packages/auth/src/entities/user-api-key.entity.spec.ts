import { ref } from "@mikro-orm/core";

import { User } from "./user.entity.js";
import { UserApiKey } from "./user-api-key.entity.js";

describe("UserApiKey", () => {
  it("exposes its owner through the existing management accessor", () => {
    const owner = new User();
    const key = Object.assign(new UserApiKey(), { user: ref(User, owner) });
    expect(key.ownerType).toBe("user");
    expect(key.owner).toBe(key.user);
    expect(key.user?.id).toBe(owner.id);
    expect(key.id).toEqual(expect.any(String));
    expect(key.enabled).toBe(true);
    expect(key.permissions).toEqual([]);
    expect(key.updatedAt).toBeInstanceOf(Date);
  });
});
