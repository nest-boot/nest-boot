import { Test } from "@nestjs/testing";

import { CryptModule, CryptService } from ".";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

describe("CryptModule", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset static instance before each test
    (CryptService as unknown as { _instance: undefined })._instance = undefined;
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.CRYPT_SECRET;
    delete process.env.APP_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("register", () => {
    it("should throw error when secret is missing", async () => {
      await expect(
        Test.createTestingModule({
          imports: [CryptModule.register({})],
        }).compile(),
      ).rejects.toThrow("Crypt secret is required.");
    });

    it("should use CRYPT_SECRET env when no secret option provided", async () => {
      process.env.CRYPT_SECRET = TEST_SECRET;

      const moduleRef = await Test.createTestingModule({
        imports: [CryptModule.register({})],
      }).compile();

      const cryptService = moduleRef.get<CryptService>(CryptService);

      expect(cryptService).toBeDefined();
    });

    it("should use APP_SECRET env when no secret or CRYPT_SECRET provided", async () => {
      process.env.APP_SECRET = TEST_SECRET;

      const moduleRef = await Test.createTestingModule({
        imports: [CryptModule.register({})],
      }).compile();

      const cryptService = moduleRef.get<CryptService>(CryptService);

      expect(cryptService).toBeDefined();
    });

    it("should throw error when secret is too short", async () => {
      await expect(
        Test.createTestingModule({
          imports: [CryptModule.register({ secret: "short" })],
        }).compile(),
      ).rejects.toThrow("Crypt secret must be at least 32 characters long.");
    });

    it("should throw error when secret has low entropy", async () => {
      // A secret that is 32 chars but low entropy (all same character)
      const lowEntropySecret = "a".repeat(32);

      await expect(
        Test.createTestingModule({
          imports: [CryptModule.register({ secret: lowEntropySecret })],
        }).compile(),
      ).rejects.toThrow("Crypt secret appears low-entropy.");
    });
  });

  describe("registerAsync", () => {
    it("should register module with async factory", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptModule.registerAsync({
            useFactory: () => ({
              secret: TEST_SECRET,
            }),
          }),
        ],
      }).compile();

      const cryptService = moduleRef.get<CryptService>(CryptService);

      expect(cryptService).toBeDefined();

      const encrypted = await cryptService.encrypt("password");
      const decrypted = await cryptService.decrypt(encrypted);
      expect(decrypted).toBe("password");
    });
  });
});
