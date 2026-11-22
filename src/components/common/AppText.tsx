import type { ComponentProps, ReactNode } from "react";
import type { TextProps, TextStyle } from "react-native";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { typography, useTheme, type ThemeColors } from "@/src/theme";

type TextVariant = "caption" | "body" | "section" | "title" | "largeTitle" | "hero";
type TextColor = keyof ThemeColors["text"];

export type AppTextProps = TextProps & {
  align?: TextStyle["textAlign"];
  children: ReactNode;
  color?: TextColor;
  /** A fade for text that just changed, such as a mask toggle (#783). */
  entering?: ComponentProps<typeof Animated.Text>["entering"];
  variant?: TextVariant;
  weight?: keyof typeof typography.weights;
};

export function AppText({
  align,
  children,
  color = "primary",
  entering,
  style,
  variant = "body",
  weight = "regular",
  ...props
}: AppTextProps) {
  const { colors } = useTheme();
  const TextComponent = entering ? Animated.Text : Text;
  return (
    <TextComponent
      {...props}
      {...(entering ? { entering } : null)}
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
    </TextComponent>
  );
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0.1,
  },
  body: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  caption: {
    fontSize: typography.sizes.caption,
    lineHeight: 16,
  },
  hero: {
    fontSize: typography.sizes.hero,
    lineHeight: 44,
  },
  largeTitle: {
    fontSize: typography.sizes.largeTitle,
    lineHeight: 36,
  },
  title: {
    fontSize: typography.sizes.title,
    lineHeight: 26,
  },
  section: {
    fontSize: typography.sizes.section,
    lineHeight: 24,
  },
});
