import type { ComponentProps } from "react";

import { AppText } from "./AppText";

export const MASKED_INR_VALUE = "₹••••";
export const MASKED_VALUE_ACCESSIBILITY_LABEL = "Amount hidden";

type MaskedValueType = "wealth" | "price" | "quantity" | "percentage";

type MaskedValueProps = Omit<ComponentProps<typeof AppText>, "children"> & {
  exactValue?: string;
  masked?: boolean;
  value: string;
  valueType?: MaskedValueType;
};

export function MaskedValue({
  accessibilityLabel,
  exactValue,
  masked = false,
  value,
  valueType = "wealth",
  ...textProps
}: MaskedValueProps) {
  const shouldMask = masked && valueType === "wealth";

  return (
    <AppText
      {...textProps}
      accessibilityLabel={
        shouldMask
          ? MASKED_VALUE_ACCESSIBILITY_LABEL
          : accessibilityLabel ?? exactValue
      }
    >
      {shouldMask ? MASKED_INR_VALUE : value}
    </AppText>
  );
}
