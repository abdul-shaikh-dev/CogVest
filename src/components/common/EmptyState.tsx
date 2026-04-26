import { StyleSheet, View } from "react-native";

import { colors, radii, shadows, spacing } from "@/src/theme";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";

type EmptyStateProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
};

export function EmptyState({
  actionLabel,
  message,
  onAction,
  title,
}: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <AppText align="center" variant="title" weight="bold">
        {title}
      </AppText>
      <AppText align="center" color="secondary">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.none,
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
});
