import { ref } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { UserApiKey } from "./user-api-key.object.js";

describe("UserApiKey", () => {
  it("exposes its concrete identity relation", () => {
    const owner = new User();
    const key = Object.assign(new UserApiKey(new ApiKey()), {
      user: ref(User, owner),
    });
    expect(key.ownerType).toBe("user");
    expect(key.user?.id).toBe(owner.id);
    expect(key.id).toEqual(expect.any(String));
    expect(key.enabled).toBe(true);
    expect(key.permissions).toEqual([]);
    expect(key.updatedAt).toBeInstanceOf(Date);
  });
});
