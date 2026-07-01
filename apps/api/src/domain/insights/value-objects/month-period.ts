/**
 * Value object para un mes natural en UTC. Centraliza la lógica de fechas de
 * periodos mensuales para que no se repita en rutas ni componentes.
 */
export class MonthPeriod {
  private constructor(
    public readonly year: number,
    public readonly month: number
  ) {}

  static of(year: number, month: number): MonthPeriod {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Periodo mensual no válido');
    }
    return new MonthPeriod(year, month);
  }

  static fromDate(date: Date): MonthPeriod {
    return new MonthPeriod(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }

  /** Inicio del mes, inclusive. */
  get start(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, 1));
  }

  /** Inicio del mes siguiente: límite superior exclusivo. */
  get end(): Date {
    return new Date(Date.UTC(this.year, this.month, 1));
  }

  previous(): MonthPeriod {
    return this.month === 1
      ? new MonthPeriod(this.year - 1, 12)
      : new MonthPeriod(this.year, this.month - 1);
  }
}
