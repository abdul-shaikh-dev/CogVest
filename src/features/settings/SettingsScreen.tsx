import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppText,
  GroupedListRow,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";

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
        <ScreenHeader title="Settings" subtitle="Local-first controls" />

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
            <AppText weight="bold">
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

        <PremiumCard>
          <SectionHeader title="Privacy" />
          <GroupedListRow
            icon="lock-closed-outline"
            title="Local-first privacy"
            meta="No backend, auth, analytics, or cloud sync is enabled in V1."
            value="Active"
          />
          <GroupedListRow
            icon="phone-portrait-outline"
            title={maskWealthValues ? "Values masked" : "Values visible"}
            meta="This preference is stored locally on this device."
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Quotes" />
          <GroupedListRow
            icon="refresh-outline"
            title="Quote refresh"
            meta="Dashboard and Holdings refresh current quotes on demand."
            value="Manual fallback"
          />
          <GroupedListRow
            icon="cloud-offline-outline"
            title="Provider fallback"
            meta="Manual prices remain available when quote APIs fail."
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Currency" />
          <GroupedListRow title="Base currency" value="INR" />
          <GroupedListRow title="Foreign asset summary" value="On" />
          <GroupedListRow title="USD & crypto fallback" value="On" />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Display & App Info" />
          <GroupedListRow title="Density" value="Standard (V1)" />
          <GroupedListRow title="App version 1.0.0" value="Preview" />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Data" />
          <GroupedListRow
            destructive
            icon="trash-outline"
            title="Clear local data"
            meta="Destructive action. Keep disabled until implemented."
          />
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
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
    borderRadius: radii.pill,
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
