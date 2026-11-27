import { CryptService } from "./index.js";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

describe("CryptService", () => {
  describe("static methods", () => {
    beforeEach(() => {
      // Reset static instance before each test
      (
        CryptService as unknown as {
          _instance: undefined;
        }
      )._instance = undefined;
    });
    describe("instance getter", () => {
      it("should throw error when not initialized", () => {
        expect(() => CryptService.instance).toThrow(
          "CryptService not initialized",
        );
      });
      it("should return instance after initialization", () => {
        CryptService.init(TEST_SECRET);
        expect(CryptService.instance).toBeInstanceOf(CryptService);
      });
    });
    describe("init", () => {
      it("should initialize with secret", () => {
        CryptService.init(TEST_SECRET);
        expect(CryptService.instance).toBeDefined();
      });
    });
    describe("encrypt (static)", () => {
      it("should encrypt using static method", async () => {
        CryptService.init(TEST_SECRET);
        const value = "Hello, World!";
        const encrypted = await CryptService.encrypt(value);
        expect(encrypted).toBeDefined();
        expect(encrypted).not.toEqual(value);
      });
    });
    describe("decrypt (static)", () => {
      it("should decrypt using static method", async () => {
        CryptService.init(TEST_SECRET);
        const value = "Hello, World!";
        const encrypted = await CryptService.encrypt(value);
        const decrypted = await CryptService.decrypt(encrypted);
        expect(decrypted).toEqual(value);
      });
      it("should isolate subkeys when context option is provided", async () => {
        CryptService.init(TEST_SECRET);
        const encrypted = await CryptService.encrypt("secret-key", {
          context: "jwt",
        });

        expect(await CryptService.decrypt(encrypted, { context: "jwt" })).toBe(
          "secret-key",
        );
        await expect(CryptService.decrypt(encrypted)).rejects.toThrow();
        await expect(
          CryptService.decrypt(encrypted, { context: "other" }),
        ).rejects.toThrow();
      });
    });
  });
  describe("constructor and context options", () => {
    it("should create instance with secret", () => {
      const service = new CryptService(TEST_SECRET);
      expect(service).toBeDefined();
    });
    it("should isolate root and contextual keys and reuse cached derived keys", async () => {
      const service = new CryptService(TEST_SECRET);
      const rootCipher = await service.encrypt("payload");
      const jwtCipher1 = await service.encrypt("payload", { context: "jwt" });
      const jwtCipher2 = await service.encrypt("payload-2", { context: "jwt" });

      expect(await service.decrypt(rootCipher)).toBe("payload");
      expect(await service.decrypt(jwtCipher1, { context: "jwt" })).toBe(
        "payload",
      );
      expect(await service.decrypt(jwtCipher2, { context: "jwt" })).toBe(
        "payload-2",
      );

      await expect(service.decrypt(jwtCipher1)).rejects.toThrow();
      await expect(
        service.decrypt(jwtCipher1, { context: "other" }),
      ).rejects.toThrow();
      await expect(
        service.decrypt(rootCipher, { context: "jwt" }),
      ).rejects.toThrow();
    });
    it("should reject empty or whitespace contexts", async () => {
      const service = new CryptService(TEST_SECRET);
      await expect(service.encrypt("data", { context: "" })).rejects.toThrow(
        "Crypt context must be a non-empty string.",
      );
      await expect(service.decrypt("data", { context: "   " })).rejects.toThrow(
        "Crypt context must be a non-empty string.",
      );
      await expect(
        service.encrypt("data", { context: null as unknown as string }),
      ).rejects.toThrow("Crypt context must be a non-empty string.");
    });
  });
});
