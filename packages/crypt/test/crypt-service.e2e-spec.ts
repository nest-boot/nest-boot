import { Test } from "@nestjs/testing";

import { CryptModule, CryptService } from "../src/index.js";

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
});
