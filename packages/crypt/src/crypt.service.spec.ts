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
    });
  });
  describe("constructor", () => {
    it("should create instance with secret", () => {
      const service = new CryptService(TEST_SECRET);
      expect(service).toBeDefined();
    });
  });
});
