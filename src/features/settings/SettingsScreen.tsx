import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
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
import { ContextualNudge } from "@/src/features/onboarding/ContextualNudge";

type SettingsScreenProps = {
  store?: StoreApi<PortfolioStoreState>;
};

export function SettingsScreen({
  store = getPortfolioStore(),
}: SettingsScreenProps) {
  const [isPrivacyDetailsExpanded, setIsPrivacyDetailsExpanded] =
    useState(false);
  const [isPriceDetailsExpanded, setIsPriceDetailsExpanded] = useState(false);
  const {
    displayMode,
    maskWealthValues,
    quoteStatus,
    setDisplayMode,
    toggleMaskWealthValues,
  } = useSettings({ store });

  async function handleToggleMasking() {
    toggleMaskWealthValues();
    await Haptics.selectionAsync();
  }

  async function handleDisplayModeChange(nextMode: "minimal" | "standard") {
    if (displayMode === nextMode) return;
    setDisplayMode(nextMode);
    await Haptics.selectionAsync();
  }

  const quoteSourceMeta =
    quoteStatus.quoteSourceLabel === "Mixed"
      ? "Saved provider prices and prices you entered."
      : quoteStatus.quoteSourceLabel === "Live"
        ? "Saved provider prices; freshness is shown on Dashboard."
        : quoteStatus.quoteSourceLabel === "Manual"
          ? "Prices you entered yourself."
          : "No separate price updates saved yet.";
  const priceSourceLabel = quoteStatus.quoteSourceLabel === "Live"
    ? "Provider"
    : quoteStatus.quoteSourceLabel === "Waiting"
      ? "None yet"
      : quoteStatus.quoteSourceLabel;

  return (
    <ScreenContainer scroll testID="settings-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Settings"
          subtitle="Local-first controls"
        />

        <Pressable
          accessibilityLabel="Toggle value masking"
          accessibilityHint="Hides portfolio amounts. Quantities, percentages, and per-unit prices stay visible."
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
              Hide portfolio amounts. Preview ₹••,•••
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

        <PremiumCard testID="display-mode-settings">
          <SectionHeader title="Display" />
          <View accessibilityRole="radiogroup" style={styles.modeOptions}>
            {([
              {
                description: "Full portfolio context and review prompts.",
                label: "Standard",
                value: "standard" as const,
              },
              {
                description: "Essential values with a calmer visual hierarchy.",
                label: "Minimal",
                value: "minimal" as const,
              },
            ]).map((option) => {
              const selected = displayMode === option.value;

              return (
                <Pressable
                  accessibilityLabel={`${option.label} display mode`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.value}
                  onPress={() => {
                    void handleDisplayModeChange(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.modeOption,
                    selected && styles.modeOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  testID={`display-mode-${option.value}`}
                >
                  <View style={styles.toggleCopy}>
                    <AppText weight="bold">{option.label}</AppText>
                    <AppText color="secondary" variant="caption">
                      {option.description}
                    </AppText>
                  </View>
                  <AppText
                    color={selected ? "primary" : "secondary"}
                    variant="caption"
                    weight="bold"
                  >
                    {selected ? "Selected" : "Choose"}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <ContextualNudge kind="minimal" store={store} />
        </PremiumCard>

        <PremiumCard testID="privacy-storage-card">
          <Pressable
            accessibilityLabel="Privacy and storage details"
            accessibilityRole="button"
            accessibilityState={{ expanded: isPrivacyDetailsExpanded }}
            onPress={() => setIsPrivacyDetailsExpanded((expanded) => !expanded)}
            style={({ pressed }) => [
              styles.disclosureRow,
              pressed && styles.pressed,
            ]}
            testID="privacy-details-toggle"
          >
            <View style={styles.disclosureCopy}>
              <AppText weight="medium">Privacy & storage</AppText>
              <AppText color="secondary" variant="caption">
                No account • No cloud sync • No analytics
              </AppText>
            </View>
            <AppText color="secondary" variant="caption" weight="bold">
              {isPrivacyDetailsExpanded ? "Hide" : "Show"}
            </AppText>
          </Pressable>
          {isPrivacyDetailsExpanded ? (
            <View style={styles.privacyDetails} testID="privacy-storage-details">
              <AppText color="secondary" variant="caption">
                Records stay in CogVest's app-private Android storage.
              </AppText>
              <AppText color="secondary" variant="caption">
                Protected by Android app-private storage and device security.
                Separate app encryption is not included in V1.
              </AppText>
              <AppText color="secondary" variant="caption">
                Manual portfolio backups are available. They are not encrypted, so save them only somewhere you trust.
              </AppText>
              <GroupedListRow
                icon="cloud-offline-outline"
                title="Android backup"
                meta="Cloud backup, device-to-device, and cross-platform transfer are disabled."
                value="Excluded"
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
            </View>
          ) : null}
        </PremiumCard>

        <PremiumCard testID="backup-settings-card">
          <SectionHeader title="Portfolio backup" />
          <GroupedListRow
            icon="save-outline"
            meta="Save an unencrypted manual copy to a location you choose."
            onPress={() => router.push("/backup?mode=export")}
            testID="backup-portfolio-action"
            title="Back up portfolio"
          />
          <GroupedListRow
            icon="arrow-undo-outline"
            meta="Review a backup before it replaces this device's portfolio."
            onPress={() => router.push("/backup?mode=restore")}
            testID="restore-backup-action"
            title="Restore backup"
          />
        </PremiumCard>

        <PremiumCard testID="settings-prices-card">
          <Pressable
            accessibilityLabel="Price information"
            accessibilityRole="button"
            accessibilityState={{ expanded: isPriceDetailsExpanded }}
            onPress={() => setIsPriceDetailsExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.disclosureRow, pressed && styles.pressed]}
            testID="settings-price-details-toggle"
          >
            <View style={styles.disclosureCopy}>
              <AppText weight="medium">Price information</AppText>
              <AppText color="secondary" variant="caption">
                Sources and dates of price updates
              </AppText>
            </View>
            <AppText color="secondary" variant="caption" weight="bold">
              {isPriceDetailsExpanded ? "Hide" : "Show"}
            </AppText>
          </Pressable>
          {isPriceDetailsExpanded ? (
            <View style={styles.privacyDetails} testID="settings-price-details">
              <AppText color="secondary" variant="caption">
                These are separate price updates. Prices entered with initial holdings may also be in use; check Dashboard for valuation coverage.
              </AppText>
              <View style={styles.priceDate}>
                <AppText weight="bold">Newest price update date</AppText>
                <AppText color="secondary">{quoteStatus.latestQuoteLabel}</AppText>
                <AppText color="secondary" variant="caption">
                  {`${quoteStatus.quoteCount} price update${
                    quoteStatus.quoteCount === 1 ? "" : "s"
                  }. Other prices may be older. This is not a refresh time.`}
                </AppText>
              </View>
              <GroupedListRow
                icon="pulse-outline"
                title="Price sources"
                meta={quoteSourceMeta}
                value={priceSourceLabel}
              />
              <GroupedListRow
                icon="cloud-offline-outline"
                title="Manual price updates"
                meta="You can enter a price when automatic pricing is unavailable."
                value={`${quoteStatus.manualFallbackCount} price update${
                  quoteStatus.manualFallbackCount === 1 ? "" : "s"
                }`}
              />
            </View>
          ) : null}
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="About" />
          <GroupedListRow
            icon="cash-outline"
            title="Base currency"
            meta="INR-first summaries across CogVest."
            value="INR"
          />
          <GroupedListRow
            icon="phone-portrait-outline"
            title="Version"
            meta="CogVest for Android."
            value={Constants.expoConfig?.version ?? "Not available"}
          />
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  priceDate: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    gap: spacing.sm,
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.sm,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  disclosureCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  disclosureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: interaction.minimumTouchTarget,
    paddingVertical: spacing.xs,
  },
  modeOption: {
    alignItems: "center",
    borderRadius: radii.button,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeOptionSelected: {
    backgroundColor: colors.surface.elevated,
  },
  modeOptions: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  privacyDetails: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  switchOn: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    backgroundColor: colors.text.primary,
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  switchThumbOn: {
    alignSelf: "flex-end",
  },
  switchTrack: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    justifyContent: "center",
    padding: 3,
    width: 44,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
});
