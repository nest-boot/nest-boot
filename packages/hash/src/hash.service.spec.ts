/* eslint-disable @typescript-eslint/no-deprecated */

import { Test } from "@nestjs/testing";

import { HashModule, HashService } from ".";

describe("HashService", () => {
  const globalSecret = "myGlobalSecret";

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
        const secret = "mySecret";

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
        const secret = "mySecret";

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
        const secret = "mySecret";
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
        HashService.init("secret");

        expect(HashService.instance).toBeInstanceOf(HashService);
      });
    });

    describe("init", () => {
      it("should initialize with secret", () => {
        HashService.init("mySecret");

        expect(HashService.instance).toBeDefined();
      });

      it("should initialize without secret", () => {
        HashService.init();

        expect(HashService.instance).toBeDefined();
      });
    });

    describe("hash (static)", () => {
      it("should create a hash using static method", async () => {
        HashService.init("mySecret");
        const value = "password";

        const result = await HashService.hash(value);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });

      it("should create a hash with custom secret using static method", async () => {
        HashService.init();
        const value = "password";
        const secret = "customSecret";

        const result = await HashService.hash(value, secret);

        expect(result).toBeDefined();
        expect(result).toContain("$argon2");
      });
    });

    describe("verify (static)", () => {
      it("should verify using static method", async () => {
        HashService.init("mySecret");
        const value = "password";
        const hashed = await HashService.hash(value);

        const result = await HashService.verify(hashed, value);

        expect(result).toBe(true);
      });

      it("should verify with custom secret using static method", async () => {
        HashService.init();
        const value = "password";
        const secret = "customSecret";
        const hashed = await HashService.hash(value, secret);

        const result = await HashService.verify(hashed, value, secret);

        expect(result).toBe(true);
      });
    });
  });

  describe("constructor", () => {
    it("should create instance with secret", () => {
      const service = new HashService("mySecret");

      expect(service).toBeDefined();
    });

    it("should create instance without secret", () => {
      const service = new HashService();

      expect(service).toBeDefined();
    });
  });
});

describe("HashModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset static instance before each test
    (HashService as unknown as { _instance: undefined })._instance = undefined;
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.HASH_SECRET;
    delete process.env.APP_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("registerAsync", () => {
    it("should register module with async factory", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          HashModule.registerAsync({
            useFactory: () => ({
              secret: "asyncSecret",
            }),
          }),
        ],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });
  });

  describe("register with fallback secrets", () => {
    it("should use HASH_SECRET env when no secret provided", async () => {
      process.env.HASH_SECRET = "envHashSecret";

      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({})],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });

    it("should use APP_SECRET env when no secret or HASH_SECRET provided", async () => {
      process.env.APP_SECRET = "envAppSecret";

      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({})],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });

    it("should work without any secret", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({})],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });
  });
});
