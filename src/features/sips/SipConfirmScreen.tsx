import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, IconButton, MaskedValue, PremiumCard, ScreenContainer, ScreenHeader } from "@/src/components/common";
import { DatePickerField, FormTextField, MoneyField } from "@/src/components/forms";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { sipPriceOnOrAfter, sipUnits } from "@/src/domain/sipTemplates";
import { useAssetHistory } from "@/src/features/holdings/useAssetHistory";
import { validateTradeForm } from "@/src/features/trades/tradeForm";
import { usePortfolioFields } from "@/src/hooks";
import { cashShortfallMessage, describeSaveFailure, getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";
import type { Asset, BuyTrade, SipTemplate } from "@/src/types";
import { createId } from "@/src/utils";

import { buysWholeUnits, dueDateText, fundingText, sipPriceWindow } from "./sipViewModel";
import { useDueSips } from "./useDueSips";

type Props = {
  month: string;
  now?: Date;
  onBack: () => void;
  onDone: () => void;
  store?: StoreApi<PortfolioStoreState>;
  templateId: string;
};

/** Confirms one due SIP instalment (#766) as a purchase, with its price prefilled when history has it. */
export function SipConfirmScreen({ month, now = new Date(), onBack, onDone, store = getPortfolioStore(), templateId }: Props) {
  const styles = useStyles();
  const { due, masked } = useDueSips(store, now);
  const item = due.find((entry) => entry.templateId === templateId && entry.month === month);

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="sip-confirm-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
            subtitle={item ? dueDateText(item.dueDate) : undefined}
            title="Confirm SIP purchase"
          />
          {item ? (
            <SipConfirmForm asset={item.asset} dueDate={item.dueDate} masked={masked} month={month} now={now}
              onDone={onDone} store={store} template={item.template} />
          ) : (
            <AppText color="secondary" testID="sip-confirm-not-due">This instalment is no longer due. It was confirmed or skipped.</AppText>
          )}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function SipConfirmForm({ asset, dueDate, masked, month, now, onDone, store, template }: {
  asset: Asset;
  dueDate: string;
  masked: boolean;
  month: string;
  now: Date;
  onDone: () => void;
  store: StoreApi<PortfolioStoreState>;
  template: SipTemplate;
}) {
  const styles = useStyles();
  const { openingPositions, trades } = usePortfolioFields(store, ["openingPositions", "trades"]);
  const priceWindow = sipPriceWindow(dueDate, now);
  const history = useAssetHistory(asset, priceWindow.from, priceWindow.to);
  const suggestion = history.entry && history.holdingSafe !== false ? sipPriceOnOrAfter(history.entry.points, dueDate) : null;
  // Typed values win; until then the fields follow the suggested price.
  const [typed, setTyped] = useState<{ date?: string; price?: string; units?: string }>({});
  const [errors, setErrors] = useState<Partial<Record<"date" | "pricePerUnit" | "quantity" | "save", string>>>({});
  const [saving, setSaving] = useState(false);
  const wholeUnits = buysWholeUnits(asset);

  const date = typed.date ?? suggestion?.date ?? dueDate;
  const price = typed.price ?? (suggestion ? String(suggestion.close) : "");
  const priceNumber = Number(price);
  const units = typed.units ?? (priceNumber > 0 ? String(sipUnits(template.amountInr, priceNumber, wholeUnits)) : "");
  const unitsNumber = Number(units);
  const total = priceNumber > 0 && unitsNumber > 0
    ? normalizeTrade<BuyTrade>({ assetId: asset.id, date, id: "preview", pricePerUnit: priceNumber, quantity: unitsNumber, totalValue: 0, type: "buy" }).totalValue
    : null;

  const update = (next: typeof typed) => {
    setTyped((current) => ({ ...current, ...next }));
    setErrors({});
  };

  function confirm() {
    if (saving) return;
    const result = validateTradeForm({ assetId: asset.id, date, pricePerUnit: price, quantity: units, type: "buy" }, trades, openingPositions, now);
    if (!result.isValid) {
      setErrors({ date: result.errors.date, pricePerUnit: result.errors.pricePerUnit, quantity: result.errors.quantity });
      return;
    }
    const trade = normalizeTrade<BuyTrade>({
      assetId: asset.id, date: result.value.date, id: createId("trade"), notes: "SIP instalment",
      pricePerUnit: result.value.pricePerUnit, quantity: result.value.quantity, totalValue: 0, type: "buy",
    });
    setSaving(true);
    try {
      const saved = store.getState().confirmSipInstalment({ cashLabel: `${asset.name} SIP`, month, templateId: template.id, trade });
      if (saved.status === "applied") {
        onDone();
        return;
      }
      setErrors({ save: saved.reason !== "purchase"
        ? "This instalment is no longer due. Nothing was recorded."
        : saved.purchase.reason === "insufficientCash" && saved.purchase.shortfallDate
          ? cashShortfallMessage(saved.purchase.shortfallDate)
          : saved.purchase.reason === "insufficientCash"
            ? "Not enough Cash for this purchase. Record the Cash that funds it, or change the SIP to add the money first."
            : "The purchase could not be saved safely. Check the date, price and units." });
    } catch (error) {
      setErrors({ save: describeSaveFailure(error, "The purchase was not saved. Your records are unchanged. Try again.") });
    }
    setSaving(false);
  }

  const priceNote = suggestion
    ? `${wholeUnits ? "Closing price" : "NAV"} on ${formatDate(suggestion.date)}${suggestion.date > dueDate ? ", the next trading day" : ""}. Change it to what you paid.`
    : history.loading
      ? "Looking up the price…"
      : "No price found for this date. Enter the price you paid.";

  return (
    <>
      <PremiumCard section style={styles.form} testID="sip-confirm-summary">
        <AppText weight="bold">{asset.name}</AppText>
        <AppText color="secondary" variant="caption">{fundingText(template.funding)}</AppText>
        <MaskedValue exactValue={formatINR(template.amountInr)} masked={masked} testID="sip-confirm-amount" value={formatINR(template.amountInr)} />
      </PremiumCard>
      <PremiumCard section style={styles.form}>
        <DatePickerField error={errors.date} label="Purchase date" maximumDate={now}
          onChange={(value) => update({ date: value })} testID="sip-confirm-date" value={date} />
        <MoneyField currency="INR" error={errors.pricePerUnit} label={wholeUnits ? "Price per unit" : "NAV"}
          onChangeText={(value) => update({ price: value, units: undefined })} testID="sip-confirm-price" value={price} />
        <AppText color="secondary" testID="sip-confirm-price-note" variant="caption">{priceNote}</AppText>
        <FormTextField error={errors.quantity} keyboardType="decimal-pad" label="Units"
          onChangeText={(value) => update({ units: value })} testID="sip-confirm-units" value={units} />
        <AppText color="secondary" variant="caption">
          {wholeUnits ? "Whole units the amount buys, rounded down." : "Units to three decimal places, rounded down."}
        </AppText>
        {total !== null ? (
          <View style={styles.total}>
            <AppText color="secondary">Purchase total</AppText>
            <MaskedValue exactValue={formatINR(total)} masked={masked} testID="sip-confirm-total" value={formatINR(total)} weight="bold" />
          </View>
        ) : null}
      </PremiumCard>
      {errors.save ? <AppText style={styles.error} testID="sip-confirm-error">{errors.save}</AppText> : null}
      <AppButton disabled={saving} onPress={confirm} testID="sip-confirm-save" title="Record purchase" />
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  form: { gap: spacing.sm, paddingVertical: spacing.sm },
  total: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
}));
