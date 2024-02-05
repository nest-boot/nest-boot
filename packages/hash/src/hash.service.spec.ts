import { Test } from "@nestjs/testing";

import { HashModule } from "./hash.module";
import { HashService } from "./hash.service";

describe("HashService", () => {
  const globalSecret = "myGlobalSecret";
  let hashService: HashService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HashModule.register({ secret: globalSecret })],
    }).compile();

    hashService = moduleRef.get<HashService>(HashService);
  });

  describe("create", () => {
    it("should create a hash with the provided value and secret", async () => {
      const value = "password";
      const secret = "mySecret";

      const result = await hashService.create(value, secret);

      expect(result).toBeDefined();
    });

    it("should create a hash with the provided value and default secret", async () => {
      const value = "password";

      const result = await hashService.create(value);

      expect(result).toBeDefined();
    });
  });

  describe("verify", () => {
    it("should verify the hashed value with the provided value and secret", async () => {
      const hashed =
        "$argon2id$v=19$m=19456,t=2,p=1$pLzJg4HZZPyJmwa4UrBOIw$faLtt/ZlZd4Rc34V1vTV69bATK7gXULr/0pQvPhXi7k";
      const value = "password";
      const secret = "mySecret";

      const result = await hashService.verify(hashed, value, secret);

      expect(result).toBe(true);
    });

    it("should verify the hashed value with the provided value and default secret", async () => {
      const hashed =
        "$argon2id$v=19$m=19456,t=2,p=1$HMuzTfczqMM3OU1YHm3h6A$+xwVTb3sE531tRcZQvMp7ubEi0i5xj/isTz59kK5BVg";
      const value = "password";

      const result = await hashService.verify(hashed, value);

      expect(result).toBe(true);
    });
  });
});
