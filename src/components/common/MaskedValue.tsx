import type { ComponentProps } from "react";

import { AppText } from "./AppText";

export const MASKED_INR_VALUE = "₹**** **,***.**";

type MaskedValueType = "wealth" | "price" | "quantity" | "percentage";

type MaskedValueProps = Omit<ComponentProps<typeof AppText>, "children"> & {
  masked?: boolean;
  value: string;
  valueType?: MaskedValueType;
};

export function MaskedValue({
  masked = false,
  value,
  valueType = "wealth",
  ...textProps
}: MaskedValueProps) {
  const shouldMask = masked && valueType === "wealth";

  return (
    <AppText {...textProps}>
      {shouldMask ? MASKED_INR_VALUE : value}
    </AppText>
  );
}
