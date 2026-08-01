import Decimal from "decimal.js-light";

export const financialPrecision = {
  money: 2,
  percentage: 2,
  quantity: 8,
  unitPrice: 8,
} as const;

export const moneyQuantum = 10 ** -financialPrecision.money;
export const quantityQuantum = 10 ** -financialPrecision.quantity;

export const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export type FinancialDecimalValue = string | number | Decimal;
export type FinancialDecimalInstance = InstanceType<typeof FinancialDecimal>;

export function decimal(
  value: FinancialDecimalValue,
): FinancialDecimalInstance {
  return new FinancialDecimal(value);
}

export function roundHalfUp(value: FinancialDecimalValue, decimalPlaces: number) {
  return decimal(value)
    .toDecimalPlaces(decimalPlaces, FinancialDecimal.ROUND_HALF_UP)
    .toNumber();
}

export function normalizeMoney(value: FinancialDecimalValue) {
  return roundHalfUp(value, financialPrecision.money);
}

export function normalizePercentage(value: FinancialDecimalValue) {
  return roundHalfUp(value, financialPrecision.percentage);
}

export function normalizeQuantity(value: FinancialDecimalValue) {
  return roundHalfUp(value, financialPrecision.quantity);
}

export function normalizeUnitPrice(value: FinancialDecimalValue) {
  return roundHalfUp(value, financialPrecision.unitPrice);
}

export function isWithinQuantum(
  left: FinancialDecimalValue,
  right: FinancialDecimalValue,
  quantum: FinancialDecimalValue,
) {
  return decimal(left).minus(right).abs().lessThan(quantum);
}

export function isAtOrBeyondNegativeQuantum(
  value: FinancialDecimalValue,
  quantum: FinancialDecimalValue,
) {
  return decimal(value).lessThanOrEqualTo(decimal(quantum).negated());
}

export function sumFinancialValues(
  values: FinancialDecimalValue[],
): FinancialDecimalInstance {
  return values.reduce<FinancialDecimalInstance>(
    (total, value) => total.plus(value),
    decimal(0),
  );
}
