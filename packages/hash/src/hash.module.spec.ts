import { Test } from "@nestjs/testing";

import { HashModule, HashService } from ".";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

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

  describe("register", () => {
    it("should throw error when secret is missing", async () => {
      await expect(
        Test.createTestingModule({
          imports: [HashModule.register({})],
        }).compile(),
      ).rejects.toThrow("Hash secret is required.");
    });

    it("should use HASH_SECRET env when no secret provided", async () => {
      process.env.HASH_SECRET = TEST_SECRET;

      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({})],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });

    it("should use APP_SECRET env when no secret or HASH_SECRET provided", async () => {
      process.env.APP_SECRET = TEST_SECRET;

      const moduleRef = await Test.createTestingModule({
        imports: [HashModule.register({})],
      }).compile();

      const hashService = moduleRef.get<HashService>(HashService);

      expect(hashService).toBeDefined();

      const hashed = await hashService.hash("password");
      expect(hashed).toContain("$argon2");
    });

    it("should throw error when secret is too short", async () => {
      await expect(
        Test.createTestingModule({
          imports: [HashModule.register({ secret: "short" })],
        }).compile(),
      ).rejects.toThrow("Hash secret must be at least 32 characters long.");
    });

    it("should throw error when secret has low entropy", async () => {
      // A secret that is 32 chars but low entropy (all same character)
      const lowEntropySecret = "a".repeat(32);

      await expect(
        Test.createTestingModule({
          imports: [HashModule.register({ secret: lowEntropySecret })],
        }).compile(),
      ).rejects.toThrow("Hash secret appears low-entropy.");
    });
  });

  describe("registerAsync", () => {
    it("should register module with async factory", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          HashModule.registerAsync({
            useFactory: () => ({
              secret: TEST_SECRET,
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
});
