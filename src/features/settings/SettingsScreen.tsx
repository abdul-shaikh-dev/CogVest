import * as Haptics from "expo-haptics";
import { useState } from "react";
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
  const [isPrivacyDetailsExpanded, setIsPrivacyDetailsExpanded] =
    useState(false);
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

        <PremiumCard testID="display-mode-settings">
          <SectionHeader title="Display" />
          <AppText color="secondary" variant="caption">
            Minimal keeps essential portfolio information visible while reducing
            performance emphasis and optional commentary.
          </AppText>
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
        </PremiumCard>

        <PremiumCard testID="privacy-storage-card">
          <SectionHeader title="Privacy & storage" />
          <GroupedListRow
            icon="phone-portrait-outline"
            title="Local storage"
            meta="Records stay in CogVest's app-private Android storage."
            value="Active"
          />
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
              <AppText weight="medium">Privacy details</AppText>
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
                Protected by Android app-private storage and device security.
                Separate app encryption is not included in V1.
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
          <SectionHeader title="Data availability" />
          <GroupedListRow
            icon="trash-outline"
            title="Clear local data"
            meta="Not available in V1. No data is changed from this screen."
            value="Unavailable"
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
