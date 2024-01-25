import crypto from "crypto";

const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a random string of the specified length.
 * @param length The length of the random string to generate.
 * @returns The randomly generated string.
 */
export function randomString(length: number) {
  let result = "";
  const byteSize = Math.ceil((length * 256) / characters.length);
  const randomBytes = crypto.randomBytes(byteSize);

  for (let i = 0; i < byteSize && result.length < length; i++) {
    const randomByte = randomBytes[i];
    if (randomByte < 256 - (256 % characters.length)) {
      result += characters.charAt(randomByte % characters.length);
    }
  }

  return result;
}
