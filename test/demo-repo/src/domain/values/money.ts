export class Money {
  readonly cents: number;
  readonly currency: string;

  constructor(cents: number, currency: string) {
    if (!Number.isInteger(cents)) throw new Error("Money needs whole cents");
    this.cents = cents;
    this.currency = currency;
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("Cannot add different currencies");
    return new Money(this.cents + other.cents, this.currency);
  }
}
