import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "@/src/theme";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";

type EmptyStateProps = {
  actionLabel?: string;
  actionTestID?: string;
  message: string;
  onAction?: () => void;
  title: string;
};

export function EmptyState({
  actionLabel,
  actionTestID,
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
        <AppButton title={actionLabel} testID={actionTestID} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
});
