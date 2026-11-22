import { useState, type ComponentProps } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "@/src/theme";

import { AppText } from "./AppText";
import { useFadeIn } from "./Motion";

export const MASKED_INR_VALUE = "₹••••";
/** For amounts in a currency other than INR, such as USDT. */
export const MASKED_AMOUNT = "••••";
export const MASKED_VALUE_ACCESSIBILITY_LABEL = "Amount hidden";

type MaskedValueType = "wealth" | "price" | "quantity" | "percentage";

type MaskedValueProps = Omit<ComponentProps<typeof AppText>, "children"> & {
  exactValue?: string;
  masked?: boolean;
  /** What a masked amount shows; INR by default. */
  maskedText?: string;
  value: string;
  valueType?: MaskedValueType;
};

export function MaskedValue({
  accessibilityLabel,
  exactValue,
  masked = false,
  maskedText = MASKED_INR_VALUE,
  value,
  valueType = "wealth",
  style,
  ...textProps
}: MaskedValueProps) {
  const { colors } = useTheme();
  const shouldMask = masked && valueType === "wealth";
  // After the mask flips, the new text fades in. The old text leaves at once,
  // so digits are never on screen once masking starts (#783).
  const [lastMask, setLastMask] = useState(shouldMask);
  const [maskChanged, setMaskChanged] = useState(false);
  if (lastMask !== shouldMask) {
    setLastMask(shouldMask);
    setMaskChanged(true);
  }
  const fade = useFadeIn("mask");

  return (
    <AppText
      {...textProps}
      entering={maskChanged ? fade : undefined}
      key={shouldMask ? "masked" : "shown"}
      // A gain or loss colour would reveal the hidden amount's direction.
      style={[
        styles.numeric,
        style,
        shouldMask && { color: colors.text[textProps.color ?? "primary"] },
      ]}
      accessibilityLabel={
        shouldMask
          ? MASKED_VALUE_ACCESSIBILITY_LABEL
          : accessibilityLabel ?? exactValue
      }
    >
      {shouldMask ? maskedText : value}
    </AppText>
  );
}

const styles = StyleSheet.create({
  numeric: { fontVariant: ["tabular-nums"] },
});
