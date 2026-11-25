import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  GroupedListRow,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { maxSipTemplates } from "@/src/domain/sipTemplates";
import { usePortfolioFields } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import { fundingText, sipScheduleText } from "./sipViewModel";

/** Settings > Investment tools > SIPs (#766): every template, and a way to add one. */
export function SipTemplatesScreen({ onBack, onOpen, store = getPortfolioStore() }: {
  onBack: () => void;
  /** Opens one template, or a new one when no id is given. */
  onOpen: (templateId?: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const { assets, preferences, sipTemplates } = usePortfolioFields(store, ["assets", "preferences", "sipTemplates"]);
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  const masked = preferences.maskWealthValues;

  return (
    <ScreenContainer scroll testID="sips-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
          subtitle="Reminders for regular purchases"
          title="SIPs"
        />
        {sipTemplates.length === 0 ? (
          <EmptyState
            actionLabel="Add a SIP"
            actionTestID="sips-add-empty"
            message="Add a monthly purchase you make. On its day, the Dashboard asks you to confirm it. Nothing is bought or recorded on its own."
            onAction={() => onOpen()}
            title="No SIPs yet"
          />
        ) : (
          <>
            <PremiumCard section testID="sips-list">
              {sipTemplates.map((template) => (
                <GroupedListRow
                  icon={template.paused ? "pause-circle-outline" : "repeat-outline"}
                  key={template.id}
                  meta={`${sipScheduleText(template, masked)} · ${template.paused ? "Paused" : fundingText(template.funding)}`}
                  onPress={() => onOpen(template.id)}
                  showChevron
                  testID={`sips-row-${template.id}`}
                  title={names.get(template.assetId) ?? "Holding"}
                />
              ))}
            </PremiumCard>
            <AppText color="secondary" variant="caption">
              Each instalment waits on the Dashboard until you confirm or skip it. Confirming records one purchase.
            </AppText>
            {sipTemplates.length < maxSipTemplates ? (
              <AppButton onPress={() => onOpen()} testID="sips-add" title="Add a SIP" variant="secondary" />
            ) : null}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles(() => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
}));
