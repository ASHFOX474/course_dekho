import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

interface ScryptOptions {
  cost?: number;
  blockSize?: number;
  parallelization?: number;
}

const algorithm = "scrypt";
const saltLength = 16;
const keyLength = 64;

function isPowerOfTwo(value: number): boolean {
  return value > 1 && (value & (value - 1)) === 0;
}

function deriveKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

export class ScryptPasswordHasher implements PasswordHasher {
  private readonly cost: number;
  private readonly blockSize: number;
  private readonly parallelization: number;

  constructor(options: ScryptOptions = {}) {
    this.cost = options.cost ?? 32768;
    this.blockSize = options.blockSize ?? 8;
    this.parallelization = options.parallelization ?? 1;

    if (!isPowerOfTwo(this.cost) || this.cost < 1024 || this.cost > 131072) {
      throw new Error("Scrypt cost must be a power of two from 1024 through 131072.");
    }
    if (this.blockSize < 1 || this.blockSize > 32) {
      throw new Error("Scrypt block size must be from 1 through 32.");
    }
    if (this.parallelization < 1 || this.parallelization > 16) {
      throw new Error("Scrypt parallelization must be from 1 through 16.");
    }
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(saltLength);
    const key = await deriveKey(
      password,
      salt,
      this.cost,
      this.blockSize,
      this.parallelization
    );
    return [
      algorithm,
      this.cost,
      this.blockSize,
      this.parallelization,
      salt.toString("base64url"),
      key.toString("base64url"),
    ].join("$");
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const parts = encodedHash.split("$");
    if (parts.length !== 6 || parts[0] !== algorithm) return false;

    const cost = Number(parts[1]);
    const blockSize = Number(parts[2]);
    const parallelization = Number(parts[3]);
    if (
      !Number.isInteger(cost) ||
      !isPowerOfTwo(cost) ||
      cost < 1024 ||
      cost > 131072 ||
      !Number.isInteger(blockSize) ||
      blockSize < 1 ||
      blockSize > 32 ||
      !Number.isInteger(parallelization) ||
      parallelization < 1 ||
      parallelization > 16
    ) {
      return false;
    }

    try {
      const salt = Buffer.from(parts[4], "base64url");
      const expected = Buffer.from(parts[5], "base64url");
      if (salt.length !== saltLength || expected.length !== keyLength) return false;
      const actual = await deriveKey(password, salt, cost, blockSize, parallelization);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
