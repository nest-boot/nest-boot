import { Test } from "@nestjs/testing";

import { CryptModule, CryptService } from ".";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

describe("CryptService", () => {
  describe("instance methods (via CryptModule.register)", () => {
    let cryptService: CryptService;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CryptModule.register({ secret: TEST_SECRET })],
      }).compile();

      cryptService = moduleRef.get<CryptService>(CryptService);
    });

    describe("encrypt", () => {
      it("should encrypt the value", async () => {
        const value = "Hello, World!";

        const encryptedValue = await cryptService.encrypt(value);

        expect(encryptedValue).toBeDefined();
        expect(encryptedValue).not.toEqual(value);
      });

      it("should return JWE compact serialization format", async () => {
        const value = "Hello, World!";

        const encryptedValue = await cryptService.encrypt(value);

        // JWE compact serialization has 5 parts separated by dots
        expect(encryptedValue.split(".")).toHaveLength(5);
      });
    });

    describe("decrypt", () => {
      it("should decrypt the encrypted value", async () => {
        const value = "Hello, World!";

        const encryptedValue = await cryptService.encrypt(value);
        const decryptedValue = await cryptService.decrypt(encryptedValue);

        expect(decryptedValue).toBeDefined();
        expect(decryptedValue).toEqual(value);
      });

      it("should throw error for invalid JWE", async () => {
        await expect(cryptService.decrypt("invalid-jwe")).rejects.toThrow();
      });
    });
  });

  describe("static methods", () => {
    beforeEach(() => {
      // Reset static instance before each test
      (CryptService as unknown as { _instance: undefined })._instance =
        undefined;
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
