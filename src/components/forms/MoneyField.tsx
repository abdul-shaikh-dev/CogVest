import type { ComponentProps } from "react";

import type { Currency } from "@/src/types";

import { FormTextField } from "./FormTextField";

const currencySymbol: Record<Currency, string> = { INR: "₹", USD: "$" };
const currencyName: Record<Currency, string> = { INR: "in rupees", USD: "in US dollars" };

type MoneyFieldProps = Omit<
  ComponentProps<typeof FormTextField>,
  "accessibilityLabelSuffix" | "keyboardType" | "multiline" | "prefix" | "secureTextEntry"
> & {
  currency: Currency;
};

/** An amount field that shows and speaks its currency (#669). */
export function MoneyField({ currency, ...props }: MoneyFieldProps) {
  return (
    <FormTextField
      {...props}
      accessibilityLabelSuffix={currencyName[currency]}
      keyboardType="decimal-pad"
      prefix={currencySymbol[currency]}
    />
  );
}
