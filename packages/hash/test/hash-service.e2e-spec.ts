/* eslint-disable @typescript-eslint/no-deprecated */
import { Test } from "@nestjs/testing";

import { HashModule, HashService } from "../dist/index.js";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

const TEST_SECRET_ALT = "anotherSecretThatIsAtLeast32Char";

describe("HashService", () => {
  const globalSecret = TEST_SECRET;
  describe("instance methods (via HashModule.register)", () => {
    let hashService: HashService;
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({ secret: globalSecret })],
      }).compile();
      hashService = moduleRef.get<HashService>(HashService);
    });
    describe("hash", () => {
      it("should create a hash with the provided value and secret", async () => {
        const value = "password";
        const secret = TEST_SECRET_ALT;
        const result = await hashService.hash(value, secret);
        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
      it("should create a hash with the provided value and default secret", async () => {
        const value = "password";
        const result = await hashService.hash(value);
        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
    });
    describe("create (deprecated)", () => {
      it("should create a hash with the provided value and secret", async () => {
        const value = "password";
        const secret = TEST_SECRET_ALT;
        const result = await hashService.create(value, secret);
        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
      it("should create a hash with the provided value and default secret", async () => {
        const value = "password";
        const result = await hashService.create(value);
        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
    });
    describe("verify", () => {
      it("should verify the hashed value with the provided value and secret", async () => {
        const value = "password";
        const secret = TEST_SECRET_ALT;
        const hashed = await hashService.hash(value, secret);
        const result = await hashService.verify(hashed, value, secret);
        expect(result).toBe(true);
      });
      it("should verify the hashed value with the provided value and default secret", async () => {
        const value = "password";
        const hashed = await hashService.hash(value);
        const result = await hashService.verify(hashed, value);
        expect(result).toBe(true);
      });
      it("should return false for incorrect password", async () => {
        const value = "password";
        const hashed = await hashService.hash(value);
        const result = await hashService.verify(hashed, "wrongpassword");
        expect(result).toBe(false);
      });
    });
  });
});
