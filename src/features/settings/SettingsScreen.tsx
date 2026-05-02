import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppText, ScreenContainer } from "@/src/components/common";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, shadows, spacing } from "@/src/theme";

import { useSettings } from "./useSettings";

type SettingsScreenProps = {
  store?: StoreApi<PortfolioStoreState>;
};

export function SettingsScreen({
  store = getPortfolioStore(),
}: SettingsScreenProps) {
  const { maskWealthValues, toggleMaskWealthValues } = useSettings({ store });

  async function handleToggleMasking() {
    toggleMaskWealthValues();
    await Haptics.selectionAsync();
  }

  return (
    <ScreenContainer scroll testID="settings-screen">
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText color="secondary">Privacy and app controls</AppText>
          <AppText variant="hero" weight="bold">
            Settings
          </AppText>
        </View>

        <Pressable
          accessibilityLabel="Toggle value masking"
          accessibilityRole="switch"
          accessibilityState={{ checked: maskWealthValues }}
          onPress={() => {
            void handleToggleMasking();
          }}
          style={({ pressed }) => [
            styles.card,
            styles.toggleRow,
            pressed && styles.pressed,
          ]}
          testID="value-mask-toggle"
        >
          <View style={styles.toggleCopy}>
            <AppText variant="title" weight="bold">
              Value masking
            </AppText>
            <AppText color="secondary">
              Hide INR wealth values in shared or public spaces.
            </AppText>
            <AppText color="secondary" variant="caption">
              Quantities, percentages, and per-unit prices stay visible.
            </AppText>
          </View>
          <View style={[styles.switchTrack, maskWealthValues && styles.switchOn]}>
            <View
              style={[
                styles.switchThumb,
                maskWealthValues && styles.switchThumbOn,
              ]}
            />
          </View>
        </Pressable>

        <View style={styles.card}>
          <AppText weight="bold">
            {maskWealthValues ? "Values masked" : "Values visible"}
          </AppText>
          <AppText color="secondary">
            This preference is stored locally on this device.
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText variant="title" weight="bold">
            Local-first privacy
          </AppText>
          <AppText color="secondary">
            CogVest keeps portfolio data on-device. No backend, auth, analytics,
            or cloud sync is enabled in V1.
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText variant="title" weight="bold">
            Quote refresh
          </AppText>
          <AppText color="secondary">
            Dashboard and Holdings refresh current quotes on demand. Manual
            prices remain available when quote APIs fail.
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText color="secondary">App version 1.0.0</AppText>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.none,
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  switchOn: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    backgroundColor: colors.text.primary,
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  switchThumbOn: {
    alignSelf: "flex-end",
  },
  switchTrack: {
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    padding: 3,
    width: 48,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
