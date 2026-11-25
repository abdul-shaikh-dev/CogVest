import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, IconButton, PremiumCard, ScreenContainer, ScreenHeader } from "@/src/components/common";
import { describeSaveFailure, getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import { dueCountText, dueDateText, fundingText, sipScheduleText } from "./sipViewModel";
import { useDueSips } from "./useDueSips";

/** Every due SIP instalment (#766): confirm one as a purchase, or skip it. */
export function SipDueScreen({ now = new Date(), onBack, onConfirm, store = getPortfolioStore() }: {
  now?: Date;
  onBack: () => void;
  onConfirm: (templateId: string, month: string) => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const { due, masked } = useDueSips(store, now);
  const [message, setMessage] = useState("");

  function skip(templateId: string, month: string) {
    try {
      const result = store.getState().skipSipInstalment(templateId, month);
      setMessage(result.status === "applied" ? "Skipped. Nothing was recorded." : "That instalment is no longer due.");
    } catch (error) {
      setMessage(describeSaveFailure(error, "The instalment was not skipped. Your records are unchanged."));
    }
  }

  return (
    <ScreenContainer scroll testID="sip-due-screen">
      <View style={styles.content}>
        <ScreenHeader
          leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
          subtitle={due.length ? dueCountText(due.length) : "Nothing to confirm"}
          title="SIP instalments"
        />
        {due.length === 0 ? (
          <AppText color="secondary" testID="sip-due-empty">Every instalment so far is confirmed or skipped.</AppText>
        ) : due.map((item) => {
          const key = `${item.templateId}-${item.month}`;
          return (
            <PremiumCard key={key} section style={styles.item} testID={`sip-due-${key}`}>
              <AppText weight="bold">{item.asset.name}</AppText>
              <AppText color="secondary" variant="caption">
                {`${dueDateText(item.dueDate)} · ${sipScheduleText(item.template, masked)}`}
              </AppText>
              <AppText color="secondary" variant="caption">{fundingText(item.template.funding)}</AppText>
              <View style={styles.actions}>
                <AppButton onPress={() => onConfirm(item.templateId, item.month)} testID={`sip-due-confirm-${key}`} title="Confirm" />
                <AppButton onPress={() => skip(item.templateId, item.month)} testID={`sip-due-skip-${key}`} title="Skip" variant="secondary" />
              </View>
            </PremiumCard>
          );
        })}
        {message ? <AppText accessibilityLiveRegion="polite" color="secondary" testID="sip-due-message">{message}</AppText> : null}
        <AppText color="secondary" variant="caption">
          Missed months stay here until you confirm or skip them. CogVest never fills them in.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles(() => StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.xs },
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  item: { gap: spacing.xs },
}));
