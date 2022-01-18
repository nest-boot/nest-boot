import argon2 from "argon2";

class Hash {
  async create(value: string | Buffer): Promise<string> {
    return await argon2.hash(value);
  }

  async verify(hash: string, value: string | Buffer): Promise<boolean> {
    return await argon2.verify(hash, value);
  }
}

export const hash = new Hash();
