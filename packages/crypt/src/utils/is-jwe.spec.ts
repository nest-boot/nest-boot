import { CryptService } from "../crypt.service";
import { isJwe } from "./is-jwe";

const TEST_SECRET = "myTestSecretThatIsAtLeast32Chars!";

describe("isJwe", () => {
  beforeAll(() => {
    CryptService.init(TEST_SECRET);
  });

  it("should return true for valid JWE", async () => {
    const encrypted = await CryptService.encrypt("test");
    expect(isJwe(encrypted)).toBe(true);
  });

  it("should return false for empty string", () => {
    expect(isJwe("")).toBe(false);
  });

  it("should return false for plain text", () => {
    expect(isJwe("hello world")).toBe(false);
  });

  it("should return false for string with 5 dots but invalid header", () => {
    expect(isJwe("a.b.c.d.e")).toBe(false);
  });

  it("should return false for string with valid base64 but missing alg/enc", () => {
    // base64url of '{}'
    const emptyHeader = Buffer.from("{}").toString("base64url");
    expect(isJwe(`${emptyHeader}.b.c.d.e`)).toBe(false);
  });

  it("should return false for string with only alg field", () => {
    const headerWithAlg = Buffer.from('{"alg":"A256GCMKW"}').toString(
      "base64url",
    );
    expect(isJwe(`${headerWithAlg}.b.c.d.e`)).toBe(false);
  });

  it("should return false for string with only enc field", () => {
    const headerWithEnc =
      Buffer.from('{"enc":"A256GCM"}').toString("base64url");
    expect(isJwe(`${headerWithEnc}.b.c.d.e`)).toBe(false);
  });

  it("should return true for string with both alg and enc fields", () => {
    const validHeader = Buffer.from(
      '{"alg":"A256GCMKW","enc":"A256GCM"}',
    ).toString("base64url");
    expect(isJwe(`${validHeader}.b.c.d.e`)).toBe(true);
  });

  it("should return false for JWT (wrong structure)", () => {
    // JWT has only 3 parts
    const jwtHeader = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString(
      "base64url",
    );
    expect(isJwe(`${jwtHeader}.payload.signature`)).toBe(false);
  });

  it("should return false for non-string alg/enc values", () => {
    const invalidHeader = Buffer.from('{"alg":123,"enc":"A256GCM"}').toString(
      "base64url",
    );
    expect(isJwe(`${invalidHeader}.b.c.d.e`)).toBe(false);
  });
});
