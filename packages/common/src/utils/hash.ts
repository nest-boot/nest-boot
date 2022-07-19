import argon2 from "@node-rs/argon2";

class Hash {
  async create(value: string | Buffer): Promise<string> {
    return argon2.hash(value);
  }

  async verify(hash: string, value: string | Buffer): Promise<boolean> {
    return argon2.verify(hash, value);
  }
}

export const hash = new Hash();
