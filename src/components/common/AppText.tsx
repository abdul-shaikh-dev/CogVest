import type { ReactNode } from "react";
import type { TextProps, TextStyle } from "react-native";
import { StyleSheet, Text } from "react-native";

import { colors, typography } from "@/src/theme";

type TextVariant = "caption" | "body" | "title" | "largeTitle" | "hero";
type TextColor = keyof typeof colors.text | "primary";

export type AppTextProps = TextProps & {
  align?: TextStyle["textAlign"];
  children: ReactNode;
  color?: TextColor;
  variant?: TextVariant;
  weight?: keyof typeof typography.weights;
};

export function AppText({
  align,
  children,
  color = "primary",
  style,
  variant = "body",
  weight = "regular",
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant],
        {
          color: colors.text[color],
          fontWeight: typography.weights[weight],
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0.1,
  },
  body: {
    fontSize: typography.sizes.body,
    lineHeight: 24,
  },
  caption: {
    fontSize: typography.sizes.caption,
    lineHeight: 16,
  },
  hero: {
    fontSize: typography.sizes.hero,
    lineHeight: 50,
  },
  largeTitle: {
    fontSize: typography.sizes.largeTitle,
    lineHeight: 38,
  },
  title: {
    fontSize: typography.sizes.title,
    lineHeight: 28,
  },
});
