/**
 * Value object para importes monetarios. Trabaja siempre en céntimos enteros
 * para evitar errores de coma flotante. Inmutable: toda operación devuelve
 * una nueva instancia.
 */
export class Money {
  private constructor(private readonly amountCents: number) {}

  static fromEuros(euros: number): Money {
    if (!Number.isFinite(euros)) {
      throw new Error('Importe no válido');
    }
    return new Money(Math.round(euros * 100));
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new Error('Los céntimos deben ser un entero');
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  get cents(): number {
    return this.amountCents;
  }

  toEuros(): number {
    return Number((this.amountCents / 100).toFixed(2));
  }

  add(other: Money): Money {
    return new Money(this.amountCents + other.amountCents);
  }

  subtract(other: Money): Money {
    return new Money(this.amountCents - other.amountCents);
  }

  isNegative(): boolean {
    return this.amountCents < 0;
  }

  orZeroIfNegative(): Money {
    return this.amountCents < 0 ? Money.zero() : this;
  }
}
