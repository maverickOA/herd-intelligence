/**
 * Exact arithmetic for pedigree coefficients.
 *
 * Every kinship and inbreeding coefficient produced by the tabular method or by
 * Wright's path method is a dyadic rational: an integer divided by a power of two.
 * Representing them exactly means the two methods can be compared for exact
 * equality, and thresholds are never crossed by rounding error.
 */
export class Dyadic {
  /** value = num / 2^exp, normalised so num is odd unless exp is 0 */
  readonly num: bigint;
  readonly exp: number;

  private constructor(num: bigint, exp: number) {
    while (exp > 0 && num % 2n === 0n) {
      num /= 2n;
      exp -= 1;
    }
    if (num === 0n) exp = 0;
    this.num = num;
    this.exp = exp;
  }

  static readonly ZERO = new Dyadic(0n, 0);
  static readonly ONE = new Dyadic(1n, 0);

  static of(num: bigint, exp = 0): Dyadic {
    if (exp < 0) throw new RangeError('exp must be >= 0');
    return new Dyadic(num, exp);
  }

  /** (1/2)^k */
  static halfPow(k: number): Dyadic {
    return new Dyadic(1n, k);
  }

  add(other: Dyadic): Dyadic {
    const e = Math.max(this.exp, other.exp);
    const a = this.num << BigInt(e - this.exp);
    const b = other.num << BigInt(e - other.exp);
    return new Dyadic(a + b, e);
  }

  mul(other: Dyadic): Dyadic {
    return new Dyadic(this.num * other.num, this.exp + other.exp);
  }

  half(): Dyadic {
    return new Dyadic(this.num, this.exp + 1);
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  equals(other: Dyadic): boolean {
    return this.num === other.num && this.exp === other.exp;
  }

  compare(other: Dyadic): number {
    const e = Math.max(this.exp, other.exp);
    const a = this.num << BigInt(e - this.exp);
    const b = other.num << BigInt(e - other.exp);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /** Compare with a JS number threshold (thresholds like 0.03125 are exact in binary). */
  compareNumber(threshold: number): number {
    const v = this.toNumber();
    return v < threshold ? -1 : v > threshold ? 1 : 0;
  }

  toNumber(): number {
    if (this.exp <= 1000) return Number(this.num) / 2 ** this.exp;
    // Very deep values: scale down safely.
    const shift = this.exp - 1000;
    return Number(this.num >> BigInt(shift)) / 2 ** 1000;
  }

  /** Exact representation, e.g. "5/32". */
  toFraction(): string {
    if (this.exp === 0) return this.num.toString();
    return `${this.num}/${1n << BigInt(this.exp)}`;
  }
}
