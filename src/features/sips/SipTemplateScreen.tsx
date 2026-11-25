import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, IconButton, PremiumCard, ScreenContainer, ScreenHeader } from "@/src/components/common";
import { DatePickerField, MoneyField, SelectionField } from "@/src/components/forms";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { maxSipTemplates } from "@/src/domain/sipTemplates";
import { usePortfolioFields } from "@/src/hooks";
import { describeSaveFailure, getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";

import { buildSipInput, fundingOptions, sipDraftFrom, sipHoldingOptions, type SipDraft, type SipDraftErrors } from "./sipViewModel";

const latestFirstDate = new Date(2100, 11, 31);

/** Creates or edits one SIP template (#766). Saving one never records a purchase. */
export function SipTemplateScreen({ now = new Date(), onBack, store = getPortfolioStore(), templateId }: {
  now?: Date;
  onBack: () => void;
  store?: StoreApi<PortfolioStoreState>;
  templateId?: string;
}) {
  const styles = useStyles();
  const { assets, sipTemplates } = usePortfolioFields(store, ["assets", "sipTemplates"]);
  const saved = sipTemplates.find((item) => item.id === templateId);
  const [id] = useState(() => templateId ?? createId("sip"));
  const [draft, setDraft] = useState<SipDraft>(() => sipDraftFrom(saved, formatLocalCalendarDate(now)));
  const [errors, setErrors] = useState<SipDraftErrors>({});
  const [message, setMessage] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const holdings = sipHoldingOptions(assets);
  const holdingOptions = draft.assetId ? holdings : [{ label: "Choose a holding", value: "" }, ...holdings];

  const update = (next: Partial<SipDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setMessage("");
  };

  function run(action: () => void) {
    try {
      action();
    } catch (error) {
      setMessage(describeSaveFailure(error, "The SIP was not saved. Your records are unchanged."));
    }
  }

  function save() {
    const built = buildSipInput(draft, id, saved);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    run(() => {
      const result = store.getState().saveSipTemplate(built.input);
      if (result.status === "applied") onBack();
      else if (result.reason === "limit") setMessage(`You can keep up to ${maxSipTemplates} SIPs.`);
      else if (result.reason === "unknownHolding") setErrors({ assetId: "Choose a holding." });
      else setMessage("Check the SIP details.");
    });
  }

  function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run(() => {
      store.getState().deleteSipTemplate(id);
      onBack();
    });
  }

  if (holdings.length === 0 && !saved) {
    return (
      <ScreenContainer scroll testID="sip-screen">
        <View style={styles.content}>
          <ScreenHeader leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />} title="New SIP" />
          <AppText testID="sip-no-holdings">Add the holding first. A SIP buys more of a holding you already track in INR.</AppText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="sip-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
            subtitle={saved?.paused ? "Paused" : "A purchase you make every month"}
            title={saved ? "Edit SIP" : "New SIP"}
          />
          <PremiumCard section style={styles.form}>
            <SelectionField
              helperText={errors.assetId}
              label="Holding"
              onChange={(assetId) => update({ assetId })}
              options={holdingOptions}
              testIDPrefix="sip-holding"
              value={draft.assetId}
            />
            <MoneyField currency="INR" error={errors.amount} label="Amount each month"
              onChangeText={(amount) => update({ amount })} testID="sip-amount" value={draft.amount} />
            <DatePickerField error={errors.firstDate} label="First instalment date" maximumDate={latestFirstDate}
              onChange={(firstDate) => update({ firstDate })} openAt={now} testID="sip-first-date" value={draft.firstDate} />
            <AppText color="secondary" variant="caption">
              Later instalments fall on the same day each month, or the month&apos;s last day when it is shorter.
              Pick the first one you have not recorded yet: every instalment from that date waits on the Dashboard.
            </AppText>
            <SelectionField
              helperText={draft.funding === "deposit"
                ? "Confirming also records a Cash deposit of the same amount on the purchase date."
                : "Confirming withdraws the amount from Cash you have already recorded."}
              label="Money for each instalment"
              onChange={(funding) => update({ funding })}
              options={fundingOptions}
              testIDPrefix="sip-funding"
              value={draft.funding}
            />
          </PremiumCard>
          <AppText color="secondary" variant="caption">
            A SIP is a reminder. Each month the Dashboard asks you to confirm the purchase with its price and units, or skip it.
          </AppText>
          {message ? <AppText style={styles.error} testID="sip-message">{message}</AppText> : null}
          <AppButton onPress={save} testID="sip-save" title={saved ? "Save changes" : "Save SIP"} />
          {saved ? (
            <>
              <AppButton
                onPress={() => run(() => store.getState().setSipTemplatePaused(id, !saved.paused))}
                testID="sip-pause"
                title={saved.paused ? "Resume SIP" : "Pause SIP"}
                variant="secondary"
              />
              <AppButton
                onPress={remove}
                testID="sip-delete"
                title={confirmingDelete ? "Tap again to delete this SIP" : "Delete SIP"}
                variant="secondary"
              />
              {confirmingDelete ? (
                <AppText color="secondary" variant="caption">Purchases it already recorded stay.</AppText>
              ) : null}
            </>
          ) : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  form: { gap: spacing.sm, paddingVertical: spacing.sm },
}));
