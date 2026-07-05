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
  const { maskWealthValues, quoteStatus, toggleMaskWealthValues } = useSettings({
    store,
  });

  async function handleToggleMasking() {
    toggleMaskWealthValues();
    await Haptics.selectionAsync();
  }

  const quoteSourceMeta =
    quoteStatus.quoteSourceLabel === "Mixed"
      ? "Some assets use live quotes; manual fallback stays ready."
      : quoteStatus.quoteSourceLabel === "Live"
        ? "Live quotes are available for cached assets."
        : quoteStatus.quoteSourceLabel === "Manual"
          ? "Cached prices are manual fallback values."
          : "Add holdings or refresh quotes to see quote source status.";

  return (
    <ScreenContainer scroll testID="settings-screen">
      <View style={styles.content}>
        <ScreenHeader
          action={
            <View style={styles.localPill}>
              <View style={styles.localDot} />
              <AppText style={styles.localPillText} variant="caption" weight="bold">
                Local only
              </AppText>
            </View>
          }
          title="Settings"
          subtitle="Local-first controls"
        />

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
            <View style={styles.maskPreview}>
              <AppText color="secondary" variant="caption" weight="medium">
                Preview ₹••,•••
              </AppText>
            </View>
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
          <View style={styles.trustIntro}>
            <View style={styles.trustCopy}>
              <AppText variant="title" weight="bold">
                Your portfolio stays here
              </AppText>
              <AppText color="secondary">
                CogVest V1 is local-first by default. The key privacy guarantees
                are visible at a glance.
              </AppText>
            </View>
          </View>
          <GroupedListRow
            icon="phone-portrait-outline"
            title="Local storage"
            meta="Portfolio records stay on this Android device."
            value="Active"
          />
          <GroupedListRow
            icon="person-circle-outline"
            title="Account"
            meta="No sign-in or remote profile is required in V1."
            value="Not required"
          />
          <GroupedListRow
            icon="cloud-offline-outline"
            title="Cloud sync"
            meta="No portfolio data is sent to a backend."
            value="Off"
          />
          <GroupedListRow
            icon="analytics-outline"
            title="Analytics"
            meta="No product telemetry is enabled in V1."
            value="Off"
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Quotes" />
          <GroupedListRow
            icon="refresh-outline"
            title="Latest quote refresh"
            meta={`${quoteStatus.quoteCount} cached quote${
              quoteStatus.quoteCount === 1 ? "" : "s"
            } from holdings and opening positions.`}
            value={quoteStatus.latestQuoteLabel}
          />
          <GroupedListRow
            icon="pulse-outline"
            title="Quote source"
            meta={quoteSourceMeta}
            value={quoteStatus.quoteSourceLabel}
          />
          <GroupedListRow
            icon="cloud-offline-outline"
            title="Manual fallback"
            meta="Manual prices remain available when quote APIs fail."
            value={`${quoteStatus.manualFallbackCount} manual quote${
              quoteStatus.manualFallbackCount === 1 ? "" : "s"
            }`}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Currency & App" />
          <GroupedListRow
            icon="cash-outline"
            title="Base currency"
            meta="INR-first summaries across CogVest."
            value="INR"
          />
          <GroupedListRow
            icon="phone-portrait-outline"
            title="Version"
            meta="Android preview build for V1 testing."
            value="Preview"
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Data" />
          <GroupedListRow
            destructive
            icon="trash-outline"
            title="Clear local data"
            meta="Disabled until confirmation and backup guidance exist."
            value="Deferred"
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
  localDot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  localPill: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  localPillText: {
    color: colors.primary,
  },
  maskPreview: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
  trustCopy: {
    gap: spacing.xs,
  },
  trustIntro: {
    paddingBottom: spacing.xs,
  },
});
