import crypto from "crypto";

export namespace Random {
  export function RandomString(): string {
    return CryptoKey();
  }
  export function CryptoKey(length: number = 32): string {
    return crypto
      .randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length);
  }
}
