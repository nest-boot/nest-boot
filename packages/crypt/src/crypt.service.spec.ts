import { Test } from "@nestjs/testing";

import { CryptModule } from "./crypt.module";
import { CryptService } from "./crypt.service";

describe("CryptService", () => {
  const globalSecret = "myGlobalSecret";
  let cryptService: CryptService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CryptModule.register({ secret: globalSecret })],
    }).compile();

    cryptService = moduleRef.get<CryptService>(CryptService);
  });

  describe("encrypt", () => {
    it("should encrypt the value", async () => {
      const value = "Hello, World!";
      const secret = "mySecret";

      const encryptedValue = await cryptService.encrypt(value, secret);

      expect(encryptedValue).toBeDefined();
      expect(encryptedValue).not.toEqual(value);
    });

    it("should encrypt the value using the global secret", async () => {
      const value = "Hello, World!";

      const encryptedValue = await cryptService.encrypt(value);

      expect(encryptedValue).toBeDefined();
      expect(encryptedValue).not.toEqual(value);
    });
  });

  describe("decrypt", () => {
    it("should decrypt the encrypted value", async () => {
      const value = "Hello, World!";
      const secret = "mySecret";

      const encryptedValue = await cryptService.encrypt(value, secret);
      const decryptedValue = await cryptService.decrypt(encryptedValue, secret);

      expect(decryptedValue).toBeDefined();
      expect(decryptedValue).toEqual(value);
    });

    it("should decrypt the encrypted value using the global secret", async () => {
      const value = "Hello, World!";

      const encryptedValue = await cryptService.encrypt(value);
      const decryptedValue = await cryptService.decrypt(encryptedValue);

      expect(decryptedValue).toBeDefined();
      expect(decryptedValue).toEqual(value);
    });
  });

  afterEach(async () => {
    // Clean up any resources used by the CryptService
  });
});
