/* eslint-disable @typescript-eslint/no-deprecated */

import { Test } from "@nestjs/testing";

import { HashModule, HashService } from ".";

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

  describe("static methods", () => {
    beforeEach(() => {
      // Reset static instance before each test
      (HashService as unknown as { _instance: undefined })._instance =
        undefined;
    });

    describe("instance getter", () => {
      it("should throw error when not initialized", () => {
        expect(() => HashService.instance).toThrow(
          "HashService not initialized",
        );
      });

      it("should return instance after initialization", () => {
        HashService.init(TEST_SECRET);

        expect(HashService.instance).toBeInstanceOf(HashService);
      });
    });

    describe("init", () => {
      it("should initialize with secret", () => {
        HashService.init(TEST_SECRET);

        expect(HashService.instance).toBeDefined();
      });

      it("should initialize without secret", () => {
        HashService.init();

        expect(HashService.instance).toBeDefined();
      });
    });

    describe("hash (static)", () => {
      it("should create a hash using static method", async () => {
        HashService.init(TEST_SECRET);
        const value = "password";

        const result = await HashService.hash(value);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });

      it("should create a hash with custom secret using static method", async () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const secret = TEST_SECRET_ALT;

        const result = await HashService.hash(value, secret);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
    });

    describe("verify (static)", () => {
      it("should verify using static method", async () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const hashed = await HashService.hash(value);

        const result = await HashService.verify(hashed, value);

        expect(result).toBe(true);
      });

      it("should verify with custom secret using static method", async () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const secret = TEST_SECRET_ALT;
        const hashed = await HashService.hash(value, secret);

        const result = await HashService.verify(hashed, value, secret);

        expect(result).toBe(true);
      });
    });

    describe("hashSync (static)", () => {
      it("should create a hash synchronously using static method", () => {
        HashService.init(TEST_SECRET);
        const value = "password";

        const result = HashService.hashSync(value);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });

      it("should create a hash synchronously with custom secret using static method", () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const secret = TEST_SECRET_ALT;

        const result = HashService.hashSync(value, secret);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
    });

    describe("verifySync (static)", () => {
      it("should verify synchronously using static method", () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const hashed = HashService.hashSync(value);

        const result = HashService.verifySync(hashed, value);

        expect(result).toBe(true);
      });

      it("should verify synchronously with custom secret using static method", () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const secret = TEST_SECRET_ALT;
        const hashed = HashService.hashSync(value, secret);

        const result = HashService.verifySync(hashed, value, secret);

        expect(result).toBe(true);
      });

      it("should return false for incorrect password synchronously", () => {
        HashService.init(TEST_SECRET);
        const value = "password";
        const hashed = HashService.hashSync(value);

        const result = HashService.verifySync(hashed, "wrongpassword");

        expect(result).toBe(false);
      });
    });
  });

  describe("constructor", () => {
    it("should create instance with secret", () => {
      const service = new HashService(TEST_SECRET);

      expect(service).toBeDefined();
    });

    it("should create instance without secret", () => {
      const service = new HashService();

      expect(service).toBeDefined();
    });
  });
});
